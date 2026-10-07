import { Archive } from 'lucide-react'
import { Drawer } from '@/components/Drawer'
import { EmptyState, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { useCardMutations, useCards } from '@/lib/api'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { columnName } from '@shared/flow'

export function ArchivedDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useCurrentProject()
  const toast = useToast()
  const { data, isPending } = useCards(project.id, true)
  const { update } = useCardMutations(project.id)

  return (
    <Drawer open={open} onClose={onClose} title="Tarjetas archivadas">
      {isPending ? (
        <Skeleton className="h-40" />
      ) : !data?.length ? (
        <EmptyState icon={<Archive className="h-8 w-8" />} title="No hay tarjetas archivadas" />
      ) : (
        <ul className="divide-y divide-gray-100">
          {data.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate"><span className="text-gray-400">#{c.number}</span> {c.title}</p>
                <p className="text-xs text-gray-400">{columnName(c.column)}</p>
              </div>
              <button
                className="btn-outline py-1 text-xs"
                onClick={() =>
                  update.mutate(
                    { number: c.number, archived: false },
                    { onSuccess: () => toast.success(`#${c.number} restaurada.`), onError: (e) => toast.error(errorMessage(e)) },
                  )
                }
              >
                Restaurar
              </button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}
