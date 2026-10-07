import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Archive, ChevronLeft, ChevronRight, GitBranch, GitCommit, GitPullRequest, Plus, Trash2, X } from 'lucide-react'
import { Gallery } from '@/components/Attachments'
import { Markdown } from '@/components/Markdown'
import { ReportEditor, ReportView, emptyReport } from '@/components/ReportEditor'
import { errorMessage, useToast } from '@/components/Toast'
import { useCardHistory, useCardMutations, useComments, usePeople } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { isReturn } from '@shared/flow'
import {
  CARD_TYPES,
  CLAUDE,
  COLUMNS,
  PRIORITIES,
  PRIORITY_LABEL,
  TYPE_LABEL,
  type AcceptanceItem,
  type Card,
  type CardPatch,
  type CardType,
  type ColumnId,
  type Priority,
  type Report,
} from '@shared/types'
import { PriorityDot, TypeBadge } from './badges'
import { AssigneeSelect, LabelsInput } from './fields'
import { describeHistory } from './historyText'
import { ReturnCommentModal } from './ReturnCommentModal'

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

export function CardDetailModal({ card, onClose, onNavigate }: { card: Card; onClose: () => void; onNavigate: (dir: -1 | 1) => void }) {
  // Esc cierra; ←/→ navega entre tarjetas (si no se está escribiendo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-nested-modal]')) onClose()
      if (isTyping(e.target)) return
      if (e.key === 'ArrowLeft') onNavigate(-1)
      if (e.key === 'ArrowRight') onNavigate(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNavigate])

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Tarjeta #${card.number}`}
        className="flex max-h-full w-full flex-col overflow-hidden bg-white shadow-xl sm:max-h-[92vh] sm:max-w-5xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* key: al navegar a otra tarjeta se reinician los borradores */}
        <CardDetail key={card.number} card={card} onClose={onClose} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

