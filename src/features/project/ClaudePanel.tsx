import { useState } from 'react'
import { Bot, Check, Copy, ExternalLink, FolderCheck, FolderX, Wrench } from 'lucide-react'
import { Modal } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { openInVsCode, prepareRepo, type PrepareRepoResult } from '@/lib/api'
import { useCurrentProject } from './ProjectContext'

export const CLAUDE_PROMPT_ALL =
  'Trabaja el backlog de ORION: toma las tarjetas una por una con `orion siguiente` y sigue el flujo de la sección "Tablero ORION" de CLAUDE.md hasta dejar cada una en En revisión humano.'
export const CLAUDE_PROMPT_ONE =
  'Toma la siguiente tarjeta de ORION con `orion siguiente` y trabájala siguiendo la sección "Tablero ORION" de CLAUDE.md hasta dejarla en En revisión humano. Luego detente.'

/**
 * Modo semiautomático: guía para que Claude Code trabaje el tablero desde la carpeta del proyecto.
 * ORION no lanza a Claude; la persona abre Claude Code y le da la orden.
 */
export function ClaudePanel({ onClose, onEditProject }: { onClose: () => void; onEditProject: () => void }) {
  const project = useCurrentProject()
  const toast = useToast()
  const [prep, setPrep] = useState<PrepareRepoResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<'all' | 'one' | null>(null)
  const pending = project.counts.backlog + project.counts.por_hacer
  const linked = !!project.repoPath

  async function prepare() {
    setBusy(true)
    try {
      setPrep(await prepareRepo(project.id))
      toast.success('Carpeta lista para Claude Code.')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function copy(which: 'all' | 'one') {
    try {
      await navigator.clipboard.writeText(which === 'all' ? CLAUDE_PROMPT_ALL : CLAUDE_PROMPT_ONE)
      setCopied(which)
      toast.success('Copiado. Pégalo en Claude Code dentro del proyecto.')
    } catch {
      toast.error('No se pudo copiar.')
    }
  }

  const step = 'flex gap-3'
  const num = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-brand'

  return (
    <Modal open wide onClose={onClose} title="Trabajar con Claude">
      <div className="space-y-6">
        <p className="text-sm text-gray-600">
          Claude toma las tarjetas del <strong>Backlog</strong> (primero las de <strong>Por hacer</strong>), las implementa con un commit por
          tarjeta, las verifica y las deja en <strong>En revisión humano</strong>. Ahí pruebas tú la aplicación y las mueves a <strong>Hecho</strong>{' '}
          o reportas nuevos errores en Por revisar. Ahora hay <strong>{pending}</strong> tarjeta(s) esperando.
        </p>

        <div className={step}>
          <span className={num}>1</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Carpeta del proyecto</p>
            {linked ? (
              <p className="mt-1 flex items-center gap-2 text-sm text-gray-700">
                <FolderCheck className="h-4 w-4 shrink-0 text-green-600" />
                <code className="truncate rounded bg-gray-100 px-1.5 py-0.5 text-[13px]">{project.repoPath}</code>
              </p>
            ) : (
              <p className="mt-1 flex items-center gap-2 text-sm text-amber-700">
                <FolderX className="h-4 w-4 shrink-0" /> Aún no está vinculada.
                <button className="text-brand underline" onClick={onEditProject}>Vincular carpeta</button>
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-outline" disabled={!linked || busy} onClick={() => void prepare()}>
                <Wrench className="h-4 w-4" /> Preparar para Claude
              </button>
              <button
                className="btn-outline"
                disabled={!linked}
                onClick={() => openInVsCode(project.id).catch((e: unknown) => toast.error(errorMessage(e)))}
              >
                <ExternalLink className="h-4 w-4" /> Abrir en VS Code
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              "Preparar" agrega a la carpeta <code>.orion.json</code>, la sección "Tablero ORION" en su <code>CLAUDE.md</code> (sin tocar el resto)
              y permisos en <code>.claude/settings.json</code> para que Claude use <code>orion</code>, las pruebas y git sin pedir confirmación cada
              vez. Hazlo una vez (o de nuevo si cambias algo del proyecto).
            </p>
            {prep && (
              <ul className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
                <li>.orion.json: {prep.orionJson}</li>
                <li>CLAUDE.md: {prep.claudeMd}</li>
                <li>.claude/settings.json: {prep.settings}</li>
                <li>Verificación en QA: {prep.verify.join(', ') || 'sin scripts detectados'}</li>
              </ul>
            )}
          </div>
        </div>

        <div className={step}>
          <span className={num}>2</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Abre Claude Code en esa carpeta y dale la orden</p>
            <p className="mt-1 text-sm text-gray-600">En VS Code, abre el panel de Claude Code y pega una de estas órdenes:</p>
            <div className="mt-2 space-y-2">
              {(
                [
                  ['all', 'Trabajar todo el backlog', CLAUDE_PROMPT_ALL],
                  ['one', 'Solo la siguiente tarjeta', CLAUDE_PROMPT_ONE],
                ] as const
              ).map(([key, label, text]) => (
                <div key={key} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{label}</span>
                    <button className="btn-outline py-1 text-xs" onClick={() => void copy(key)}>
                      {copied === key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied === key ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <p className="text-[13px] text-gray-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={step}>
          <span className={num}>3</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Mira el tablero y revisa</p>
            <p className="mt-1 text-sm text-gray-600">
              Las tarjetas se mueven solas mientras Claude trabaja (el tablero se actualiza cada pocos segundos). Cuando lleguen a{' '}
              <strong>En revisión humano</strong>, lee el comentario "cómo probarlo", prueba la aplicación y muévelas a <strong>Hecho</strong>. Si algo
              falla, devuélvelas a Por hacer con un comentario o reporta el error en <strong>Por revisar</strong>.
            </p>
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          <Bot className="mt-0.5 h-4 w-4 shrink-0" />
          Claude nunca mueve a Hecho ni hace push. Cada tarjeta consume uso de tu plan de Claude; puedes detenerlo en cualquier momento desde Claude Code.
        </p>
      </div>
    </Modal>
  )
}
