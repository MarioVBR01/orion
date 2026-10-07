import type { Timestamp } from 'firebase/firestore'

export type GlobalRole = 'admin' | 'project_manager' | 'dev' | 'qa' | 'cliente' | 'tester'
export type ProjectRole = 'project_manager' | 'dev' | 'qa' | 'cliente' | 'tester' | 'viewer'

export const GLOBAL_ROLES: GlobalRole[] = ['admin', 'project_manager', 'dev', 'qa', 'cliente', 'tester']
export const PROJECT_ROLES: ProjectRole[] = ['project_manager', 'dev', 'qa', 'cliente', 'tester', 'viewer']

export interface AppUser {
  id: string
  name: string
  email: string
  globalRole: GlobalRole
  active: boolean
  createdAt?: Timestamp
}

export interface ProjectCounters {
  card: number
  round: number
  observation: number
}

export const COLUMNS = [
  { id: 'backlog', name: 'Backlog', bar: 'bg-gray-400' },
  { id: 'por_hacer', name: 'Por hacer', bar: 'bg-slate-400' },
  { id: 'en_progreso', name: 'En progreso', bar: 'bg-blue-500' },
  { id: 'revision_qa', name: 'En revisión QA', bar: 'bg-orange-400' },
  { id: 'revision_humano', name: 'En revisión humano', bar: 'bg-purple-500' },
  { id: 'hecho', name: 'Hecho', bar: 'bg-green-500' },
] as const

export type ColumnId = (typeof COLUMNS)[number]['id']

export interface Project {
  id: string
  number: number
  name: string
  code: string
  description: string
  color: string
  favoriteBy: string[]
  memberIds: string[]
  createdBy: string
  createdAt?: Timestamp
  archived: boolean
  briefMd: string
  counters: ProjectCounters
  columnCounts?: Partial<Record<ColumnId, number>>
}

export interface Member {
  id: string // uid
  role: ProjectRole
  addedAt?: Timestamp
}
