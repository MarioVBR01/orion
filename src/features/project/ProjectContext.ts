import { createContext, useContext } from 'react'
import type { Project } from '@shared/types'

export const ProjectContext = createContext<Project | null>(null)

export function useCurrentProject(): Project {
  const p = useContext(ProjectContext)
  if (!p) throw new Error('useCurrentProject fuera de ProjectLayout')
  return p
}
