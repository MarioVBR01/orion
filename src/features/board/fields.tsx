import { useState } from 'react'
import { usePeople } from '@/lib/api'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { CLAUDE } from '@shared/types'
import { LabelPill } from './badges'

/** Selector de asignado: personas del proyecto, Claude o nadie. */
export function AssigneeSelect({ id, value, onChange }: { id?: string; value: string | null; onChange: (v: string | null) => void }) {
  const project = useCurrentProject()
  const { data: people } = usePeople(project.id)
  const known = value === null || value === CLAUDE || people?.some((p) => p.name === value)
  return (
    <select id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Sin asignar</option>
      <option value={CLAUDE}>🤖 claude (Claude Code)</option>
      {people?.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
      {!known && value && <option value={value}>{value}</option>}
    </select>
  )
}

/** Editor de etiquetas: Enter o coma agrega, × quita. */
export function LabelsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const l = draft.trim().replace(/,$/, '')
    if (l && !value.includes(l)) onChange([...value, l])
    setDraft('')
  }
  return (
    <div className="flex min-h-[42px] flex-wrap items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
      {value.map((l) => <LabelPill key={l} label={l} onRemove={() => onChange(value.filter((x) => x !== l))} />)}
      <input
        aria-label="Nueva etiqueta"
        className="min-w-[80px] flex-1 border-0 bg-transparent p-1 text-sm outline-none"
        placeholder={value.length ? '' : 'DIR-TEC, frontend…'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={add}
      />
    </div>
  )
}
