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
