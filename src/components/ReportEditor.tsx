import type { ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import type { Report } from '@shared/types'

export const emptyReport = (): Report => ({ where: '', steps: [''], expected: '', actual: '' })

/** Bloques fijos del reporte: ¿Dónde? / ¿Qué hice? / ¿Qué esperaba? / ¿Qué pasó? */
export function ReportEditor({ value, onChange, required = false, idPrefix = 'rep' }: { value: Report; onChange: (r: Report) => void; required?: boolean; idPrefix?: string }) {
  const set = <K extends keyof Report>(k: K, v: Report[K]) => onChange({ ...value, [k]: v })
  const steps = value.steps.length ? value.steps : ['']

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor={`${idPrefix}-where`}>¿Dónde?</label>
        <input
          id={`${idPrefix}-where`}
          required={required}
          className="input"
          placeholder="Pantalla o ruta. Ej.: Checkout → paso 2 (Pago)"
          value={value.where}
          onChange={(e) => set('where', e.target.value)}
        />
      </div>

      <fieldset>
        <legend className="label">¿Qué hice?</legend>
        <p className="-mt-0.5 mb-2 text-xs text-gray-500">Pasos numerados: dispositivo, inicio de sesión, navegación hasta el punto.</p>
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-sm text-gray-500">{i + 1}.</span>
              <input
                aria-label={`Paso ${i + 1}`}
                required={required && i === 0}
                className="input"
                value={s}
                onChange={(e) => set('steps', steps.map((x, j) => (j === i ? e.target.value : x)))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    set('steps', [...steps.slice(0, i + 1), '', ...steps.slice(i + 1)])
                  }
                }}
              />
              {steps.length > 1 && (
                <button type="button" aria-label={`Quitar paso ${i + 1}`} className="rounded p-1 text-gray-400 hover:text-red-600" onClick={() => set('steps', steps.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ol>
        <button type="button" className="mt-2 inline-flex items-center gap-1 text-sm text-brand hover:underline" onClick={() => set('steps', [...steps, ''])}>
          <Plus className="h-4 w-4" /> paso
        </button>
      </fieldset>

      <div>
        <label className="label" htmlFor={`${idPrefix}-expected`}>¿Qué esperaba?</label>
        <textarea
          id={`${idPrefix}-expected`}
          required={required}
          rows={2}
          className="input"
          placeholder="Resultado esperado (con referencia al brief o requisito si aplica, ej. REQ-12)"
          value={value.expected}
          onChange={(e) => set('expected', e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor={`${idPrefix}-actual`}>¿Qué pasó?</label>
        <textarea
          id={`${idPrefix}-actual`}
          required={required}
          rows={2}
          className="input"
          placeholder="Comportamiento real y condiciones (ej. en modo vertical)"
          value={value.actual}
          onChange={(e) => set('actual', e.target.value)}
        />
      </div>
    </div>
  )
}

/** Vista de solo lectura del reporte. */
export function ReportView({ report }: { report: Report }) {
  const steps = report.steps.filter((s) => s.trim())
  const block = (title: string, body: ReactNode) => (
    <div>
      <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
      <div className="mt-0.5 text-sm whitespace-pre-wrap text-gray-800">{body}</div>
    </div>
  )
  return (
    <div className="space-y-3 rounded-lg bg-gray-50 p-4">
      {block('¿Dónde?', report.where || '—')}
      {block(
        '¿Qué hice?',
        steps.length ? (
          <ol className="list-decimal pl-5">
            {steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        ) : (
          '—'
        ),
      )}
      {block('¿Qué esperaba?', report.expected || '—')}
      {block('¿Qué pasó?', report.actual || '—')}
    </div>
  )
}
