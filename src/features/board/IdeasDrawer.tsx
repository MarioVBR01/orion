import { useState, type FormEvent } from 'react'
import { Lightbulb } from 'lucide-react'
import { Drawer } from '@/components/Drawer'
import { EmptyState } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { useCardMutations } from '@/lib/api'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { columnName } from '@shared/flow'
import type { Card } from '@shared/types'

export const IDEA_LABEL = 'idea'

/** 💡 Captura rápida de ideas: tarjetas de Backlog con la etiqueta "idea". */
export function IdeasDrawer({ open, onClose, cards, onOpenCard }: { open: boolean; onClose: () => void; cards: Card[]; onOpenCard: (n: number) => void }) {
  const project = useCurrentProject()
  const toast = useToast()
  const { create } = useCardMutations(project.id)
  const [text, setText] = useState('')
  const ideas = cards.filter((c) => c.labels.includes(IDEA_LABEL))

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      await create.mutateAsync({ title: text.trim(), type: 'historia', priority: 'baja', column: 'backlog', labels: [IDEA_LABEL] })
      setText('')
      toast.success('Idea guardada en Backlog.')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Ideas y sugerencias">
      <form onSubmit={add} className="mb-5 flex gap-2">
        <input aria-label="Nueva idea" className="input" placeholder="Anota una idea…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary" disabled={create.isPending || !text.trim()}>Guardar</button>
      </form>
      {!ideas.length ? (
        <EmptyState icon={<Lightbulb className="h-8 w-8" />} title="Sin ideas" text={`Se guardan como tarjetas en Backlog con la etiqueta "${IDEA_LABEL}".`} />
      ) : (
        <ul className="space-y-2">
          {ideas.map((c) => (
            <li key={c.id}>
              <button className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => onOpenCard(c.number)}>
                <span className="text-gray-400">#{c.number}</span> {c.title}
                <span className="block text-xs text-gray-400">{columnName(c.column)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}
