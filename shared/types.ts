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
  createdAt: string
  counts: ColumnCounts
  people: Array<Pick<Person, 'id' | 'name'>>
}

export interface ProjectInput {
  name: string
  code: string
  description: string
  color: string
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

export type HistoryAction = 'creada' | 'movida' | 'editada' | 'comentada' | 'archivada' | 'restaurada' | 'trabajo'

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
