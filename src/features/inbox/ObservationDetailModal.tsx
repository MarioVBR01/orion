import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircleQuestion, Pencil, RotateCcw, X, XCircle } from 'lucide-react'
import { Gallery } from '@/components/Attachments'
import { ReportView } from '@/components/ReportEditor'
import { Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { useObservation, useObservationComments, useObservationMutations } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { STATUS_LABEL, type Observation } from '@shared/types'
import { KindBadge, StatusPill } from './badges'
import { TextPrompt, ToBacklogDialog } from './dialogs'
import { ObservationFormModal } from './ObservationFormModal'

export function ObservationDetailModal({ number, initial, onClose }: { number: number; initial?: Observation; onClose: () => void }) {
  const project = useCurrentProject()
  const toast = useToast()
  const { data: obs } = useObservation(project.id, number, initial)
  const { data: comments } = useObservationComments(project.id, number)
  const m = useObservationMutations(project.id)
  const [dialog, setDialog] = useState<null | 'backlog' | 'reject' | 'info' | 'edit'>(null)
  const [text, setText] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[data-nested-modal]') && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fail = (e: unknown) => toast.error(errorMessage(e))
  const open = obs && (obs.status === 'pendiente' || obs.status === 'info')

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Observación #${number}`}
        className="flex max-h-full w-full flex-col overflow-hidden bg-white shadow-xl sm:max-h-[92vh] sm:max-w-3xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
          {obs && <KindBadge kind={obs.kind} />}
          <span className="text-sm text-gray-400">#{number}</span>
          {obs && <StatusPill status={obs.status} />}
          <button aria-label="Cerrar (Esc)" className="ml-auto rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        {!obs ? (
          <div className="p-5"><Skeleton className="h-64" /></div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div>
                <h2 className="text-xl font-semibold">{obs.title}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Por {obs.sender} · {formatDateTime(new Date(obs.createdAt))} · {obs.channel === 'clientes' ? 'Clientes' : 'Testers'}
                </p>
              </div>

              {obs.status === 'en_backlog' && obs.cardNumber && (
                <Link
                  to={`/proyectos/${project.id}/tablero?tarjeta=${obs.cardNumber}`}
                  className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 hover:bg-green-100"
                >
                  Está en el Backlog como tarjeta <strong>#{obs.cardNumber}</strong> <ArrowRight className="ml-auto h-4 w-4" />
                </Link>
              )}
              {obs.statusNote && (obs.status === 'rechazada' || obs.status === 'info') && (
                <p className={`rounded-lg px-4 py-3 text-sm ${obs.status === 'rechazada' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
                  <strong>{STATUS_LABEL[obs.status]}:</strong> {obs.statusNote}
                </p>
              )}

              <ReportView report={obs.report} />

              {obs.attachments.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-gray-700">📎 Imagen ({obs.attachments.length})</h3>
                  <Gallery attachments={obs.attachments} />
                </section>
              )}

              <section>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Comentarios</h3>
                <ul className="space-y-2">
                  {comments?.map((c) => (
                    <li key={c.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      <p className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{c.author}</span> · {formatDateTime(new Date(c.createdAt))}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap">{c.text}</p>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!text.trim()) return
                    m.comment.mutate({ number, text }, { onSuccess: () => setText(''), onError: fail })
                  }}
                >
                  <input aria-label="Nuevo comentario" className="input" placeholder="Escribe un comentario…" value={text} onChange={(e) => setText(e.target.value)} />
                  <button className="btn-outline" disabled={!text.trim()}>Enviar</button>
                </form>
              </section>
            </div>

            <footer className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-5 py-3">
              {open ? (
                <>
                  <button className="btn-outline" onClick={() => setDialog('edit')}><Pencil className="h-4 w-4" /> Editar</button>
                  <button className="btn-outline" onClick={() => setDialog('info')}><MessageCircleQuestion className="h-4 w-4" /> Pedir más información</button>
                  <button className="btn-outline text-red-600" onClick={() => setDialog('reject')}><XCircle className="h-4 w-4" /> Rechazar</button>
                  <button className="btn-primary ml-auto" onClick={() => setDialog('backlog')}><ArrowRight className="h-4 w-4" /> Pasar al Backlog</button>
                </>
              ) : obs.status === 'rechazada' ? (
                <button className="btn-outline" onClick={() => m.reopen.mutate(number, { onSuccess: () => toast.success('Observación reabierta.'), onError: fail })}>
                  <RotateCcw className="h-4 w-4" /> Reabrir
                </button>
              ) : null}
            </footer>
          </>
        )}
      </div>

      {dialog === 'backlog' && (
        <ToBacklogDialog
          count={1}
          onCancel={() => setDialog(null)}
          onConfirm={(priority, labels) =>
            m.toBacklog.mutate(
              { numbers: [number], priority, labels },
              {
                onSuccess: ([card]) => {
                  toast.success(`Pasada al Backlog como tarjeta #${card?.number}.`)
                  setDialog(null)
                },
                onError: fail,
              },
            )
          }
        />
      )}
      {dialog === 'reject' && (
        <TextPrompt
          title="Rechazar observación"
          label="Motivo del rechazo"
          confirmLabel="Rechazar"
          danger
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => m.reject.mutate({ numbers: [number], reason }, { onSuccess: () => setDialog(null), onError: fail })}
        />
      )}
      {dialog === 'info' && (
        <TextPrompt
          title="Pedir más información"
          label="¿Qué información falta?"
          confirmLabel="Marcar como esperando información"
          onCancel={() => setDialog(null)}
          onConfirm={(question) => m.requestInfo.mutate({ number, question }, { onSuccess: () => setDialog(null), onError: fail })}
        />
      )}
      {dialog === 'edit' && obs && <ObservationFormModal channel={obs.channel} editing={obs} onClose={() => setDialog(null)} />}
    </div>
  )
}
