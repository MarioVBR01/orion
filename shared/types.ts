// Tipos compartidos entre la web (src/), el servidor local (server/) y el MCP.

export const COLUMNS = [
  { id: 'backlog', name: 'Backlog', bar: 'bg-gray-400' },
  { id: 'por_hacer', name: 'Por hacer', bar: 'bg-slate-400' },
  { id: 'en_progreso', name: 'En progreso', bar: 'bg-blue-500' },
  { id: 'revision_qa', name: 'En revisión QA', bar: 'bg-orange-400' },
  { id: 'revision_humano', name: 'En revisión humano', bar: 'bg-purple-500' },
  { id: 'hecho', name: 'Hecho', bar: 'bg-green-500' },
] as const

export type ColumnId = (typeof COLUMNS)[number]['id']
export const COLUMN_IDS: ColumnId[] = COLUMNS.map((c) => c.id)

export type ColumnCounts = Record<ColumnId, number>

/** Rol de una persona dentro de un proyecto (solo informativo: hay un único usuario). */
export type PersonRole = 'project_manager' | 'dev' | 'qa' | 'cliente' | 'tester' | 'viewer'
export const PERSON_ROLES: PersonRole[] = ['project_manager', 'dev', 'qa', 'cliente', 'tester', 'viewer']
export const ROLE_LABEL: Record<PersonRole, string> = {
  project_manager: 'Project manager',
  dev: 'Desarrollador',
  qa: 'QA',
  cliente: 'Cliente',
  tester: 'Tester',
  viewer: 'Solo lectura',
}

export interface Project {
  id: number
  name: string
  code: string
  description: string
  color: string
  favorite: boolean
  archived: boolean
  briefMd: string
  /** Instrucciones del proyecto para Claude; encabezan cada .md exportado. */
  aiInstructions: string
  createdAt: string
  counts: ColumnCounts
  people: Array<Pick<Person, 'id' | 'name'>>
}

export interface ProjectInput {
  name: string
  code: string
  description: string
  color: string
  aiInstructions?: string
}

export interface Person {
  id: number
  projectId: number
  name: string
  email: string
  role: PersonRole
  createdAt: string
}

export interface Settings {
  userName: string
}

// ---------- Tarjetas ----------

export type CardType = 'tarea' | 'bug' | 'historia'
export type Priority = 'alta' | 'media' | 'baja'
export const CARD_TYPES: CardType[] = ['tarea', 'bug', 'historia']
export const PRIORITIES: Priority[] = ['alta', 'media', 'baja']
export const TYPE_LABEL: Record<CardType, string> = { tarea: 'Tarea', bug: 'Bug', historia: 'Historia' }
export const PRIORITY_LABEL: Record<Priority, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

/** Asignado especial: Claude Code (vía MCP). */
export const CLAUDE = 'claude'

/** Reporte estructurado: ¿Dónde? / ¿Qué hice? / ¿Qué esperaba? / ¿Qué pasó? */
export interface Report {
  where: string
  steps: string[]
  expected: string
  actual: string
}

export interface AcceptanceItem {
  text: string
  done: boolean
}

export interface Attachment {
  name: string
  url: string
  type: string
  size: number
}

export interface Card {
  id: number
  projectId: number
  number: number
  title: string
  type: CardType
  priority: Priority
  column: ColumnId
  order: string
  labels: string[]
  /** nombre de la persona, 'claude' o null */
  assignee: string | null
  descriptionMd: string
  report: Report | null
  acceptance: AcceptanceItem[]
  attachments: Attachment[]
  sprintId: number | null
  versionId: number | null
  branch: string | null
  prUrl: string | null
  commitSha: string | null
  sourceObservationIds: number[]
  createdBy: string
  createdAt: string
  updatedAt: string
  archived: boolean
  /** Última vez que se exportó a .md para el chat del proyecto (null = nunca). */
  exportedAt: string | null
}

