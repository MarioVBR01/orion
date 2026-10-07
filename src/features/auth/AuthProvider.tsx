import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { AppUser } from '@/types'

interface AuthState {
  /** undefined = cargando */
  firebaseUser: User | null | undefined
  /** perfil en users/{uid}; null si no existe */
  profile: AppUser | null | undefined
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null | undefined>(undefined)
  const [profile, setProfile] = useState<AppUser | null | undefined>(undefined)

  useEffect(() => onAuthStateChanged(auth, setFirebaseUser), [])

  useEffect(() => {
    if (firebaseUser === undefined) return
    if (firebaseUser === null) {
      setProfile(null)
      return
    }
    setProfile(undefined)
    return onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as AppUser) : null),
      () => setProfile(null),
    )
  }, [firebaseUser])

  const logout = () => signOut(auth)

  return <AuthContext.Provider value={{ firebaseUser, profile, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}

/** Perfil garantizado (usar solo dentro de rutas protegidas). */
export function useMe(): AppUser {
  const { profile } = useAuth()
  if (!profile) throw new Error('Sin sesión')
  return profile
}
