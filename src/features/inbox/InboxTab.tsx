import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownUp, ArrowRight, ChevronRight, Inbox, Paperclip, Search, X, XCircle } from 'lucide-react'
import { EmptyState, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { useObservationCounts, useObservationMutations, useObservations, type ObservationFilter } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { normalize } from '@shared/board'
import type { Channel, Observation } from '@shared/types'
import { KindBadge, StatusPill } from './badges'
import { TextPrompt, ToBacklogDialog } from './dialogs'
import { ObservationDetailModal } from './ObservationDetailModal'
import { ObservationFormModal } from './ObservationFormModal'

const FILTERS: Array<{ id: ObservationFilter; label: string }> = [
  { id: 'abiertas', label: 'Por revisar' },
  { id: 'en_backlog', label: 'En Backlog' },
  { id: 'rechazada', label: 'Rechazadas' },
  { id: 'todas', label: 'Todas' },
]

/** Bandeja de entrada: reportes de clientes y testers que se revisan y se pasan a mano al Backlog. */
export function InboxTab() {
  const project = useCurrentProject()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const channel: Channel = params.get('canal') === 'testers' ? 'testers' : 'clientes'
  const [filter, setFilter] = useState<ObservationFilter>('abiertas')
  const [query, setQuery] = useState('')
  const [newestFirst, setNewestFirst] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [openNumber, setOpenNumber] = useState<number | null>(null)
  const [dialog, setDialog] = useState<null | 'new' | 'backlog' | 'reject'>(null)

  const { data: list, isPending } = useObservations(project.id, channel, filter)
  const { data: counts } = useObservationCounts(project.id)
  const m = useObservationMutations(project.id)

  const shown = useMemo(() => {
    const q = normalize(query.trim())
    const items = (list ?? []).filter((o) => !q || normalize(o.sender).includes(q))
    return newestFirst ? items : [...items].reverse()
  }, [list, query, newestFirst])

  const selectable = (o: Observation) => o.status === 'pendiente' || o.status === 'info'
  const toggle = (n: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  const switchChannel = (c: Channel) => {
    setSelected(new Set())
    setParams((p) => {
      p.set('canal', c)
      return p
    })
  }

  return (
    <div className="pb-24">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex gap-2" role="tablist" aria-label="Canal">
          {(['clientes', 'testers'] as Channel[]).map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={channel === c}
              onClick={() => switchChannel(c)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[15px] font-medium ${
                channel === c ? 'bg-brand text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {c === 'clientes' ? 'Clientes' : 'Testers'}
              {!!counts?.[c] && (
                <span className={`rounded-full px-1.5 text-xs ${channel === c ? 'bg-white/25' : 'bg-blue-100 text-brand'}`}>{counts[c]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-[15px] text-gray-500">
          Reportes pendientes de revisión. Revísalos y pásalos al Backlog cuando estén listos: ahí se convierten en tarjetas y la IA puede
          trabajarlas con <code className="rounded bg-gray-100 px-1 text-[13px]">orion siguiente</code>.
        </p>
        <button className="btn-primary px-5 py-3 text-[15px]" onClick={() => setDialog('new')}>Nueva observación</button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-[400px]">
          <span className="sr-only">Buscar por remitente</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar por remitente…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button className="btn-outline py-2.5" onClick={() => setNewestFirst((v) => !v)}>
          <ArrowDownUp className="h-4 w-4" /> {newestFirst ? 'Más nuevos primero' : 'Más antiguos primero'}
        </button>
        <select aria-label="Estado" className="input w-auto" value={filter} onChange={(e) => { setFilter(e.target.value as ObservationFilter); setSelected(new Set()) }}>
          {FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </div>

      <div className="mt-4">
        {isPending ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : !shown.length ? (
          <EmptyState
            icon={<Inbox className="h-10 w-10" />}
            title={query ? 'Nadie con ese nombre' : filter === 'abiertas' ? 'No hay reportes por revisar' : 'Sin observaciones'}
            text={filter === 'abiertas' && !query ? 'Registra los reportes de clientes o testers con "Nueva observación".' : undefined}
          />
        ) : (
          <ul className="space-y-3">
            {shown.map((o) => (
              <li key={o.id} className="card flex items-start gap-3 p-4 transition-shadow hover:shadow-md">
                <input
                  type="checkbox"
                  className="mt-1.5 h-4 w-4 shrink-0 accent-brand disabled:opacity-30"
                  aria-label={`Seleccionar observación #${o.number}`}
                  disabled={!selectable(o)}
                  checked={selected.has(o.number)}
                  onChange={() => toggle(o.number)}
                />
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpenNumber(o.number)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <KindBadge kind={o.kind} />
                      <h3 className="truncate text-[17px] font-semibold">{o.title}</h3>
                      {o.status !== 'pendiente' && <StatusPill status={o.status} />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[15px] text-gray-600">{summary(o)}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-gray-400">
                      Por {o.sender} · {formatDateTime(new Date(o.createdAt))}
                      {o.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-0.5">· <Paperclip className="h-3 w-3" /> {o.attachments.length}</span>
                      )}
                      {o.cardNumber && <span>· tarjeta #{o.cardNumber}</span>}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div role="toolbar" aria-label="Acciones sobre observaciones" className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-xl">
            <span className="text-sm font-semibold">{selected.size} seleccionada(s)</span>
            <button className="btn-primary" onClick={() => setDialog('backlog')}><ArrowRight className="h-4 w-4" /> Pasar al Backlog</button>
            <button className="btn-outline text-red-600" onClick={() => setDialog('reject')}><XCircle className="h-4 w-4" /> Rechazar</button>
            <button aria-label="Cancelar selección" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" onClick={() => setSelected(new Set())}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {openNumber !== null && (
        <ObservationDetailModal number={openNumber} initial={list?.find((o) => o.number === openNumber)} onClose={() => setOpenNumber(null)} />
      )}
      {dialog === 'new' && <ObservationFormModal channel={channel} onClose={() => setDialog(null)} />}
      {dialog === 'backlog' && (
        <ToBacklogDialog
          count={selected.size}
          onCancel={() => setDialog(null)}
          onConfirm={(priority, labels) =>
            m.toBacklog.mutate(
              { numbers: [...selected], priority, labels },
              {
                onSuccess: (cards) => {
                  toast.success(`${cards.length} tarjeta(s) creadas en el Backlog: ${cards.map((c) => `#${c.number}`).join(', ')}.`)
                  setSelected(new Set())
                  setDialog(null)
                },
                onError: (e) => toast.error(errorMessage(e)),
              },
            )
          }
        />
      )}
      {dialog === 'reject' && (
        <TextPrompt
          title={`Rechazar ${selected.size} observación(es)`}
          label="Motivo del rechazo"
          confirmLabel="Rechazar"
          danger
          onCancel={() => setDialog(null)}
          onConfirm={(reason) =>
            m.reject.mutate(
              { numbers: [...selected], reason },
              {
                onSuccess: () => {
                  setSelected(new Set())
                  setDialog(null)
                },
                onError: (e) => toast.error(errorMessage(e)),
              },
            )
          }
        />
      )}
    </div>
  )
}

/** Texto de la tarjeta de la lista: qué pasó, o dónde si no hay más. */
function summary(o: Observation): string {
  return [o.report.actual, o.report.where].filter(Boolean).join(' — ')
}
