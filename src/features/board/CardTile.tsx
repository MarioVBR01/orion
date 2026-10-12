import { memo, type CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card } from '@shared/types'
import { formatDateTime } from '@/lib/format'
import { AssigneeChip, LabelPill, PriorityDot, TypeBadge } from './badges'

interface TileProps {
  card: Card
  selected: boolean
  onToggleSelect: (n: number) => void
  onOpen: (n: number) => void
  dragging?: boolean
  overlay?: boolean
}

/** Tarjeta visual (sin lógica de arrastre). */
export const CardView = memo(function CardView({ card, selected, onToggleSelect, onOpen, dragging, overlay }: TileProps) {
  return (
    <div
      className={`rounded-lg border-l-4 border-l-blue-600 bg-white p-3 shadow-sm ring-1 ring-gray-200 transition-shadow ${
        overlay ? 'rotate-1 shadow-xl ring-2 ring-blue-300' : 'hover:shadow-md'
      } ${dragging ? 'opacity-40' : ''} ${selected ? 'ring-2 ring-brand' : ''}`}
    >
      {card.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {card.labels.map((l) => <LabelPill key={l} label={l} />)}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          aria-label={`Seleccionar tarjeta #${card.number}`}
          className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-brand"
          checked={selected}
          onChange={() => onToggleSelect(card.number)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
        <TypeBadge type={card.type} />
        <span className="ml-auto text-xs text-gray-400">#{card.number}</span>
      </div>
      <button
        type="button"
        className="mt-2 block w-full text-left text-[15px] leading-snug text-gray-900 hover:text-brand"
        onClick={() => onOpen(card.number)}
      >
        {card.title} <PriorityDot priority={card.priority} />
      </button>
      <div className="mt-2 flex items-center gap-2">
        <span className="truncate text-xs text-gray-400">Por {card.createdBy}</span>
        <span className="ml-auto flex items-center gap-1">
          {card.exportedAt && (
            <span
              title={`Exportada a .md el ${formatDateTime(new Date(card.exportedAt))}`}
              className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700"
            >
              .md
            </span>
          )}
          <AssigneeChip assignee={card.assignee} />
        </span>
      </div>
    </div>
  )
})

/** Tarjeta arrastrable dentro de una columna. */
export function SortableCard(props: Omit<TileProps, 'dragging' | 'overlay'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.card.number })
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={`Tarjeta #${props.card.number}: ${props.card.title}. Arrastra para mover`}
      className="cursor-grab touch-manipulation active:cursor-grabbing"
    >
      <CardView {...props} dragging={isDragging} />
    </div>
  )
}
