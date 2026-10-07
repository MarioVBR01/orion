import { useCallback, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { History, Lightbulb, MoreVertical, Plus, RefreshCw, Search } from 'lucide-react'
import { useCardMutations, useCards } from '@/lib/api'
import { errorMessage, useToast } from '@/components/Toast'
import { ProgressBar, Skeleton } from '@/components/ui'
import { groupByColumn, matchesSearch, orderBetween, progress } from '@shared/board'
import { isReturn } from '@shared/flow'
import { COLUMNS, COLUMN_IDS, type Card, type ColumnId } from '@shared/types'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { BoardColumn } from './BoardColumn'
import { CardView } from './CardTile'
import { BulkBar } from './BulkBar'
import { CardDetailModal } from './CardDetailModal'
import { NewCardModal } from './NewCardModal'
import { ActivityDrawer } from './ActivityDrawer'
import { IdeasDrawer } from './IdeasDrawer'
import { ArchivedDrawer } from './ArchivedDrawer'
import { ReturnCommentModal } from './ReturnCommentModal'

type Items = Record<ColumnId, number[]>
interface PendingMove {
  number: number
  column: ColumnId
  order?: string
}

export function BoardTab() {
  const project = useCurrentProject()
  const toast = useToast()
  const { data: cards, isPending, refetch, isFetching } = useCards(project.id)
  const m = useCardMutations(project.id)

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [openNumber, setOpenNumber] = useState<number | null>(null)
  const [panel, setPanel] = useState<null | 'new' | 'activity' | 'ideas' | 'archived'>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingReturn, setPendingReturn] = useState<PendingMove | null>(null)
  const [items, setItems] = useState<Items | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const dragOrigin = useRef<{ column: ColumnId; index: number } | null>(null)

  const byNumber = useMemo(() => new Map((cards ?? []).map((c) => [c.number, c])), [cards])
  const visible = useMemo(() => (cards ?? []).filter((c) => matchesSearch(c, search)), [cards, search])
  const groups = useMemo(() => groupByColumn(visible), [visible])
  const stats = useMemo(() => progress(cards ?? []), [cards])
  /** Orden de navegación ←/→ en el detalle: columna por columna, de arriba abajo. */
  const navOrder = useMemo(() => COLUMN_IDS.flatMap((c) => groups[c].map((x) => x.number)), [groups])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const toggleSelect = useCallback((n: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }, [])
  const openCard = useCallback((n: number) => setOpenNumber(n), [])

  // ---------- Drag & drop ----------
  const snapshot = (): Items => Object.fromEntries(COLUMN_IDS.map((c) => [c, groups[c].map((x) => x.number)])) as Items
  const containerOf = (id: UniqueIdentifier, state: Items): ColumnId | null => {
    if (typeof id === 'string' && (COLUMN_IDS as string[]).includes(id)) return id as ColumnId
    return COLUMN_IDS.find((c) => state[c].includes(Number(id))) ?? null
  }

  function onDragStart(e: DragStartEvent) {
    const state = snapshot()
    const n = Number(e.active.id)
    const col = containerOf(n, state)
    if (!col) return
    dragOrigin.current = { column: col, index: state[col].indexOf(n) }
    setItems(state)
    setActiveId(n)
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !items) return
    const from = containerOf(active.id, items)
    const to = containerOf(over.id, items)
    if (!from || !to || from === to) return
    setItems((prev) => {
      if (!prev) return prev
      const n = Number(active.id)
      const target = prev[to]
      const overIndex = target.indexOf(Number(over.id))
      const index = overIndex >= 0 ? overIndex : target.length
      return {
        ...prev,
        [from]: prev[from].filter((x) => x !== n),
        [to]: [...target.slice(0, index), n, ...target.slice(index)],
      }
    })
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const state = items
    const origin = dragOrigin.current
    setActiveId(null)
    dragOrigin.current = null
    if (!state || !over || !origin) {
      setItems(null)
      return
    }
    const n = Number(active.id)
    const col = containerOf(active.id, state)
    if (!col) {
      setItems(null)
      return
    }
    let list = state[col]
    const overIndex = list.indexOf(Number(over.id))
    const from = list.indexOf(n)
    if (overIndex >= 0 && overIndex !== from) list = arrayMove(list, from, overIndex)
    const index = list.indexOf(n)
    setItems(null)
    if (col === origin.column && index === origin.index) return

    const prev = list[index - 1]
    const next = list[index + 1]
    const order = orderBetween(prev ? byNumber.get(prev)?.order : null, next ? byNumber.get(next)?.order : null)
    const card = byNumber.get(n)
    if (!card) return
    if (isReturn(card.column, col)) {
      setPendingReturn({ number: n, column: col, order })
      return
    }
    doMove({ number: n, column: col, order })
  }

  function doMove(p: PendingMove & { comment?: string }) {
    m.move.mutate(p, { onError: (e) => toast.error(errorMessage(e)) })
  }

  // ---------- Render ----------
  const columnCards = (c: ColumnId): Card[] =>
    items ? items[c].map((n) => byNumber.get(n)).filter((x): x is Card => !!x) : groups[c]
  const activeCard = activeId !== null ? byNumber.get(activeId) : undefined

  return (
    <div className="pb-24">
      <div className="card -mx-1 mb-4 rounded-none border-x-0 p-4 sm:mx-0 sm:rounded-xl sm:border-x">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative w-full sm:w-[400px]">
            <span className="sr-only">Buscar tarjetas</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400 sm:hidden" />
            <input
              className="input pl-9 sm:pl-4"
              placeholder="Buscar por ID (#90) o título…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn-icon" aria-label="Ideas y sugerencias" title="Ideas" onClick={() => setPanel('ideas')}>
              <Lightbulb className="h-5 w-5" />
            </button>
            <button className="btn-icon" aria-label="Historial de actividad" title="Historial" onClick={() => setPanel('activity')}>
              <History className="h-5 w-5" />
            </button>
            <div className="relative">
              <button className="btn-icon" aria-label="Más opciones" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
                <MoreVertical className="h-5 w-5" />
              </button>
              {menuOpen && (
                <BoardMenu
                  onClose={() => setMenuOpen(false)}
                  onArchived={() => setPanel('archived')}
                  onSelectVisible={() => setSelected(new Set(visible.map((c) => c.number)))}
                  onExport={() => exportJson(project.code, cards ?? [])}
                />
              )}
            </div>
            <button className="btn-icon" aria-label="Refrescar" title="Refrescar" onClick={() => refetch()}>
              <RefreshCw className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button className="btn-primary h-11 px-5 text-[15px]" aria-label="Nueva tarjeta" onClick={() => setPanel('new')}>
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nueva tarjeta</span>
            </button>
          </div>
        </div>
        <div className="mt-5 mb-2 flex items-center justify-between text-[15px]">
          <span className="font-medium">Progreso</span>
          <span className="text-gray-600">
            {stats.done} de {stats.total} terminadas · {stats.percent}%
          </span>
        </div>
        <ProgressBar value={stats.percent} />
      </div>

      {isPending ? (
        <div className="flex gap-3 overflow-hidden rounded-xl bg-board p-3">
          {COLUMNS.map((c) => <Skeleton key={c.id} className="h-[420px] min-w-[200px] flex-1 bg-white/60" />)}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setItems(null); setActiveId(null) }}>
          <div className="thin-scroll flex gap-3 overflow-x-auto rounded-xl bg-board p-3 sm:p-4">
            {COLUMNS.map((c) => (
              <BoardColumn
                key={c.id}
                id={c.id}
                name={c.name}
                bar={c.bar}
                cards={columnCards(c.id)}
                selected={selected}
                onToggleSelect={toggleSelect}
                onOpen={openCard}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCard && <CardView card={activeCard} selected={false} onToggleSelect={() => {}} onOpen={() => {}} overlay />}
          </DragOverlay>
        </DndContext>
      )}

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onApply={(op) =>
            m.bulk.mutate(
              { numbers: [...selected], op },
              {
                onSuccess: () => {
                  toast.success(`${selected.size} tarjeta(s) actualizadas.`)
                  setSelected(new Set())
                },
                onError: (e) => toast.error(errorMessage(e)),
              },
            )
          }
        />
      )}

      {openNumber !== null && byNumber.get(openNumber) && (
        <CardDetailModal
          card={byNumber.get(openNumber)!}
          onClose={() => setOpenNumber(null)}
          onNavigate={(dir) => {
            const i = navOrder.indexOf(openNumber)
            const next = navOrder[i + dir]
            if (i >= 0 && next !== undefined) setOpenNumber(next)
          }}
        />
      )}
      {panel === 'new' && <NewCardModal onClose={() => setPanel(null)} onCreated={(n) => setOpenNumber(n)} />}
      <ActivityDrawer open={panel === 'activity'} onClose={() => setPanel(null)} onOpenCard={(n) => { setPanel(null); setOpenNumber(n) }} />
      <IdeasDrawer open={panel === 'ideas'} onClose={() => setPanel(null)} cards={cards ?? []} onOpenCard={(n) => { setPanel(null); setOpenNumber(n) }} />
      <ArchivedDrawer open={panel === 'archived'} onClose={() => setPanel(null)} />
      {pendingReturn && (
        <ReturnCommentModal
          onCancel={() => setPendingReturn(null)}
          onConfirm={(comment) => {
            doMove({ ...pendingReturn, comment })
            setPendingReturn(null)
          }}
        />
      )}
    </div>
  )
}

function BoardMenu({ onClose, onArchived, onSelectVisible, onExport }: { onClose: () => void; onArchived: () => void; onSelectVisible: () => void; onExport: () => void }) {
  const item = 'block w-full px-4 py-2 text-left text-sm hover:bg-gray-50'
  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div role="menu" className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
        <button role="menuitem" className={item} onClick={run(onSelectVisible)}>Seleccionar tarjetas visibles</button>
        <button role="menuitem" className={item} onClick={run(onArchived)}>Ver archivadas</button>
        <button role="menuitem" className={item} onClick={run(onExport)}>Exportar tablero (JSON)</button>
      </div>
    </>
  )
}

function exportJson(code: string, cards: Card[]) {
  const blob = new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${code}-tablero-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