function CardDetail({ card, onClose, onNavigate }: { card: Card; onClose: () => void; onNavigate: (dir: -1 | 1) => void }) {
  const project = useCurrentProject()
  const toast = useToast()
  const m = useCardMutations(project.id)
  const [title, setTitle] = useState(card.title)
  const [pendingReturn, setPendingReturn] = useState<ColumnId | null>(null)

  const save = (patch: CardPatch, ok?: string) =>
    m.update.mutate(
      { number: card.number, ...patch },
      { onSuccess: () => ok && toast.success(ok), onError: (e) => toast.error(errorMessage(e)) },
    )

  const move = (column: ColumnId, comment?: string) =>
    m.move.mutate({ number: card.number, column, comment }, { onError: (e) => toast.error(errorMessage(e)) })

  return (
    <>
      <header className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
        <span className="text-sm text-gray-400">#{card.number}</span>
        <TypeBadge type={card.type} />
        <PriorityDot priority={card.priority} />
        <div className="ml-auto flex items-center gap-1">
          <button aria-label="Tarjeta anterior (←)" title="Anterior (←)" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" onClick={() => onNavigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button aria-label="Tarjeta siguiente (→)" title="Siguiente (→)" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" onClick={() => onNavigate(1)}>
            <ChevronRight className="h-5 w-5" />
          </button>
          <button aria-label="Cerrar (Esc)" title="Cerrar (Esc)" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="grid flex-1 overflow-y-auto md:grid-cols-[1fr_300px]">
        <div className="space-y-6 p-5">
          <input
            aria-label="Título"
            className="w-full rounded-lg border border-transparent px-2 py-1 text-xl font-semibold hover:border-gray-200 focus:border-brand focus:outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== card.title && save({ title: title.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />

          <Section title="Etiquetas">
            <LabelsInput value={card.labels} onChange={(labels) => save({ labels })} />
          </Section>

          <DescriptionEditor value={card.descriptionMd} onSave={(descriptionMd) => save({ descriptionMd }, 'Descripción guardada.')} />

          <ReportSection report={card.report} onSave={(report) => save({ report }, 'Reporte guardado.')} />

          <AcceptanceEditor items={card.acceptance} onChange={(acceptance) => save({ acceptance })} />

          {card.attachments.length > 0 && (
            <Section title="Adjuntos">
              <Gallery attachments={card.attachments} />
            </Section>
          )}

          <CommentsSection number={card.number} />
        </div>

        <aside className="space-y-5 border-t border-gray-100 bg-gray-50/60 p-5 md:border-t-0 md:border-l">
          <Field label="Columna" htmlFor="cd-col">
            <select
              id="cd-col"
              className="input"
              value={card.column}
              onChange={(e) => {
                const to = e.target.value as ColumnId
                if (isReturn(card.column, to)) setPendingReturn(to)
                else move(to)
              }}
            >
              {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo" htmlFor="cd-type">
              <select id="cd-type" className="input" value={card.type} onChange={(e) => save({ type: e.target.value as CardType })}>
                {CARD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </Field>
            <Field label="Prioridad" htmlFor="cd-prio">
              <select id="cd-prio" className="input" value={card.priority} onChange={(e) => save({ priority: e.target.value as Priority })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Asignado" htmlFor="cd-assignee">
            <AssigneeSelect id="cd-assignee" value={card.assignee} onChange={(assignee) => save({ assignee })} />
          </Field>

          <div className="space-y-2">
            <p className="label mb-0">Trabajo</p>
            <WorkInput icon={<GitBranch className="h-4 w-4" />} label="Rama" value={card.branch} onSave={(branch) => save({ branch })} />
            <WorkInput icon={<GitCommit className="h-4 w-4" />} label="Commit" value={card.commitSha} onSave={(commitSha) => save({ commitSha })} />
            <WorkInput icon={<GitPullRequest className="h-4 w-4" />} label="PR (URL)" value={card.prUrl} onSave={(prUrl) => save({ prUrl })} />
          </div>

          <div className="space-y-1 text-xs text-gray-500">
            <p>Creada por <span className="font-medium text-gray-700">{card.createdBy}</span></p>
            <p>{formatDateTime(new Date(card.createdAt))}</p>
            <p>Actualizada {formatDateTime(new Date(card.updatedAt))}</p>
            {card.sourceObservationIds.length > 0 && <p>Origen: observaciones {card.sourceObservationIds.map((id) => `#${id}`).join(', ')}</p>}
          </div>

          <button
            className="btn-outline w-full"
            onClick={() => {
              if (!confirm(`¿Archivar la tarjeta #${card.number}?`)) return
              save({ archived: true }, `#${card.number} archivada.`)
              onClose()
            }}
          >
            <Archive className="h-4 w-4" /> Archivar
          </button>

          <HistoryList number={card.number} />
        </aside>
      </div>

      {pendingReturn && (
        <div data-nested-modal>
          <ReturnCommentModal
            onCancel={() => setPendingReturn(null)}
            onConfirm={(comment) => {
              move(pendingReturn, comment)
              setPendingReturn(null)
            }}
          />
        </div>
      )}
    </>
  )
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  )
}

function WorkInput({ icon, label, value, onSave }: { icon: ReactNode; label: string; value: string | null; onSave: (v: string | null) => void }) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  return (
    <label className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-brand">
      <span className="text-gray-400" aria-hidden>{icon}</span>
      <span className="sr-only">{label}</span>
      <input
        className="w-full border-0 bg-transparent py-2 text-sm outline-none"
        placeholder={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => (draft.trim() || null) !== value && onSave(draft.trim() || null)}
      />
    </label>
  )
}

function DescriptionEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  return (
    <Section
      title="Descripción"
      action={
        !editing && (
          <button className="text-sm text-brand hover:underline" onClick={() => { setDraft(value); setEditing(true) }}>
            Editar
          </button>
        )
      }
    >
      {editing ? (
        <div className="space-y-2">
          <div className="grid gap-3 lg:grid-cols-2">
            <textarea aria-label="Descripción en Markdown" autoFocus rows={12} className="input font-mono text-[13px]" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="max-h-[300px] overflow-y-auto rounded-lg border border-gray-200 p-3">
              {draft.trim() ? <Markdown>{draft}</Markdown> : <p className="text-sm text-gray-400">Vista previa</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setEditing(false)}>Cancelar</button>
            <button className="btn-primary" onClick={() => { onSave(draft); setEditing(false) }}>Guardar</button>
          </div>
        </div>
      ) : value.trim() ? (
        <Markdown>{value}</Markdown>
      ) : (
        <button className="w-full rounded-lg border border-dashed border-gray-300 py-4 text-sm text-gray-400 hover:bg-gray-50" onClick={() => setEditing(true)}>
          Agregar descripción…
        </button>
      )}
    </Section>
  )
}

