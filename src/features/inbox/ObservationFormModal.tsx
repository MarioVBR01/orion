import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui'
import { AttachmentsInput } from '@/components/Attachments'
import { errorMessage, useToast } from '@/components/Toast'
import { useObservationMutations, usePeople, useSettings } from '@/lib/api'
import { useCurrentProject } from '@/features/project/ProjectContext'
import {
  KIND_EMOJI,
  KIND_HINT,
  KIND_LABEL,
  OBSERVATION_KINDS,
  type Attachment,
  type Channel,
  type Observation,
  type ObservationKind,
} from '@shared/types'

/** Nueva observación (o edición de una abierta): Título, Tipo, Descripción y Screenshots. */
export function ObservationFormModal({ channel, editing, onClose }: { channel: Channel; editing?: Observation; onClose: () => void }) {
  const project = useCurrentProject()
  const toast = useToast()
  const { data: settings } = useSettings()
  const { data: people } = usePeople(project.id)
  const m = useObservationMutations(project.id)

  const [title, setTitle] = useState(editing?.title ?? '')
  const [kind, setKind] = useState<ObservationKind>(editing?.kind ?? 'bug')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [attachments, setAttachments] = useState<Attachment[]>(editing?.attachments ?? [])
  const [sender, setSender] = useState(editing?.sender ?? '')

  // Remitentes sugeridos: primero los del rol del canal (clientes / testers).
  const role = channel === 'clientes' ? 'cliente' : 'tester'
  const suggested = [...(people ?? [])].sort((a, b) => Number(b.role === role) - Number(a.role === role)).map((p) => p.name)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const input = { channel: editing?.channel ?? channel, kind, title, description, attachments, sender: sender.trim() || undefined }
    try {
      if (editing) {
        await m.update.mutateAsync({ number: editing.number, ...input })
        toast.success('Observación actualizada.')
      } else {
        const o = await m.create.mutateAsync(input)
        toast.success(`Observación #${o.number} enviada a revisar.`)
      }
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const busy = m.create.isPending || m.update.isPending
  return (
    <div data-nested-modal onMouseDown={(e) => e.stopPropagation()}>
      <Modal
        open
        onClose={onClose}
        title={editing ? `Editar observación #${editing.number}` : 'Nueva observación'}
        footer={
          <>
            <button className="rounded-lg px-4 py-2 text-[15px] text-gray-600 hover:bg-gray-100" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-primary px-5 py-2.5 text-[15px] font-semibold" type="submit" form="obs-form" disabled={busy}>
              {busy ? 'Enviando…' : editing ? 'Guardar cambios' : 'Enviar a revisar'}
            </button>
          </>
        }
      >
        <form id="obs-form" onSubmit={submit} className="space-y-5">
          <div>
            <label className="label text-[15px]" htmlFor="obs-title">Título</label>
            <input id="obs-title" required autoFocus maxLength={300} className="input py-3" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="label text-[15px]" htmlFor="obs-kind">Tipo</label>
            <select id="obs-kind" className="input py-3" value={kind} onChange={(e) => setKind(e.target.value as ObservationKind)}>
              {OBSERVATION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_EMOJI[k]} {KIND_LABEL[k]} ({KIND_HINT[k]})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label text-[15px]" htmlFor="obs-desc">Descripción</label>
            <textarea
              id="obs-desc"
              required
              rows={6}
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qué pasa, dónde y qué debería pasar. Puedes usar viñetas con - "
            />
          </div>

          <div>
            <span className="label text-[15px]">Screenshots</span>
            <AttachmentsInput variant="button" projectId={project.id} value={attachments} onChange={setAttachments} />
          </div>

          <div>
            <label className="label" htmlFor="obs-sender">
              Reportado por <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              id="obs-sender"
              className="input"
              list="obs-senders"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder={settings?.userName ? `Si lo dejas vacío: ${settings.userName}` : 'Nombre de quien reporta'}
            />
            <datalist id="obs-senders">
              {suggested.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
        </form>
      </Modal>
    </div>
  )
}