export interface CardInput {
  title: string
  type: CardType
  priority: Priority
  column?: ColumnId
  labels?: string[]
  assignee?: string | null
  descriptionMd?: string
  report?: Report | null
  acceptance?: AcceptanceItem[]
}

export type CardPatch = Partial<
  Pick<
    Card,
    | 'title'
    | 'type'
    | 'priority'
    | 'labels'
    | 'assignee'
    | 'descriptionMd'
    | 'report'
    | 'acceptance'
    | 'branch'
    | 'prUrl'
    | 'commitSha'
    | 'archived'
  >
>

export interface MoveInput {
  column: ColumnId
  /** clave de orden calculada por el cliente; si falta, va al final de la columna */
  order?: string
  comment?: string
}

export type BulkAction =
  | { action: 'move'; column: ColumnId }
  | { action: 'assign'; assignee: string | null }
  | { action: 'label'; label: string }
  | { action: 'archive' }

export interface Comment {
  id: number
  cardId: number
  author: string
  text: string
  createdAt: string
}

export type HistoryAction = 'creada' | 'movida' | 'editada' | 'comentada' | 'archivada' | 'restaurada' | 'trabajo' | 'exportada'

export interface HistoryEntry {
  id: number
  cardId: number
  cardNumber: number
  cardTitle: string
  actor: string
  action: HistoryAction
  from: string | null
  to: string | null
  detail: string | null
  at: string
}

// ---------- Observaciones (Por revisar) ----------

export type Channel = 'clientes' | 'testers'
export type ObservationKind = 'bug' | 'mejora' | 'duda'
/** pendiente → (info ↔ pendiente) → en_backlog | rechazada */
export type ObservationStatus = 'pendiente' | 'info' | 'en_backlog' | 'rechazada'

export const CHANNELS: Channel[] = ['clientes', 'testers']
export const OBSERVATION_KINDS: ObservationKind[] = ['bug', 'mejora', 'duda']
export const KIND_LABEL: Record<ObservationKind, string> = { bug: 'Bug', mejora: 'Mejora', duda: 'Duda' }
export const KIND_EMOJI: Record<ObservationKind, string> = { bug: '🐞', mejora: '💡', duda: '❓' }
export const KIND_HINT: Record<ObservationKind, string> = {
  bug: 'algo está roto',
  mejora: 'algo podría funcionar mejor',
  duda: 'no sé si es un error',
}
export const STATUS_LABEL: Record<ObservationStatus, string> = {
  pendiente: 'Pendiente',
  info: 'Esperando información',
  en_backlog: 'En Backlog',
  rechazada: 'Rechazada',
}
/** Tipo de tarjeta que nace de cada tipo de observación. */
export const KIND_TO_CARD_TYPE: Record<ObservationKind, CardType> = { bug: 'bug', mejora: 'historia', duda: 'tarea' }

export interface Observation {
  id: number
  projectId: number
  number: number
  channel: Channel
  kind: ObservationKind
  title: string
  description: string
  /** Reporte estructurado (solo observaciones antiguas); las nuevas usan `description`. */
  report: Report | null
  attachments: Attachment[]
  sender: string
  status: ObservationStatus
  statusNote: string | null
  cardNumber: number | null
  createdAt: string
  updatedAt: string
}

export interface ObservationInput {
  channel: Channel
  kind: ObservationKind
  title: string
  description: string
  attachments?: Attachment[]
  sender?: string
}

export interface ObservationComment {
  id: number
  observationId: number
  author: string
  text: string
  createdAt: string
}

export interface ToBacklogInput {
  numbers: number[]
  priority?: Priority
  labels?: string[]
}

// ---------- Exportación a .md ----------

export interface ExportInput {
  numbers: number[]
  /** true: registra la exportación en el historial (al copiar o descargar). */
  mark?: boolean
  /** Mover las tarjetas a esta columna al marcar la exportación (opcional). */
  moveTo?: ColumnId
}

export interface ExportResult {
  filename: string
  markdown: string
}
