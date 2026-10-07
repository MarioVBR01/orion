import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  BulkAction,
  Card,
  CardInput,
  CardPatch,
  Comment,
  HistoryEntry,
  MoveInput,
  Person,
  PersonRole,
  Project,
  ProjectInput,
  Settings,
  Attachment,
  Channel,
  Observation,
  ObservationComment,
  ObservationInput,
  ObservationStatus,
  ToBacklogInput,
} from '@shared/types'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: init?.method ?? 'GET',
      headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new ApiError('No hay conexión con el servidor local. ¿Está corriendo "npm run dev" o "npm start"?', 0)
  }
  if (res.status === 204) return undefined as T
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = typeof data === 'object' && data && 'error' in data ? String((data as { error: unknown }).error) : res.statusText
    throw new ApiError(msg, res.status)
  }
  return data as T
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Refresco periódico: así se ven los cambios hechos por el MCP u otra pestaña.
      refetchInterval: 5000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

export const keys = {
  settings: ['settings'] as const,
  projects: ['projects'] as const,
  project: (id: number) => ['projects', id] as const,
  people: (id: number) => ['projects', id, 'people'] as const,
}

// ---------- Ajustes ----------
export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: () => api<Settings>('/settings') })
}
export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => api<Settings>('/settings', { method: 'PATCH', body: patch }),
    onSuccess: (s) => qc.setQueryData(keys.settings, s),
  })
}

// ---------- Proyectos ----------
export function useProjects() {
  return useQuery({ queryKey: keys.projects, queryFn: () => api<Project[]>('/projects') })
}
export function useProject(id: number) {
  return useQuery({ queryKey: keys.project(id), queryFn: () => api<Project>(`/projects/${id}`), enabled: id > 0 })
}
export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ProjectInput) => api<Project>('/projects', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }),
  })
}
export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & Partial<ProjectInput & { favorite: boolean; archived: boolean; briefMd: string }>) =>
      api<Project>(`/projects/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: (p) => {
      qc.setQueryData(keys.project(p.id), p)
      void qc.invalidateQueries({ queryKey: keys.projects, exact: true })
    },
  })
}

// ---------- Personas ----------
export function usePeople(projectId: number) {
  return useQuery({ queryKey: keys.people(projectId), queryFn: () => api<Person[]>(`/projects/${projectId}/people`) })
}
export function usePeopleMutations(projectId: number) {
  const qc = useQueryClient()
  const done = () => {
    void qc.invalidateQueries({ queryKey: keys.people(projectId) })
    void qc.invalidateQueries({ queryKey: keys.projects })
  }
  return {
    add: useMutation({
      mutationFn: (input: { name: string; email: string; role: PersonRole }) =>
        api<Person>(`/projects/${projectId}/people`, { method: 'POST', body: input }),
      onSuccess: done,
    }),
    update: useMutation({
      mutationFn: ({ id, ...patch }: { id: number; name?: string; email?: string; role?: PersonRole }) =>
        api<Person>(`/projects/${projectId}/people/${id}`, { method: 'PATCH', body: patch }),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api<void>(`/projects/${projectId}/people/${id}`, { method: 'DELETE' }),
      onSuccess: done,
    }),
  }
}

// ---------- Tarjetas ----------
export const cardKeys = {
  all: (pid: number) => ['projects', pid, 'cards'] as const,
  list: (pid: number, archived = false) => ['projects', pid, 'cards', { archived }] as const,
  comments: (pid: number, n: number) => ['projects', pid, 'cards', n, 'comments'] as const,
  history: (pid: number, n: number) => ['projects', pid, 'cards', n, 'history'] as const,
  activity: (pid: number) => ['projects', pid, 'activity'] as const,
}

export function useCards(pid: number, archived = false) {
  return useQuery({
    queryKey: cardKeys.list(pid, archived),
    queryFn: () => api<Card[]>(`/projects/${pid}/cards${archived ? '?archived=1' : ''}`),
  })
}
export function useComments(pid: number, n: number) {
  return useQuery({ queryKey: cardKeys.comments(pid, n), queryFn: () => api<Comment[]>(`/projects/${pid}/cards/${n}/comments`) })
}
export function useCardHistory(pid: number, n: number) {
  return useQuery({ queryKey: cardKeys.history(pid, n), queryFn: () => api<HistoryEntry[]>(`/projects/${pid}/cards/${n}/history`) })
}
export function useActivity(pid: number, enabled: boolean) {
  return useQuery({ queryKey: cardKeys.activity(pid), queryFn: () => api<HistoryEntry[]>(`/projects/${pid}/activity?limit=200`), enabled })
}

export function useCardMutations(pid: number) {
  const qc = useQueryClient()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: cardKeys.all(pid) })
    void qc.invalidateQueries({ queryKey: cardKeys.activity(pid) })
    void qc.invalidateQueries({ queryKey: keys.project(pid), exact: true })
    void qc.invalidateQueries({ queryKey: keys.projects, exact: true })
  }
  const patchLocal = (number: number, fn: (c: Card) => Card) =>
    qc.setQueryData<Card[]>(cardKeys.list(pid), (old) => old?.map((c) => (c.number === number ? fn(c) : c)))

  return {
    create: useMutation({
      mutationFn: (input: CardInput) => api<Card>(`/projects/${pid}/cards`, { method: 'POST', body: input }),
      onSettled: refresh,
    }),
    update: useMutation({
      mutationFn: ({ number, ...patch }: { number: number } & CardPatch) =>
        api<Card>(`/projects/${pid}/cards/${number}`, { method: 'PATCH', body: patch }),
      onSuccess: (card) => patchLocal(card.number, () => card),
      onSettled: refresh,
    }),
    /** Movimiento optimista: la tarjeta cambia de columna al instante y se revierte si el servidor la rechaza. */
    move: useMutation({
      mutationFn: ({ number, ...input }: { number: number } & MoveInput) =>
        api<Card>(`/projects/${pid}/cards/${number}/move`, { method: 'POST', body: input }),
      onMutate: async ({ number, column, order }) => {
        await qc.cancelQueries({ queryKey: cardKeys.list(pid) })
        const previous = qc.getQueryData<Card[]>(cardKeys.list(pid))
        patchLocal(number, (c) => ({ ...c, column, order: order ?? c.order }))
        return { previous }
      },
      onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(cardKeys.list(pid), ctx.previous),
      onSettled: refresh,
    }),
    bulk: useMutation({
      mutationFn: (body: { numbers: number[]; op: BulkAction }) => api<Card[]>(`/projects/${pid}/cards/bulk`, { method: 'POST', body }),
      onSettled: refresh,
    }),
    comment: useMutation({
      mutationFn: ({ number, text }: { number: number; text: string }) =>
        api<Comment>(`/projects/${pid}/cards/${number}/comments`, { method: 'POST', body: { text } }),
      onSettled: refresh,
    }),
  }
}

// ---------- Adjuntos ----------
export async function uploadFile(pid: number, file: File): Promise<Attachment> {
  let res: Response
  try {
    res = await fetch(`/api/projects/${pid}/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name || 'captura.png') },
      body: file,
    })
  } catch {
    throw new ApiError('No hay conexión con el servidor local.', 0)
  }
  const data: unknown = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(typeof data === 'object' && data && 'error' in data ? String(data.error) : res.statusText, res.status)
  return data as Attachment
}

