import { History } from 'lucide-react'
import { Drawer } from '@/components/Drawer'
import { EmptyState, Skeleton } from '@/components/ui'
import { useActivity } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { describeHistory } from './historyText'

export function ActivityDrawer({ open, onClose, onOpenCard }: { open: boolean; onClose: () => void; onOpenCard: (n: number) => void }) {
  const project = useCurrentProject()
  const { data, isPending } = useActivity(project.id, open)
  return (
    <Drawer open={open} onClose={onClose} title="Historial de actividad">
      {isPending ? (
        <Skeleton className="h-60" />
      ) : !data?.length ? (
        <EmptyState icon={<History className="h-8 w-8" />} title="Sin actividad todavía" />
      ) : (
        <ol className="space-y-4">
          {data.map((h) => (
            <li key={h.id} className="text-sm">
              <p>
                <span className="font-medium">{h.actor}</span> {describeHistory(h)}
              </p>
              {h.action === 'movida' && h.detail && <p className="mt-0.5 text-gray-600 italic">“{h.detail}”</p>}
              <button className="mt-0.5 block truncate text-left text-xs text-brand hover:underline" onClick={() => onOpenCard(h.cardNumber)}>
                #{h.cardNumber} {h.cardTitle}
              </button>
              <p className="text-xs text-gray-400">{formatDateTime(new Date(h.at))}</p>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  )
}
