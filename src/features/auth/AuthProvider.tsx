import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { claimInvite } from '@/lib/users'
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
    let triedClaim = false
    return onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() } as AppUser)
          return
        }
        if (snap.metadata.fromCache) return
        if (triedClaim) {
          setProfile(null)
          return
        }
        // Primer ingreso: si tiene invitación, la reclama (el snapshot se vuelve a disparar).
        triedClaim = true
        claimInvite(firebaseUser)
          .then((claimed) => !claimed && setProfile(null))
          .catch(() => setProfile(null))
      },
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
