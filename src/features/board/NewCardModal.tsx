import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { useCardMutations } from '@/lib/api'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { CARD_TYPES, COLUMNS, PRIORITIES, PRIORITY_LABEL, TYPE_LABEL, type CardType, type ColumnId, type Priority } from '@shared/types'
import { AssigneeSelect, LabelsInput } from './fields'

export function NewCardModal({ onClose, onCreated }: { onClose: () => void; onCreated: (n: number) => void }) {
  const project = useCurrentProject()
  const toast = useToast()
  const { create } = useCardMutations(project.id)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<CardType>('tarea')
  const [priority, setPriority] = useState<Priority>('media')
  const [column, setColumn] = useState<ColumnId>('backlog')
  const [labels, setLabels] = useState<string[]>([])
  const [assignee, setAssignee] = useState<string | null>(null)
  const [descriptionMd, setDescription] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      const card = await create.mutateAsync({ title, type, priority, column, labels, assignee, descriptionMd })
      toast.success(`Tarjeta #${card.number} creada.`)
      onClose()
      onCreated(card.number)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Nueva tarjeta"
      footer={
        <>
          <button className="btn-outline" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" type="submit" form="new-card" disabled={create.isPending}>Crear tarjeta</button>
        </>
      }
    >
      <form id="new-card" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="nc-title">Título</label>
          <input id="nc-title" autoFocus required maxLength={300} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="[DIR-TEC-09] Pipeline de monitoreo…" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="nc-type">Tipo</label>
            <select id="nc-type" className="input" value={type} onChange={(e) => setType(e.target.value as CardType)}>
              {CARD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="nc-prio">Prioridad</label>
            <select id="nc-prio" className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="nc-col">Columna</label>
            <select id="nc-col" className="input" value={column} onChange={(e) => setColumn(e.target.value as ColumnId)}>
              {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">Etiquetas</span>
            <LabelsInput value={labels} onChange={setLabels} />
          </div>
          <div>
            <label className="label" htmlFor="nc-assignee">Asignado</label>
            <AssigneeSelect id="nc-assignee" value={assignee} onChange={setAssignee} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="nc-desc">Descripción (Markdown)</label>
          <textarea id="nc-desc" rows={6} className="input font-mono text-[13px]" value={descriptionMd} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </form>
    </Modal>
  )
}
