import { GoogleAuthProvider, signInWithPopup, type User } from 'firebase/auth'
import {
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { GlobalRole, ProjectRole } from '@/types'

export interface Invite {
  id: string // email en minúsculas
  email: string
  name: string
  globalRole: GlobalRole
  projects: Record<string, ProjectRole>
  createdBy: string
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return signInWithPopup(auth, provider)
}

/** Crea o amplía una invitación (merge de proyectos). */
export async function upsertInvite(input: {
  email: string
  name?: string
  globalRole: GlobalRole
  projects?: Record<string, ProjectRole>
  createdBy: string
}) {
  const email = normalizeEmail(input.email)
  const ref = doc(db, 'invites', email)
  const prev = await getDoc(ref)
  const prevData = prev.exists() ? (prev.data() as Omit<Invite, 'id'>) : null
  await setDoc(ref, {
    email,
    name: input.name?.trim() || prevData?.name || '',
    globalRole: prevData?.globalRole ?? input.globalRole,
    projects: { ...(prevData?.projects ?? {}), ...(input.projects ?? {}) },
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
  })
}

export function deleteInvite(email: string) {
  return deleteDoc(doc(db, 'invites', normalizeEmail(email)))
}

/**
 * Si el usuario de Google tiene invitación, crea su perfil, lo agrega a los
 * proyectos invitados y borra la invitación. Devuelve true si la reclamó.
 */
export async function claimInvite(user: User): Promise<boolean> {
  if (!user.email) return false
  const ref = doc(db, 'invites', normalizeEmail(user.email))
  const snap = await getDoc(ref)
  if (!snap.exists()) return false
  const inv = snap.data() as Omit<Invite, 'id'>
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', user.uid), {
    name: inv.name || user.displayName || inv.email,
    email: inv.email,
    photoURL: user.photoURL ?? null,
    globalRole: inv.globalRole,
    active: true,
    createdAt: serverTimestamp(),
  })
  for (const [pid, role] of Object.entries(inv.projects ?? {})) {
    batch.set(doc(db, 'projects', pid, 'members', user.uid), { role, addedAt: serverTimestamp() })
    batch.update(doc(db, 'projects', pid), { memberIds: arrayUnion(user.uid) })
  }
  batch.delete(ref)
  await batch.commit()
  return true
}

export function setUserActive(uid: string, active: boolean) {
  return updateDoc(doc(db, 'users', uid), { active })
}

export function setUserRole(uid: string, globalRole: GlobalRole) {
  return updateDoc(doc(db, 'users', uid), { globalRole })
}

/** Primer admin del sistema (pantalla /setup). */
export async function bootstrapAdmin(user: User) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', user.uid), {
    name: user.displayName || user.email || 'Admin',
    email: normalizeEmail(user.email ?? ''),
    photoURL: user.photoURL ?? null,
    globalRole: 'admin',
    active: true,
    createdAt: serverTimestamp(),
  })
  batch.set(doc(db, 'meta', 'bootstrap'), { uid: user.uid, at: serverTimestamp() })
  await batch.commit()
}
