import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Download, FileText } from 'lucide-react'
import { Markdown } from '@/components/Markdown'
import { Modal, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { cardKeys, exportCards, keys } from '@/lib/api'
import { useCurrentProject } from '@/features/project/ProjectContext'
import type { ColumnId, ExportResult } from '@shared/types'

/**
 * Exporta tarjetas a un .md para el chat de Claude del proyecto.
 * La vista previa no cambia nada; al copiar o descargar se registra la exportación
 * (y, si se elige, las tarjetas pasan a "Por hacer").
 */
export function ExportMdModal({ numbers, onClose, onDone }: { numbers: number[]; onClose: () => void; onDone?: () => void }) {
  const project = useCurrentProject()
  const toast = useToast()
  const qc = useQueryClient()
  const [preview, setPreview] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'render' | 'texto'>('render')
  const [moveToTodo, setMoveToTodo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  /** Resultado ya registrado: copiar y descargar en la misma sesión cuentan como una sola exportación. */
  const [final, setFinal] = useState<ExportResult | null>(null)
  const key = numbers.join(',')

  useEffect(() => {
    let alive = true
    exportCards(project.id, { numbers: key.split(',').map(Number) })
      .then((r) => alive && setPreview(r))
      .catch((e: unknown) => alive && setError(errorMessage(e)))
    return () => {
      alive = false
    }
  }, [project.id, key])

  /** Registra la exportación y devuelve el .md definitivo. */
  async function finalize(): Promise<ExportResult | null> {
    if (final) return final
    setBusy(true)
    try {
      const moveTo: ColumnId | undefined = moveToTodo ? 'por_hacer' : undefined
      const result = await exportCards(project.id, { numbers, mark: true, moveTo })
      void qc.invalidateQueries({ queryKey: cardKeys.all(project.id) })
      void qc.invalidateQueries({ queryKey: cardKeys.activity(project.id) })
      void qc.invalidateQueries({ queryKey: keys.project(project.id), exact: true })
      onDone?.()
      setFinal(result)
      return result
    } catch (e) {
      toast.error(errorMessage(e))
      return null
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    const r = await finalize()
    if (!r) return
    try {
      await navigator.clipboard.writeText(r.markdown)
      setCopied(true)
      toast.success('Copiado. Pégalo en el chat de Claude del proyecto.')
    } catch {
      toast.error('No se pudo copiar; usa "Descargar .md".')
    }
  }

  async function download() {
    const r = await finalize()
    if (!r) return
    const blob = new Blob([r.markdown], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = r.filename
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(`${r.filename} descargado. Adjúntalo en el chat de Claude del proyecto.`)
  }

  const count = numbers.length
  return (
    <div data-nested-modal onMouseDown={(e) => e.stopPropagation()}>
      <Modal
        open
        wide
        onClose={onClose}
        title={`Exportar a .md · ${count} ${count === 1 ? 'tarjeta' : 'tarjetas'}`}
        footer={
          <div className="flex w-full flex-wrap items-center gap-3">
            <label className="mr-auto flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={moveToTodo}
                disabled={!!final}
                onChange={(e) => setMoveToTodo(e.target.checked)}
              />
              Mover a "Por hacer" al exportar
            </label>
            <button className="btn-outline" disabled={!preview || busy} onClick={() => void download()}>
              <Download className="h-4 w-4" /> Descargar .md
            </button>
            <button className="btn-primary" disabled={!preview || busy} onClick={() => void copy()}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copiado' : 'Copiar para el chat'}
            </button>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-gray-400" />
          <span className="font-mono text-gray-600">{preview?.filename ?? '…'}</span>
          <div className="ml-auto flex rounded-lg border border-gray-200 p-0.5" role="tablist" aria-label="Vista">
            {(['render', 'texto'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1 ${view === v ? 'bg-gray-100 font-medium' : 'text-gray-500'}`}
              >
                {v === 'render' ? 'Vista previa' : 'Texto'}
              </button>
            ))}
          </div>
        </div>
        {!project.aiInstructions.trim() && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Este proyecto aún no tiene <strong>Instrucciones para Claude</strong> (repositorio, stack, cómo verificar). Agrégalas con el lápiz ✏️
            junto al nombre del proyecto.
          </p>
        )}
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !preview ? (
          <Skeleton className="h-80" />
        ) : view === 'render' ? (
          <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-gray-200 p-4">
            <Markdown>{preview.markdown}</Markdown>
          </div>
        ) : (
          <textarea readOnly aria-label="Contenido del .md" className="input h-[55vh] font-mono text-[12px]" value={preview.markdown} />
        )}
        <p className="mt-3 text-xs text-gray-500">
          Envía este .md al chat de Claude del proyecto. Claude te indicará en cada paso a qué columna mover cada tarjeta (▶ En progreso, ⏸ Por
          hacer, ✅ En revisión QA); el tablero no se mueve solo.
        </p>
      </Modal>
    </div>
  )
}
