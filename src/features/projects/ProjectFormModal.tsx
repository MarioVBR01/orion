import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui'

export const PROJECT_COLORS = ['#2563EB', '#5B9A2F', '#DC2626', '#EA580C', '#9333EA', '#0891B2', '#DB2777', '#475569']

export interface ProjectFormValues {
  name: string
  code: string
  description: string
  color: string
}

export function ProjectFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  title,
  submitLabel,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (v: ProjectFormValues) => Promise<void>
  initial?: ProjectFormValues
  title: string
  submitLabel: string
}) {
  const empty: ProjectFormValues = { name: '', code: '', description: '', color: PROJECT_COLORS[0]! }
  const [values, setValues] = useState<ProjectFormValues>(initial ?? empty)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setValues(initial ?? empty)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handle(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSubmit(values)
    } finally {
      setBusy(false)
    }
  }

  const set = <K extends keyof ProjectFormValues>(k: K, v: ProjectFormValues[K]) => setValues((p) => ({ ...p, [k]: v }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn-outline" onClick={onClose} type="button">Cancelar</button>
          <button className="btn-primary" type="submit" form="project-form" disabled={busy}>
            {busy ? 'Guardando…' : submitLabel}
          </button>
        </>
      }
    >
      <form id="project-form" onSubmit={handle} className="space-y-4">
        <div>
          <label className="label" htmlFor="p-name">Nombre</label>
          <input id="p-name" required maxLength={60} className="input" value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="LaGuardiaGO" />
        </div>
        <div>
          <label className="label" htmlFor="p-code">Prefijo de código</label>
          <input
            id="p-code"
            required
            maxLength={6}
            pattern="[A-Za-z0-9]{2,6}"
            title="De 2 a 6 letras o números"
            className="input uppercase"
            value={values.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())}
            placeholder="LGG"
          />
        </div>
        <div>
          <label className="label" htmlFor="p-desc">Descripción</label>
          <textarea id="p-desc" rows={3} className="input" value={values.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <fieldset>
          <legend className="label">Color</legend>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={values.color === c}
                onClick={() => set('color', c)}
                className={`h-8 w-8 rounded-full ring-offset-2 ${values.color === c ? 'ring-2 ring-gray-900' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}
