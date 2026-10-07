import { createContext, useContext } from 'react'
import type { EffectiveRole } from '@/lib/permissions'
import type { AppUser, Project, ProjectRole } from '@/types'

export interface ProjectCtx {
  project: Project
  me: AppUser
  /** rol en el proyecto (o 'admin' global) */
  role: EffectiveRole
  memberRole: ProjectRole | null
}

export const ProjectContext = createContext<ProjectCtx | null>(null)

export function useProjectCtx(): ProjectCtx {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjectCtx fuera de ProjectLayout')
  return ctx
}
