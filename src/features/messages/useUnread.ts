import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/** Cantidad de mensajes no leídos (escucha hasta 10 para mostrar "9+"). */
export function useUnreadCount(uid: string): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const q = query(collection(db, 'messages'), where('toUid', '==', uid), where('read', '==', false), limit(10))
    return onSnapshot(q, (s) => setCount(s.size), () => setCount(0))
  }, [uid])
  return count
}
