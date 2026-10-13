import { useMemo, useState } from 'react'
import { Bot, FileDown, Plus, Trash2, UserPlus, Users } from 'lucide-react'
import { Modal, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { useDailyActivity, useDailyMutations, usePeople } from '@/lib/api'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { CLAUDE, CLAUDE_PERSON, COLUMNS, type DailyEntry, type DailyScrum } from '@shared/types'
import { downloadDailyPdf, longDate, moveText, periodText } from './dailyPdf'

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const emptyEntry = (person = ''): DailyEntry => ({ person, yesterday: '', today: '', blockers: '' })

/** Crear o editar un Daily Scrum: participantes (ayer / hoy / impedimentos) + actividad del tablero. */
export function DailyEditor({ daily, onClose }: { daily?: DailyScrum; onClose: () => void }) {
  const project = useCurrentProject()
  const toast = useToast()
  const m = useDailyMutations(project.id)
  const { data: people } = usePeople(project.id)
  const [date, setDate] = useState(daily?.date ?? todayIso())
  const [notes, setNotes] = useState(daily?.notes ?? '')
  const [entries, setEntries] = useState<DailyEntry[]>(daily?.entries.length ? daily.entries : [emptyEntry()])
  const [saved, setSaved] = useState<DailyScrum | undefined>(daily)
  const [exporting, setExporting] = useState(false)
  const { data: activity, isPending: loadingActivity } = useDailyActivity(project.id, date)

  const names = useMemo(() => new Set(entries.map((e) => e.person.trim().toLowerCase())), [entries])
  const claudeMoves = activity?.moves.filter((x) => x.actor === CLAUDE) ?? []

  const setEntry = (i: number, patch: Partial<DailyEntry>) => setEntries((list) => list.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  const addPeople = () => {
    const missing = (people ?? []).map((p) => p.name).filter((n) => !names.has(n.toLowerCase()))
    if (!missing.length) {
      toast.error('Todos los miembros ya están en el daily (agrégalos en la pestaña Miembros).')
      return
    }
    setEntries((list) => [...list.filter((e) => e.person.trim() || e.yesterday || e.today), ...missing.map((n) => emptyEntry(n))])
  }
  const addClaude = () => {
    if (names.has(CLAUDE_PERSON.toLowerCase())) return
    const byCard = new Map<number, string>()
    for (const mv of claudeMoves) byCard.set(mv.cardNumber, `#${mv.cardNumber} ${mv.cardTitle} (${moveText(mv)})`)
    setEntries((list) => [
      ...list.filter((e) => e.person.trim() || e.yesterday || e.today),
      {
        person: CLAUDE_PERSON,
        yesterday: byCard.size ? [...byCard.values()].map((t) => `- ${t}`).join('\n') : 'Sin tarjetas trabajadas en el periodo.',
        today: 'Continuar con las tarjetas del Backlog.',
        blockers: '',
      },
    ])
  }

  async function save(): Promise<DailyScrum | null> {
    const input = { date, notes, entries }
    try {
      const result = saved ? await m.update.mutateAsync({ id: saved.id, ...input }) : await m.create.mutateAsync(input)
      setSaved(result)
      return result
    } catch (e) {
      toast.error(errorMessage(e))
      return null
    }
  }

  async function exportPdf() {
    setExporting(true)
    try {
      const d = await save()
      if (d) {
        await downloadDailyPdf(project, d, activity)
        toast.success(`PDF del daily del ${longDate(d.date)} descargado.`)
      }
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const busy = m.create.isPending || m.update.isPending || exporting
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={saved ? `Daily Scrum · ${longDate(saved.date)}` : 'Nuevo Daily Scrum'}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {saved && (
            <button
              className="btn-outline mr-auto text-red-600"
              disabled={busy}
              onClick={() => {
                if (!confirm('¿Eliminar este daily?')) return
                m.remove.mutate(saved.id, { onSuccess: onClose, onError: (e) => toast.error(errorMessage(e)) })
              }}
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          )}
          <button className="btn-outline" disabled={busy} onClick={() => void exportPdf()}>
            <FileDown className="h-4 w-4" /> {exporting ? 'Generando…' : 'Guardar y exportar PDF'}
          </button>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              if (await save()) {
                toast.success('Daily guardado.')
                onClose()
              }
            }}
          >
            Guardar
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div>
            <label className="label" htmlFor="d-date">Fecha</label>
            <input id="d-date" type="date" required className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="d-notes">Notas generales <span className="font-normal text-gray-400">(opcional)</span></label>
            <input id="d-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Objetivo del sprint, acuerdos…" />
          </div>
        </div>

        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="mr-auto text-sm font-semibold text-gray-700">Participantes</h3>
            <button type="button" className="btn-outline py-1.5 text-xs" onClick={addPeople}>
              <Users className="h-3.5 w-3.5" /> Agregar miembros
            </button>
            <button type="button" className="btn-outline py-1.5 text-xs" onClick={addClaude} disabled={names.has(CLAUDE_PERSON.toLowerCase())}>
              <Bot className="h-3.5 w-3.5" /> Agregar Claude (IA)
            </button>
            <button type="button" className="btn-outline py-1.5 text-xs" onClick={() => setEntries((l) => [...l, emptyEntry()])}>
              <UserPlus className="h-3.5 w-3.5" /> Participante
            </button>
          </div>
          <datalist id="daily-people">
            {(people ?? []).map((p) => <option key={p.id} value={p.name} />)}
          </datalist>
          <ul className="space-y-3">
            {entries.map((e, i) => (
              <li key={i} className="rounded-xl border border-gray-200 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    aria-label={`Nombre del participante ${i + 1}`}
                    list="daily-people"
                    className="input py-1.5 font-medium sm:w-64"
                    placeholder="Nombre"
                    value={e.person}
                    onChange={(ev) => setEntry(i, { person: ev.target.value })}
                  />
                  <button
                    type="button"
                    aria-label={`Quitar participante ${i + 1}`}
                    className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => setEntries((l) => l.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {(
                    [
                      ['yesterday', '¿Qué hice ayer?'],
                      ['today', '¿Qué haré hoy?'],
                      ['blockers', 'Impedimentos'],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="block">
                      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
                      <textarea rows={3} className="input text-[13px]" value={e[k]} onChange={(ev) => setEntry(i, { [k]: ev.target.value })} />
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {!entries.length && (
            <button type="button" className="mt-1 inline-flex items-center gap-1 text-sm text-brand" onClick={() => setEntries([emptyEntry()])}>
              <Plus className="h-4 w-4" /> Agregar participante
            </button>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Actividad del tablero</h3>
          {loadingActivity ? (
            <Skeleton className="h-24" />
          ) : activity ? (
            <>
              <p className="mb-2 text-xs text-gray-500">
                Periodo: {periodText(activity)} · {activity.moves.length} movimiento(s)
              </p>
              {activity.moves.length ? (
                <ul className="max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 text-sm">
                  {activity.moves.map((mv) => (
                    <li key={mv.id} className="flex flex-wrap items-center gap-x-2 px-3 py-1.5">
                      <span className="text-gray-400">#{mv.cardNumber}</span>
                      <span className="min-w-0 flex-1 truncate">{mv.cardTitle}</span>
                      <span className="text-xs text-gray-600">{moveText(mv)}</span>
                      <span className={`text-xs ${mv.actor === CLAUDE ? 'text-violet-700' : 'text-gray-500'}`}>
                        {mv.actor === CLAUDE ? '🤖 claude' : mv.actor}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Sin movimientos en el periodo.</p>
              )}
            </>
          ) : null}
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Estado del tablero</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {COLUMNS.map((c) => (
              <div key={c.id} className="rounded-lg border border-gray-200 px-2 py-1.5 text-center">
                <div className={`mx-auto mb-1 h-1 w-8 rounded-full ${c.bar}`} />
                <p className="text-lg font-bold">{(saved?.boardSnapshot ?? project.counts)[c.id] ?? 0}</p>
                <p className="truncate text-[11px] text-gray-500">{c.name}</p>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">{saved ? 'Registrado al guardar este daily.' : 'Se registrará al guardar.'}</p>
        </section>
      </div>
    </Modal>
  )
}
