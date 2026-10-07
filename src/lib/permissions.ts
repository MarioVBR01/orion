import type { AppUser, ColumnId, GlobalRole, ProjectRole } from '@/types'

/** Espejo en cliente de firestore.rules (la fuente de verdad son las reglas). */
export type EffectiveRole = ProjectRole | 'admin' | null

export const ROLE_LABEL: Record<GlobalRole | ProjectRole, string> = {
  admin: 'Administrador',
  project_manager: 'Project manager',
  dev: 'Desarrollador',
  qa: 'QA',
  cliente: 'Cliente',
  tester: 'Tester',
  viewer: 'Solo lectura',
}

export function effectiveRole(me: AppUser, memberRole: ProjectRole | null | undefined): EffectiveRole {
  if (me.globalRole === 'admin') return 'admin'
  return memberRole ?? null
}

const is = (r: EffectiveRole, roles: EffectiveRole[]) => r === 'admin' || roles.includes(r)

export const can = {
  createProjects: (me: AppUser) => me.globalRole === 'admin' || me.globalRole === 'project_manager',
  manageUsers: (me: AppUser) => me.globalRole === 'admin' || me.globalRole === 'project_manager',
  isAdmin: (me: AppUser) => me.globalRole === 'admin',
  manageProject: (r: EffectiveRole) => is(r, ['project_manager']),
  viewBoard: (r: EffectiveRole) => is(r, ['project_manager', 'dev', 'qa', 'cliente', 'viewer']),
  editCards: (r: EffectiveRole) => is(r, ['project_manager', 'dev', 'qa']),
  createObservations: (r: EffectiveRole) => is(r, ['project_manager', 'dev', 'qa', 'cliente', 'tester']),
  reviewObservations: (r: EffectiveRole) => is(r, ['project_manager']),
  viewRounds: (r: EffectiveRole) => is(r, ['project_manager', 'dev', 'qa']),
  runTests: (r: EffectiveRole) => is(r, ['project_manager', 'dev', 'qa', 'tester']),
}

const DEV_COLUMNS: ColumnId[] = ['backlog', 'por_hacer', 'en_progreso', 'revision_qa']

export function canMove(r: EffectiveRole, from: ColumnId, to: ColumnId): boolean {
  if (from === to) return true
  if (r === 'admin' || r === 'project_manager') return true
  if (r === 'dev') return DEV_COLUMNS.includes(from) && DEV_COLUMNS.includes(to)
  if (r === 'qa') {
    return (
      (from === 'revision_qa' && (to === 'por_hacer' || to === 'revision_humano')) ||
      (to === 'revision_qa' && (from === 'por_hacer' || from === 'revision_humano'))
    )
  }
  return false
}