function ReportSection({ report, onSave }: { report: Report | null; onSave: (r: Report | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Report>(report ?? emptyReport())
  if (!report && !editing) {
    return (
      <button className="text-sm text-brand hover:underline" onClick={() => { setDraft(emptyReport()); setEditing(true) }}>
        + Agregar reporte (¿Dónde? / ¿Qué hice? / ¿Qué esperaba? / ¿Qué pasó?)
      </button>
    )
  }
  return (
    <Section
      title="Reporte"
      action={!editing && <button className="text-sm text-brand hover:underline" onClick={() => { setDraft(report ?? emptyReport()); setEditing(true) }}>Editar</button>}
    >
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            onSave({ ...draft, steps: draft.steps.filter((s) => s.trim()) })
            setEditing(false)
          }}
        >
          <ReportEditor value={draft} onChange={setDraft} idPrefix="cd-rep" />
          <div className="flex justify-end gap-2">
            {report && (
              <button type="button" className="btn-outline mr-auto text-red-600" onClick={() => { onSave(null); setEditing(false) }}>
                Quitar reporte
              </button>
            )}
            <button type="button" className="btn-outline" onClick={() => setEditing(false)}>Cancelar</button>
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      ) : (
        report && <ReportView report={report} />
      )}
    </Section>
  )
}

function AcceptanceEditor({ items, onChange }: { items: AcceptanceItem[]; onChange: (v: AcceptanceItem[]) => void }) {
  const [draft, setDraft] = useState('')
  const done = items.filter((i) => i.done).length
  return (
    <Section title={`Criterios de aceptación${items.length ? ` (${done}/${items.length})` : ''}`}>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="group flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-green-600"
              checked={it.done}
              aria-label={it.text}
              onChange={() => onChange(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
            />
            <span className={`flex-1 text-sm ${it.done ? 'text-gray-400 line-through' : ''}`}>{it.text}</span>
            <button aria-label={`Quitar criterio ${it.text}`} className="text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          onChange([...items, { text: draft.trim(), done: false }])
          setDraft('')
        }}
      >
        <input aria-label="Nuevo criterio" className="input py-1.5" placeholder="Nuevo criterio…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn-outline py-1.5" aria-label="Agregar criterio"><Plus className="h-4 w-4" /></button>
      </form>
    </Section>
  )
}

function CommentsSection({ number }: { number: number }) {
  const project = useCurrentProject()
  const toast = useToast()
  const { data: comments } = useComments(project.id, number)
  const { data: people } = usePeople(project.id)
  const { comment } = useCardMutations(project.id)
  const [text, setText] = useState('')
  const names = useMemo(() => [CLAUDE, ...(people ?? []).map((p) => p.name)], [people])

  // Autocompletado de @menciones: palabra que empieza con @ al final del texto.
  const mentionQuery = /(?:^|\s)@([^\s@]*)$/.exec(text)?.[1]
  const suggestions = mentionQuery !== undefined ? names.filter((n) => n.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5) : []

  async function send() {
    if (!text.trim()) return
    try {
      await comment.mutateAsync({ number, text })
      setText('')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <Section title="Comentarios">
      <ul className="space-y-3">
        {comments?.map((c) => (
          <li key={c.id} className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">{c.author}</span> · {formatDateTime(new Date(c.createdAt))}
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{highlightMentions(c.text, names)}</p>
          </li>
        ))}
      </ul>
      <div className="relative mt-3">
        <textarea
          aria-label="Nuevo comentario"
          rows={2}
          className="input"
          placeholder="Escribe un comentario… usa @ para mencionar (Ctrl+Enter envía)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send()
          }}
        />
        {suggestions.length > 0 && (
          <ul className="absolute bottom-full left-0 z-10 mb-1 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg" role="listbox">
            {suggestions.map((n) => (
              <li key={n}>
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  onClick={() => setText((t) => t.replace(/@([^\s@]*)$/, `@${n} `))}
                >
                  @{n}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex justify-end">
          <button className="btn-primary" disabled={!text.trim() || comment.isPending} onClick={() => void send()}>Comentar</button>
        </div>
      </div>
    </Section>
  )
}

function highlightMentions(text: string, names: string[]): ReactNode[] {
  if (!names.length) return [text]
  const escaped = [...names].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(@(?:${escaped.join('|')}))`, 'gi')
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="rounded bg-blue-50 px-0.5 font-medium text-brand">{part}</span>
    ) : (
      part
    ),
  )
}

function HistoryList({ number }: { number: number }) {
  const project = useCurrentProject()
  const { data } = useCardHistory(project.id, number)
  return (
    <div>
      <p className="label">Historial</p>
      <ol className="space-y-2 border-l border-gray-200 pl-3">
        {data?.map((h) => (
          <li key={h.id} className="text-xs">
            <p><span className="font-medium">{h.actor}</span> {describeHistory(h)}</p>
            <p className="text-gray-400">{formatDateTime(new Date(h.at))}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
