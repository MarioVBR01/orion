import { BookOpen, Bot, Bug, ClipboardList } from 'lucide-react'
import { CLAUDE, PRIORITY_LABEL, TYPE_LABEL, type CardType, type Priority } from '@shared/types'

const TYPE_STYLE: Record<CardType, { cls: string; Icon: typeof Bug }> = {
  tarea: { cls: 'bg-blue-50 text-blue-700', Icon: ClipboardList },
  bug: { cls: 'bg-red-50 text-red-700', Icon: Bug },
  historia: { cls: 'bg-emerald-50 text-emerald-700', Icon: BookOpen },
}

export function TypeBadge({ type }: { type: CardType }) {
  const { cls, Icon } = TYPE_STYLE[type]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {TYPE_LABEL[type]}
    </span>
  )
}

const PRIORITY_DOT: Record<Priority, string> = {
  alta: 'bg-red-500',
  media: 'bg-orange-400',
  baja: 'bg-yellow-400',
}

export function PriorityDot({ priority }: { priority: Priority }) {
  return (
    <span
      title={`Prioridad ${PRIORITY_LABEL[priority].toLowerCase()}`}
      aria-label={`Prioridad ${PRIORITY_LABEL[priority].toLowerCase()}`}
      className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full align-middle shadow-inner ${PRIORITY_DOT[priority]}`}
    />
  )
}

export function LabelPill({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-[#0B6FB8] px-2 py-0.5 text-[11px] font-medium text-white">
      <span className="truncate">{label}</span>
      {onRemove && (
        <button type="button" aria-label={`Quitar etiqueta ${label}`} onClick={onRemove} className="opacity-80 hover:opacity-100">
          ×
        </button>
      )}
    </span>
  )
}

export function AssigneeChip({ assignee }: { assignee: string | null }) {
  if (!assignee) return null
  if (assignee === CLAUDE) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700">
        <Bot className="h-3 w-3" aria-hidden /> claude
      </span>
    )
  }
  return <span className="truncate rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{assignee}</span>
}
