import { useState } from 'react'
import { Modal } from '@/components/ui'

/** Devolver de "En revisión humano" a "Por hacer" exige explicar el motivo. */
export function ReturnCommentModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (comment: string) => void }) {
  const [text, setText] = useState('')
  return (
    <Modal
      open
      onClose={onCancel}
      title="Devolver a Por hacer"
      footer={
        <>
          <button className="btn-outline" onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" disabled={!text.trim()} onClick={() => onConfirm(text.trim())}>Devolver</button>
        </>
      }
    >
      <label className="label" htmlFor="ret-comment">¿Qué falta o qué hay que corregir?</label>
      <textarea id="ret-comment" autoFocus rows={4} className="input" value={text} onChange={(e) => setText(e.target.value)} />
      <p className="mt-1 text-xs text-gray-500">El comentario queda en la tarjeta y en el historial.</p>
    </Modal>
  )
}
