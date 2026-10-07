import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth'
import { doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db, firebaseConfig, useEmulators } from './firebase'
import type { GlobalRole, ProjectRole } from '@/types'

/**
 * Crea una cuenta de Auth sin cerrar la sesión actual (usa una app secundaria)
 * y luego escribe users/{uid} con la sesión del admin/PM (validado por las reglas).
 */
export async function createAppUser(input: {
  name: string
  email: string
  password: string
  globalRole: GlobalRole
  projects?: Array<{ projectId: string; role: ProjectRole; memberIds: string[] }>
}): Promise<string> {
  const secondary = initializeApp(firebaseConfig, `secondary-${Date.now()}`)
  try {
    const secAuth = getAuth(secondary)
    if (useEmulators) connectAuthEmulator(secAuth, 'http://127.0.0.1:9099', { disableWarnings: true })
    const cred = await createUserWithEmailAndPassword(secAuth, input.email.trim(), input.password)
    const uid = cred.user.uid
    await signOut(secAuth)

    const batch = writeBatch(db)
    batch.set(doc(db, 'users', uid), {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      globalRole: input.globalRole,
      active: true,
      createdAt: serverTimestamp(),
    })
    for (const p of input.projects ?? []) {
      batch.set(doc(db, 'projects', p.projectId, 'members', uid), { role: p.role, addedAt: serverTimestamp() })
      batch.update(doc(db, 'projects', p.projectId), { memberIds: [...new Set([...p.memberIds, uid])] })
    }
    await batch.commit()
    return uid
  } finally {
    await deleteApp(secondary)
  }
}

export function setUserActive(uid: string, active: boolean) {
  return updateDoc(doc(db, 'users', uid), { active })
}

export function setUserRole(uid: string, globalRole: GlobalRole) {
  return updateDoc(doc(db, 'users', uid), { globalRole })
}

/** Primer admin del sistema (pantalla /setup). */
export async function bootstrapAdmin(uid: string, name: string, email: string) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'users', uid), {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    globalRole: 'admin',
    active: true,
    createdAt: serverTimestamp(),
  })
  batch.set(doc(db, 'meta', 'bootstrap'), { uid, at: serverTimestamp() })
  await batch.commit()
}

export function updateMyName(uid: string, name: string) {
  return setDoc(doc(db, 'users', uid), { name: name.trim() }, { merge: true })
}
