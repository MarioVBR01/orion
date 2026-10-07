import { useState } from 'react'
import { Modal } from '@/components/ui'
import { LabelsInput } from '@/features/board/fields'
import { PRIORITIES, PRIORITY_LABEL, type Priority } from '@shared/types'

/** Diálogo de una línea de texto obligatoria (motivo de rechazo, pedir información). */
export function TextPrompt({
  title,
  label,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  title: string
  label: string
  confirmLabel: string
  danger?: boolean
  onCancel: () => void
  onConfirm: (text: string) => void
}) {
  const [text, setText] = useState('')
  return (
    <div data-nested-modal onMouseDown={(e) => e.stopPropagation()}>
      <Modal
        open
        onClose={onCancel}
        title={title}
        footer={
          <>
            <button className="btn-outline" onClick={onCancel}>Cancelar</button>
            <button className={danger ? 'btn-danger' : 'btn-primary'} disabled={!text.trim()} onClick={() => onConfirm(text.trim())}>
              {confirmLabel}
            </button>
          </>
        }
      >
        <label className="label" htmlFor="prompt-text">{label}</label>
        <textarea id="prompt-text" autoFocus rows={3} className="input" value={text} onChange={(e) => setText(e.target.value)} />
      </Modal>
    </div>
  )
}

/** Confirmar el paso al Backlog: prioridad y etiquetas iniciales de las tarjetas. */
export function ToBacklogDialog({ count, onCancel, onConfirm }: { count: number; onCancel: () => void; onConfirm: (priority: Priority, labels: string[]) => void }) {
  const [priority, setPriority] = useState<Priority>('media')
  const [labels, setLabels] = useState<string[]>([])
  return (
    <div data-nested-modal onMouseDown={(e) => e.stopPropagation()}>
      <Modal
        open
        onClose={onCancel}
        title={count === 1 ? 'Pasar al Backlog' : `Pasar ${count} observaciones al Backlog`}
        footer={
          <>
            <button className="btn-outline" onClick={onCancel}>Cancelar</button>
            <button className="btn-primary" onClick={() => onConfirm(priority, labels)}>Pasar al Backlog</button>
          </>
        }
      >
        <p className="mb-4 text-sm text-gray-600">
          {count === 1 ? 'Se creará una tarjeta' : `Se crearán ${count} tarjetas`} al final del Backlog con el reporte y las imágenes. Desde ahí la IA
          puede tomarlas con <code className="rounded bg-gray-100 px-1">orion siguiente</code>.
        </p>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="tb-prio">Prioridad</label>
            <select id="tb-prio" className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </div>
          <div>
            <span className="label">Etiquetas (opcional)</span>
            <LabelsInput value={labels} onChange={setLabels} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
