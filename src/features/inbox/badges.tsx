import { KIND_EMOJI, KIND_LABEL, STATUS_LABEL, type ObservationKind, type ObservationStatus } from '@shared/types'

const KIND_CLS: Record<ObservationKind, string> = {
  bug: 'bg-red-50 text-red-700',
  mejora: 'bg-amber-50 text-amber-700',
  duda: 'bg-sky-50 text-sky-700',
}

export function KindBadge({ kind }: { kind: ObservationKind }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] ${KIND_CLS[kind]}`}>
      <span aria-hidden>{KIND_EMOJI[kind]}</span> {KIND_LABEL[kind]}
    </span>
  )
}

const STATUS_CLS: Record<ObservationStatus, string> = {
  pendiente: 'bg-gray-100 text-gray-700',
  info: 'bg-amber-100 text-amber-800',
  en_backlog: 'bg-green-100 text-green-800',
  rechazada: 'bg-red-100 text-red-700',
}

export function StatusPill({ status }: { status: ObservationStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLS[status]}`}>{STATUS_LABEL[status]}</span>
}
