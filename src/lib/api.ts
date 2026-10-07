import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Person, PersonRole, Project, ProjectInput, Settings } from '@shared/types'

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
