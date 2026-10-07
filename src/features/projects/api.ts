import { useEffect, useState } from 'react'
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getCountFromServer,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COLUMNS, type AppUser, type ColumnId, type Member, type Project, type ProjectRole } from '@/types'

/** Proyectos visibles: admin ve todos; el resto, donde es miembro. */
export function useProjects(me: AppUser) {
  const [projects, setProjects] = useState<Project[] | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  useEffect(() => {
    const base = collection(db, 'projects')
    const q = me.globalRole === 'admin' ? query(base) : query(base, where('memberIds', 'array-contains', me.id))
    return onSnapshot(
      q,
      (s) => setProjects(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Project)),
      (e) => {
        setError(e)
        setProjects([])
      },
    )
  }, [me.id, me.globalRole])
  return { projects, error }
}

export function useProject(pid: string | undefined) {
  const [project, setProject] = useState<Project | null | undefined>(undefined)
  useEffect(() => {
    if (!pid) return
    return onSnapshot(
      doc(db, 'projects', pid),
      (s) => setProject(s.exists() ? ({ id: s.id, ...s.data() } as Project) : null),
      () => setProject(null),
    )
  }, [pid])
  return project
}

export function useMembers(pid: string | undefined) {
  const [members, setMembers] = useState<Member[] | undefined>(undefined)
  useEffect(() => {
    if (!pid) return
    return onSnapshot(
      collection(db, 'projects', pid, 'members'),
      (s) => setMembers(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Member)),
      () => setMembers([]),
    )
  }, [pid])
  return members
}

/** Rol del usuario actual en el proyecto (null = no es miembro). */
export function useMyRole(pid: string | undefined, uid: string) {
  const [role, setRole] = useState<ProjectRole | null | undefined>(undefined)
  useEffect(() => {
    if (!pid) return
    return onSnapshot(
      doc(db, 'projects', pid, 'members', uid),
      (s) => setRole(s.exists() ? (s.data().role as ProjectRole) : null),
      () => setRole(null),
    )
  }, [pid, uid])
  return role
}

export async function createProject(
  me: AppUser,
  input: { name: string; code: string; description: string; color: string },
): Promise<string> {
  const projectRef = doc(collection(db, 'projects'))
  await runTransaction(db, async (tx) => {
    const countersRef = doc(db, 'meta', 'counters')
    const counters = await tx.get(countersRef)
    const number = (counters.exists() ? (counters.data().project as number) : 0) + 1
    if (counters.exists()) tx.update(countersRef, { project: number })
    else tx.set(countersRef, { project: number })
    tx.set(projectRef, {
      number,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      description: input.description.trim(),
      color: input.color,
      favoriteBy: [],
      memberIds: [me.id],
      createdBy: me.id,
      createdAt: serverTimestamp(),
      archived: false,
      briefMd: '',
      counters: { card: 0, round: 0, observation: 0 },
    })
    tx.set(doc(db, 'projects', projectRef.id, 'members', me.id), { role: 'project_manager', addedAt: serverTimestamp() })
  })
  return projectRef.id
}

export function updateProject(pid: string, data: Partial<Pick<Project, 'name' | 'description' | 'color' | 'code' | 'archived'>>) {
  return updateDoc(doc(db, 'projects', pid), data)
}

export function toggleFavorite(pid: string, uid: string, isFav: boolean) {
  return updateDoc(doc(db, 'projects', pid), { favoriteBy: isFav ? arrayRemove(uid) : arrayUnion(uid) })
}

export type ColumnCounts = Record<ColumnId, number>

/** Conteo por columna con agregaciones (no descarga las tarjetas). */
export async function fetchColumnCounts(pid: string): Promise<ColumnCounts> {
  const cards = collection(db, 'projects', pid, 'cards')
  const entries = await Promise.all(
    COLUMNS.map(async (c) => {
      const snap = await getCountFromServer(query(cards, where('archived', '==', false), where('column', '==', c.id)))
      return [c.id, snap.data().count] as const
    }),
  )
  return Object.fromEntries(entries) as ColumnCounts
}

export function useColumnCounts(pid: string, enabled: boolean, refreshKey: unknown = 0) {
  const [counts, setCounts] = useState<ColumnCounts | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    fetchColumnCounts(pid)
      .then((c) => alive && setCounts(c))
      .catch(() => alive && setCounts(null))
    return () => {
      alive = false
    }
  }, [pid, enabled, refreshKey])
  return counts
}
