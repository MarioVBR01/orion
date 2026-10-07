import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AppUser } from '@/types'

/** Todos los usuarios (legibles por cualquier usuario activo). */
export function useUsers() {
  const [users, setUsers] = useState<AppUser[] | undefined>(undefined)
  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'users'), orderBy('name')),
      (s) => setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() }) as AppUser)),
      () => setUsers([]),
    )
  }, [])
  const byId = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users])
  return { users, byId }
}
