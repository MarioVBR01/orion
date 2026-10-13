import { useState } from 'react'
import { CalendarCheck, ChevronRight, FileDown, Plus } from 'lucide-react'
import { EmptyState, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { api, useDailies } from '@/lib/api'
import { useCurrentProject } from '@/features/project/ProjectContext'
import type { DailyActivity, DailyScrum } from '@shared/types'
import { DailyEditor, todayIso } from './DailyEditor'
import { downloadDailyPdf, longDate } from './dailyPdf'

/** Daily Scrum: registro diario del equipo como evidencia (exportable a PDF). */
export function DailyTab() {
  const project = useCurrentProject()
  const toast = useToast()
  const { data: dailies, isPending } = useDailies(project.id)
  const [editing, setEditing] = useState<DailyScrum | 'new' | null>(null)
  const hasToday = dailies?.some((d) => d.date === todayIso())

  async function pdf(d: DailyScrum) {
    try {
      const activity = await api<DailyActivity>(`/projects/${project.id}/dailies/activity?date=${d.date}`)
      await downloadDailyPdf(project, d, activity)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-[15px] text-gray-500">
          Registra cada día qué hizo cada persona, qué hará y sus impedimentos. ORION agrega la actividad del tablero (incluido lo que hizo
          Claude) y guarda el estado de las columnas. Exporta cada daily a PDF como evidencia.
        </p>
        <button className="btn-primary px-5 py-3 text-[15px]" onClick={() => setEditing(hasToday ? dailies!.find((d) => d.date === todayIso())! : 'new')}>
          <Plus className="h-4 w-4" /> {hasToday ? 'Abrir el daily de hoy' : 'Nuevo Daily Scrum'}
        </button>
      </div>

      {isPending ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : !dailies?.length ? (
        <EmptyState
          icon={<CalendarCheck className="h-10 w-10" />}
          title="Aún no hay dailies"
          text="Crea el de hoy para empezar a registrar las evidencias del equipo."
          action={<button className="btn-primary" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Nuevo Daily Scrum</button>}
        />
      ) : (
        <ul className="space-y-3">
          {dailies.map((d) => {
            const blockers = d.entries.filter((e) => e.blockers.trim()).length
            return (
              <li key={d.id} className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md">
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEditing(d)}>
                  <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-50 text-brand">
                    <span className="text-lg leading-none font-bold">{d.date.slice(8)}</span>
                    <span className="text-[10px] uppercase">{new Intl.DateTimeFormat('es-BO', { month: 'short' }).format(new Date(`${d.date}T12:00:00`))}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold capitalize">{longDate(d.date)}</span>
                    <span className="block truncate text-sm text-gray-500">
                      {d.entries.length} participante(s){d.entries.length ? `: ${d.entries.map((e) => e.person).join(', ')}` : ''}
                      {blockers > 0 && <span className="ml-2 text-red-600">· {blockers} con impedimentos</span>}
                    </span>
                    {d.notes && <span className="block truncate text-xs text-gray-400">{d.notes}</span>}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
                </button>
                <button className="btn-outline shrink-0 py-1.5" onClick={() => void pdf(d)} aria-label={`Exportar PDF del ${longDate(d.date)}`}>
                  <FileDown className="h-4 w-4" /> PDF
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {editing && <DailyEditor daily={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
