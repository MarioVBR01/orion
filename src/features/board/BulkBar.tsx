import { useState } from 'react'
import { Archive, FileDown, X } from 'lucide-react'
import { usePeople } from '@/lib/api'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { CLAUDE, COLUMNS, type BulkAction, type ColumnId } from '@shared/types'

/** Barra flotante para acciones sobre las tarjetas seleccionadas. */
export function BulkBar({
  count,
  onClear,
  onApply,
  onExport,
}: {
  count: number
  onClear: () => void
  onApply: (op: BulkAction) => void
  onExport: () => void
}) {
  const project = useCurrentProject()
  const { data: people } = usePeople(project.id)
  const [label, setLabel] = useState('')

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div role="toolbar" aria-label="Acciones masivas" className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-xl">
        <span className="text-sm font-semibold">{count} seleccionada(s)</span>
        <button className="btn-primary py-1.5" onClick={onExport}>
          <FileDown className="h-4 w-4" /> Exportar .md
        </button>
        <select
          aria-label="Mover a columna"
          className="input w-auto py-1.5"
          value=""
          onChange={(e) => e.target.value && onApply({ action: 'move', column: e.target.value as ColumnId })}
        >
          <option value="">Mover a…</option>
          {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          aria-label="Asignar"
          className="input w-auto py-1.5"
          value=""
          onChange={(e) => e.target.value && onApply({ action: 'assign', assignee: e.target.value === '-' ? null : e.target.value })}
        >
          <option value="">Asignar a…</option>
          <option value={CLAUDE}>🤖 claude</option>
          {people?.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          <option value="-">Sin asignar</option>
        </select>
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (label.trim()) onApply({ action: 'label', label: label.trim() })
            setLabel('')
          }}
        >
          <input aria-label="Etiqueta a agregar" className="input w-32 py-1.5" placeholder="Etiqueta…" value={label} onChange={(e) => setLabel(e.target.value)} />
        </form>
        <button className="btn-outline py-1.5" onClick={() => confirm(`¿Archivar ${count} tarjeta(s)?`) && onApply({ action: 'archive' })}>
          <Archive className="h-4 w-4" /> Archivar
        </button>
        <button aria-label="Cancelar selección" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" onClick={onClear}>
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