// ---------- Observaciones ----------
export type ObservationFilter = ObservationStatus | 'abiertas' | 'todas'

export const obsKeys = {
  all: (pid: number) => ['projects', pid, 'observations'] as const,
  list: (pid: number, channel: Channel, status: ObservationFilter) => ['projects', pid, 'observations', channel, status] as const,
  counts: (pid: number) => ['projects', pid, 'observations', 'counts'] as const,
  one: (pid: number, n: number) => ['projects', pid, 'observations', 'one', n] as const,
  comments: (pid: number, n: number) => ['projects', pid, 'observations', 'one', n, 'comments'] as const,
}

export function useObservations(pid: number, channel: Channel, status: ObservationFilter) {
  const q = new URLSearchParams({ channel })
  if (status !== 'todas') q.set('status', status)
  return useQuery({ queryKey: obsKeys.list(pid, channel, status), queryFn: () => api<Observation[]>(`/projects/${pid}/observations?${q}`) })
}
export function useObservationCounts(pid: number) {
  return useQuery({ queryKey: obsKeys.counts(pid), queryFn: () => api<Record<Channel, number>>(`/projects/${pid}/observations/counts`) })
}
export function useObservation(pid: number, n: number, initial?: Observation) {
  return useQuery({
    queryKey: obsKeys.one(pid, n),
    queryFn: () => api<Observation>(`/projects/${pid}/observations/${n}`),
    placeholderData: initial,
  })
}
export function useObservationComments(pid: number, n: number) {
  return useQuery({ queryKey: obsKeys.comments(pid, n), queryFn: () => api<ObservationComment[]>(`/projects/${pid}/observations/${n}/comments`) })
}

export function useObservationMutations(pid: number) {
  const qc = useQueryClient()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: obsKeys.all(pid) })
    void qc.invalidateQueries({ queryKey: cardKeys.all(pid) })
    void qc.invalidateQueries({ queryKey: keys.project(pid), exact: true })
    void qc.invalidateQueries({ queryKey: keys.projects, exact: true })
  }
  const base = `/projects/${pid}/observations`
  return {
    create: useMutation({
      mutationFn: (input: ObservationInput) => api<Observation>(base, { method: 'POST', body: input }),
      onSettled: refresh,
    }),
    update: useMutation({
      mutationFn: ({ number, ...patch }: { number: number } & Partial<ObservationInput>) =>
        api<Observation>(`${base}/${number}`, { method: 'PATCH', body: patch }),
      onSettled: refresh,
    }),
    toBacklog: useMutation({
      mutationFn: (input: ToBacklogInput) => api<Card[]>(`${base}/to-backlog`, { method: 'POST', body: input }),
      onSettled: refresh,
    }),
    reject: useMutation({
      mutationFn: (input: { numbers: number[]; reason: string }) => api<Observation[]>(`${base}/reject`, { method: 'POST', body: input }),
      onSettled: refresh,
    }),
    requestInfo: useMutation({
      mutationFn: ({ number, question }: { number: number; question: string }) =>
        api<Observation>(`${base}/${number}/request-info`, { method: 'POST', body: { question } }),
      onSettled: refresh,
    }),
    reopen: useMutation({
      mutationFn: (number: number) => api<Observation>(`${base}/${number}/reopen`, { method: 'POST' }),
      onSettled: refresh,
    }),
    comment: useMutation({
      mutationFn: ({ number, text }: { number: number; text: string }) =>
        api<ObservationComment>(`${base}/${number}/comments`, { method: 'POST', body: { text } }),
      onSettled: refresh,
    }),
  }
}
