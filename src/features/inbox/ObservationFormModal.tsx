import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui'
import { AttachmentsInput } from '@/components/Attachments'
import { ReportEditor, emptyReport } from '@/components/ReportEditor'
import { errorMessage, useToast } from '@/components/Toast'
import { useObservationMutations, usePeople, useSettings } from '@/lib/api'
import { useCurrentProject } from '@/features/project/ProjectContext'
import {
  KIND_EMOJI,
  KIND_LABEL,
  OBSERVATION_KINDS,
  type Attachment,
  type Channel,
  type Observation,
  type ObservationKind,
  type Report,
} from '@shared/types'

/** Nueva observación (o edición de una abierta) con la estructura fija del reporte. */
export function ObservationFormModal({ channel, editing, onClose }: { channel: Channel; editing?: Observation; onClose: () => void }) {
  const project = useCurrentProject()
  const toast = useToast()
  const { data: settings } = useSettings()
  const { data: people } = usePeople(project.id)
  const m = useObservationMutations(project.id)

  const [kind, setKind] = useState<ObservationKind>(editing?.kind ?? 'bug')
  const [title, setTitle] = useState(editing?.title ?? '')
  const [sender, setSender] = useState(editing?.sender ?? '')
  const [report, setReport] = useState<Report>(editing ? { ...editing.report, steps: editing.report.steps.length ? editing.report.steps : [''] } : emptyReport())
  const [attachments, setAttachments] = useState<Attachment[]>(editing?.attachments ?? [])

  // Remitentes sugeridos: primero los del rol del canal (clientes / testers).
  const role = channel === 'clientes' ? 'cliente' : 'tester'
  const suggested = [...(people ?? [])].sort((a, b) => Number(b.role === role) - Number(a.role === role)).map((p) => p.name)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const input = { channel: editing?.channel ?? channel, kind, title, report, attachments, sender: sender.trim() || undefined }
    try {
      if (editing) {
        await m.update.mutateAsync({ number: editing.number, ...input })
        toast.success('Observación actualizada.')
      } else {
        const o = await m.create.mutateAsync(input)
        toast.success(`Observación #${o.number} registrada.`)
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
        wide
        onClose={onClose}
        title={editing ? `Editar observación #${editing.number}` : `Nueva observación · ${channel === 'clientes' ? 'Clientes' : 'Testers'}`}
        footer={
          <>
            <button className="btn-outline" type="button" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" type="submit" form="obs-form" disabled={busy}>{busy ? 'Guardando…' : 'Guardar observación'}</button>
          </>
        }
      >
        <form id="obs-form" onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div>
              <label className="label" htmlFor="obs-kind">Tipo</label>
              <select id="obs-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as ObservationKind)}>
                {OBSERVATION_KINDS.map((k) => <option key={k} value={k}>{KIND_EMOJI[k]} {KIND_LABEL[k]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="obs-title">Título</label>
              <input id="obs-title" required autoFocus maxLength={300} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="APP-FLUJO CARRERA-QR" />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="obs-sender">Reportado por</label>
            <input
              id="obs-sender"
              className="input"
              list="obs-senders"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder={settings?.userName ? `${settings.userName} (si lo dejas vacío)` : 'Nombre de quien reporta'}
            />
            <datalist id="obs-senders">
              {suggested.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>

          <ReportEditor value={report} onChange={setReport} required idPrefix="obs" />

          <div>
            <span className="label">📎 Imagen</span>
            <AttachmentsInput projectId={project.id} value={attachments} onChange={setAttachments} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
