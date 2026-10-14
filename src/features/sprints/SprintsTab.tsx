import { useMemo, useState, type ReactNode } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CalendarPlus, ChevronDown, ChevronRight, MoreHorizontal, Pencil, Plus, Search, Target, Trash2, X } from 'lucide-react'
import { Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { useCardMutations, useCards, useSprintMutations, useSprints } from '@/lib/api'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { CardDetailModal } from '@/features/board/CardDetailModal'
import { AssigneeChip, LabelPill, PriorityDot, TypeBadge } from '@/features/board/badges'
import { matchesSearch } from '@shared/board'
import { columnName } from '@shared/flow'
import { formatRange, openSprintsOrder, sprintDay, toIsoDate } from '@shared/sprintDates'
import { COLUMN_IDS, statusGroup, type Card, type Sprint } from '@shared/types'
import { CompleteSprintDialog, SprintFormDialog } from './SprintDialogs'

const BACKLOG = 'backlog' as const
type SectionId = number | typeof BACKLOG

/** Orden del tablero: columna y posición. */
const boardOrder = (a: Card, b: Card) =>
  COLUMN_IDS.indexOf(a.column) - COLUMN_IDS.indexOf(b.column) || (a.order < b.order ? -1 : a.order > b.order ? 1 : 0)

/** Sprints al estilo Jira: sprint activo, sprints futuros y Backlog; las tarjetas se arrastran entre ellos. */
export function SprintsTab() {
  const project = useCurrentProject()
  const toast = useToast()
  const { data: sprints, isPending: loadingSprints } = useSprints(project.id)
  const { data: cards, isPending: loadingCards } = useCards(project.id)
  const cm = useCardMutations(project.id)
  const sm = useSprintMutations(project.id)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<SectionId>>(new Set())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [openCard, setOpenCard] = useState<number | null>(null)
  const [dialog, setDialog] = useState<null | { kind: 'crear' } | { kind: 'editar' | 'iniciar' | 'completar'; sprint: Sprint }>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const visible = useMemo(() => (cards ?? []).filter((c) => matchesSearch(c, query)).sort(boardOrder), [cards, query])
  const bySection = useMemo(() => {
    const map = new Map<SectionId, Card[]>()
    for (const c of visible) {
      const key: SectionId = c.sprintId ?? BACKLOG
      map.set(key, [...(map.get(key) ?? []), c])
    }
    return map
  }, [visible])
  const allBySprint = useMemo(() => {
    const map = new Map<number, Card[]>()
    for (const c of cards ?? []) if (c.sprintId) map.set(c.sprintId, [...(map.get(c.sprintId) ?? []), c])
    return map
  }, [cards])
  const open = openSprintsOrder(sprints ?? [])
  const completed = (sprints ?? []).filter((s) => s.status === 'completado').sort((a, b) => b.number - a.number)
  const hasActive = open.some((s) => s.status === 'activo')
  const navOrder = [...open.map((s) => s.id as SectionId), BACKLOG].flatMap((k) => (bySection.get(k) ?? []).map((c) => c.number))
  const byNumber = new Map((cards ?? []).map((c) => [c.number, c]))

  const toggle = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  function moveCards(numbers: number[], sprintId: number | null) {
    cm.bulk.mutate(
      { numbers, op: { action: 'sprint', sprintId } },
      { onSuccess: () => setSelected(new Set()), onError: (e) => toast.error(errorMessage(e)) },
    )
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null)
    if (!e.over) return
    const target = e.over.id === BACKLOG ? null : Number(String(e.over.id).replace('sprint-', ''))
    const n = Number(e.active.id)
    const card = byNumber.get(n)
    if (!card || (card.sprintId ?? null) === target) return
    const numbers = selected.has(n) ? [...selected] : [n]
    moveCards(numbers, target)
  }

  if (loadingSprints || loadingCards) {
    return <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
  }

  const sectionProps = {
    project,
    collapsed,
    selected,
    onToggleCollapse: (id: SectionId) => setCollapsed((s) => toggle(s, id)),
    onToggleSelect: (n: number) => setSelected((s) => toggle(s, n)),
    onSelectAll: (ns: number[], on: boolean) =>
      setSelected((s) => {
        const next = new Set(s)
        for (const n of ns) {
          if (on) next.add(n)
          else next.delete(n)
        }
        return next
      }),
    onOpen: setOpenCard,
    onCreate: (title: string, sprintId: number | null) =>
      cm.create.mutateAsync({ title, type: 'tarea', priority: 'media', sprintId }).catch((e: unknown) => {
        toast.error(errorMessage(e))
        throw e
      }),
  }

  return (
    <div className="pb-24">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-80">
          <span className="sr-only">Buscar actividades</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar por ID (#12) o título…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <p className="text-sm text-gray-500">Arrastra actividades entre los sprints y el Backlog para planificar.</p>
      </div>

      <DndContext sensors={sensors} onDragStart={(e) => setDragging(Number(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="space-y-4">
          {open.map((s) => {
            const rows = bySection.get(s.id) ?? []
            const all = allBySprint.get(s.id) ?? []
            const day = s.status === 'activo' ? sprintDay(s, toIsoDate(new Date())) : null
            return (
              <Section
                key={s.id}
                id={s.id}
                {...sectionProps}
                cards={rows}
                totalCards={all}
                title={s.name}
                badge={s.status === 'activo' ? <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">ACTIVO</span> : null}
                dates={
                  s.startDate && s.endDate ? (
                    <span className="text-sm text-gray-500">{formatRange(s.startDate, s.endDate)}</span>
                  ) : (
                    <button className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand" onClick={() => setDialog({ kind: 'editar', sprint: s })}>
                      <CalendarPlus className="h-4 w-4" /> Añadir fechas
                    </button>
                  )
                }
                sub={
                  <>
                    {s.goal && (
                      <span className="inline-flex items-center gap-1">
                        <Target className="h-3.5 w-3.5" /> {s.goal}
                      </span>
                    )}
                    {day && day.day >= 1 && (
                      <span className={day.day > day.total ? 'text-red-600' : ''}>
                        {day.day > day.total ? `Terminó hace ${day.day - day.total} día(s)` : `Día ${day.day} de ${day.total}`}
                      </span>
                    )}
                  </>
                }
                action={
                  s.status === 'activo' ? (
                    <button className="btn-outline py-1.5" onClick={() => setDialog({ kind: 'completar', sprint: s })}>Completar sprint</button>
                  ) : (
                    <button
                      className="btn-outline py-1.5"
                      disabled={hasActive}
                      title={hasActive ? 'Ya hay un sprint activo' : undefined}
                      onClick={() => setDialog({ kind: 'iniciar', sprint: s })}
                    >
                      Iniciar sprint
                    </button>
                  )
                }
                menu={[
                  { label: 'Editar sprint', icon: <Pencil className="h-4 w-4" />, onClick: () => setDialog({ kind: 'editar', sprint: s }) },
                  {
                    label: 'Eliminar sprint',
                    icon: <Trash2 className="h-4 w-4" />,
                    danger: true,
                    onClick: () => {
                      if (!confirm(`¿Eliminar ${s.name}? Sus actividades vuelven al Backlog.`)) return
                      sm.remove.mutate(s.id, { onError: (e) => toast.error(errorMessage(e)) })
                    },
                  },
                ]}
                empty="Planifica un sprint arrastrando actividades hasta él."
              />
            )
          })}

          <Section
            id={BACKLOG}
            {...sectionProps}
            cards={bySection.get(BACKLOG) ?? []}
            totalCards={(cards ?? []).filter((c) => !c.sprintId)}
            title="Backlog"
            action={
              <button className="btn-outline py-1.5" onClick={() => setDialog({ kind: 'crear' })}>
                Crear sprint
              </button>
            }
            empty="El Backlog está vacío."
          />
        </div>
        <DragOverlay>
          {dragging !== null && byNumber.get(dragging) && (
            <div className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm shadow-xl">
              {selected.has(dragging) && selected.size > 1 ? `${selected.size} actividades` : byNumber.get(dragging)!.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <p className="mt-4 text-right text-sm text-gray-500">
        {visible.length} de {cards?.length ?? 0} actividades visibles
      </p>

      {completed.length > 0 && (
        <section className="mt-6">
          <button className="flex items-center gap-1 text-sm font-semibold text-gray-600" onClick={() => setShowCompleted((v) => !v)}>
            {showCompleted ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Sprints completados ({completed.length})
          </button>
          {showCompleted && (
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {completed.map((s) => {
                const all = allBySprint.get(s.id) ?? []
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <span className="font-semibold">{s.name}</span>
                    {s.startDate && s.endDate && <span className="text-gray-500">{formatRange(s.startDate, s.endDate)}</span>}
                    {s.goal && <span className="truncate text-gray-500">· {s.goal}</span>}
                    <span className="ml-auto text-gray-500">{all.filter((c) => c.column === 'hecho').length} terminadas</span>
                    <Counts cards={all} />
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div role="toolbar" aria-label="Acciones sobre actividades" className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-xl">
            <span className="text-sm font-semibold">{selected.size} seleccionada(s)</span>
            <select
              aria-label="Mover a sprint"
              className="input w-auto py-1.5"
              value=""
              onChange={(e) => e.target.value && moveCards([...selected], e.target.value === BACKLOG ? null : Number(e.target.value))}
            >
              <option value="">Mover a…</option>
              {open.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value={BACKLOG}>Backlog</option>
            </select>
            <button aria-label="Cancelar selección" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" onClick={() => setSelected(new Set())}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {openCard !== null && byNumber.get(openCard) && (
        <CardDetailModal
          card={byNumber.get(openCard)!}
          onClose={() => setOpenCard(null)}
          onNavigate={(dir) => {
            const i = navOrder.indexOf(openCard)
            const next = navOrder[i + dir]
            if (i >= 0 && next !== undefined) setOpenCard(next)
          }}
        />
      )}
      {dialog?.kind === 'crear' && <SprintFormDialog mode="crear" onClose={() => setDialog(null)} />}
      {(dialog?.kind === 'editar' || dialog?.kind === 'iniciar') && <SprintFormDialog mode={dialog.kind} sprint={dialog.sprint} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'completar' && (
        <CompleteSprintDialog sprint={dialog.sprint} cards={allBySprint.get(dialog.sprint.id) ?? []} sprints={sprints ?? []} onClose={() => setDialog(null)} />
      )}
    </div>
  )
}

/** Contadores estilo Jira: por hacer (gris), en curso (azul), hecho (verde). */
function Counts({ cards }: { cards: Card[] }) {
  const n = { todo: 0, doing: 0, done: 0 }
  for (const c of cards) n[statusGroup(c.column)]++
  const box = 'min-w-[22px] rounded px-1.5 py-0.5 text-center text-xs font-semibold'
  return (
    <span className="flex items-center gap-1" title={`${n.todo} por hacer · ${n.doing} en curso · ${n.done} hechas`}>
      <span className={`${box} bg-gray-200 text-gray-700`}>{n.todo}</span>
      <span className={`${box} bg-blue-100 text-blue-700`}>{n.doing}</span>
      <span className={`${box} bg-green-100 text-green-700`}>{n.done}</span>
    </span>
  )
}

interface MenuItem {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}

function Section({
  id,
  project,
  title,
  badge,
  dates,
  sub,
  action,
  menu,
  cards,
  totalCards,
  empty,
  collapsed,
  selected,
  onToggleCollapse,
  onToggleSelect,
  onSelectAll,
  onOpen,
  onCreate,
}: {
  id: SectionId
  project: { code: string }
  title: string
  badge?: ReactNode
  dates?: ReactNode
  sub?: ReactNode
  action?: ReactNode
  menu?: MenuItem[]
  cards: Card[]
  totalCards: Card[]
  empty: string
  collapsed: Set<SectionId>
  selected: Set<number>
  onToggleCollapse: (id: SectionId) => void
  onToggleSelect: (n: number) => void
  onSelectAll: (ns: number[], on: boolean) => void
  onOpen: (n: number) => void
  onCreate: (title: string, sprintId: number | null) => Promise<unknown>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: id === BACKLOG ? BACKLOG : `sprint-${id}` })
  const [menuOpen, setMenuOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const isCollapsed = collapsed.has(id)
  const numbers = cards.map((c) => c.number)
  const allSelected = numbers.length > 0 && numbers.every((n) => selected.has(n))

  async function create() {
    if (!draft.trim()) return
    await onCreate(draft.trim(), id === BACKLOG ? null : id)
    setDraft('')
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={`rounded-xl border bg-white p-3 transition-colors ${isOver ? 'border-brand bg-blue-50/40' : 'border-gray-200'}`}
    >
      <header className="flex flex-wrap items-center gap-2 px-1">
        <input
          type="checkbox"
          aria-label={`Seleccionar todas las actividades de ${title}`}
          className="h-4 w-4 accent-brand"
          checked={allSelected}
          disabled={!numbers.length}
          onChange={() => onSelectAll(numbers, !allSelected)}
        />
        <button aria-label={isCollapsed ? `Expandir ${title}` : `Contraer ${title}`} className="rounded p-0.5 text-gray-500 hover:bg-gray-100" onClick={() => onToggleCollapse(id)}>
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <h3 className="font-semibold">{title}</h3>
        {badge}
        {dates}
        <span className="text-sm text-gray-500">({totalCards.length} {totalCards.length === 1 ? 'actividad' : 'actividades'})</span>
        <span className="ml-auto flex items-center gap-2">
          <Counts cards={totalCards} />
          {action}
          {menu && (
            <span className="relative">
              <button aria-label={`Opciones de ${title}`} aria-expanded={menuOpen} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" onClick={() => setMenuOpen((v) => !v)}>
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {menuOpen && (
                <>
                  <span className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <span role="menu" className="absolute right-0 z-40 mt-1 block w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                    {menu.map((m) => (
                      <button
                        key={m.label}
                        role="menuitem"
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${m.danger ? 'text-red-600' : ''}`}
                        onClick={() => {
                          setMenuOpen(false)
                          m.onClick()
                        }}
                      >
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </span>
                </>
              )}
            </span>
          )}
        </span>
      </header>
      {sub && <div className="mt-1 flex flex-wrap gap-3 px-8 text-xs text-gray-500">{sub}</div>}

      {!isCollapsed && (
        <div className="mt-2">
          {cards.length ? (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {cards.map((c) => (
                <Row key={c.id} card={c} code={project.code} selected={selected.has(c.number)} onToggle={onToggleSelect} onOpen={onOpen} />
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-200 py-5 text-center text-sm text-gray-400">{empty}</div>
          )}
          {creating ? (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void create()
              }}
            >
              <input
                autoFocus
                aria-label="Título de la nueva actividad"
                className="input py-1.5"
                placeholder="¿Qué hay que hacer?"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
              />
              <button className="btn-primary py-1.5" disabled={!draft.trim()}>Crear</button>
              <button type="button" className="btn-outline py-1.5" onClick={() => setCreating(false)}>Cancelar</button>
            </form>
          ) : (
            <button
              aria-label={`Crear actividad en ${title}`}
              className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-4 w-4" /> Crear
            </button>
          )}
        </div>
      )}
    </section>
  )
}

const LOZENGE: Record<ReturnType<typeof statusGroup>, string> = {
  todo: 'bg-gray-100 text-gray-700',
  doing: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

function Row({ card, code, selected, onToggle, onOpen }: { card: Card; code: string; selected: boolean; onToggle: (n: number) => void; onOpen: (n: number) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.number })
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${code}-${card.number}: ${card.title}. Arrastra para moverla a otro sprint`}
      className={`flex cursor-grab items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 ${isDragging ? 'opacity-40' : ''} ${selected ? 'bg-blue-50/60' : ''}`}
    >
      <input
        type="checkbox"
        aria-label={`Seleccionar ${code}-${card.number}`}
        className="h-4 w-4 accent-brand"
        checked={selected}
        onChange={() => onToggle(card.number)}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <span className="hidden sm:block"><TypeBadge type={card.type} /></span>
      <span className={`shrink-0 text-xs text-gray-500 ${card.column === 'hecho' ? 'line-through' : ''}`}>{code}-{card.number}</span>
      <button className="min-w-0 flex-1 truncate text-left hover:text-brand hover:underline" onClick={() => onOpen(card.number)}>
        {card.title}
      </button>
      <span className="hidden gap-1 md:flex">{card.labels.slice(0, 2).map((l) => <LabelPill key={l} label={l} />)}</span>
      <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${LOZENGE[statusGroup(card.column)]}`}>{columnName(card.column)}</span>
      <PriorityDot priority={card.priority} />
      <span className="hidden w-20 justify-end sm:flex"><AssigneeChip assignee={card.assignee} /></span>
    </li>
  )
}
