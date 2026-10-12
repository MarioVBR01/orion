import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Card, ColumnId } from '@shared/types'
import { SortableCard } from './CardTile'

export function BoardColumn({
  id,
  name,
  bar,
  cards,
  selected,
  onToggleSelect,
  onOpen,
  action,
}: {
  action?: ReactNode
  id: ColumnId
  name: string
  bar: string
  cards: Card[]
  selected: Set<number>
  onToggleSelect: (n: number) => void
  onOpen: (n: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section
      aria-label={`Columna ${name}`}
      className={`flex max-h-[calc(100vh-220px)] min-h-[420px] w-[85vw] shrink-0 flex-col rounded-lg bg-white sm:w-[240px] lg:w-auto lg:min-w-[200px] lg:flex-1 ${
        isOver ? 'ring-2 ring-white/70' : ''
      }`}
    >
      <div className="px-3 pt-3">
        <div className={`h-1.5 rounded-full ${bar}`} />
        <div className="mt-3 mb-2 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-gray-800">{name}</h3>
          <span className="flex items-center gap-1">
            {action}
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{cards.length}</span>
          </span>
        </div>
      </div>
      <div ref={setNodeRef} className="thin-scroll flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        <SortableContext items={cards.map((c) => c.number)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <SortableCard key={c.number} card={c} selected={selected.has(c.number)} onToggleSelect={onToggleSelect} onOpen={onOpen} />
          ))}
        </SortableContext>
        {cards.length === 0 && <div className="rounded-lg border-2 border-dashed border-gray-100 py-8 text-center text-xs text-gray-300">Suelta aquí</div>}
      </div>
    </section>
  )
}
