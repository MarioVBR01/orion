import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { Attachment } from '../shared/types'
import { RuleError } from './errors'

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const ALLOWED = /^(image\/(png|jpe?g|gif|webp|bmp|svg\+xml)|application\/pdf|video\/(mp4|webm|quicktime))$/

/** URL pública de un adjunto → ruta en disco (la usa el comando `orion` para que la IA vea las imágenes). */
export function attachmentPath(uploadsDir: string, url: string): string | null {
  const m = /^\/uploads\/(\d+)\/([^/]+)$/.exec(url)
  return m ? join(uploadsDir, m[1]!, m[2]!) : null
}

export function saveUpload(uploadsDir: string, projectId: number, originalName: string, contentType: string, data: Buffer): Attachment {
  if (!ALLOWED.test(contentType)) throw new RuleError('Tipo de archivo no permitido. Usa imágenes, PDF o video.')
  if (!data.length) throw new RuleError('El archivo está vacío.')
  if (data.length > MAX_UPLOAD_BYTES) throw new RuleError('El archivo supera los 15 MB.')
  const safeName = originalName.replace(/[^\w.\- ]+/g, '_').slice(0, 80) || 'archivo'
  const ext = extname(safeName) || `.${contentType.split('/')[1]?.replace('+xml', '') ?? 'bin'}`
  const file = `${randomUUID()}${ext.toLowerCase()}`
  const dir = join(uploadsDir, String(projectId))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, file), data)
  return { name: safeName, url: `/uploads/${projectId}/${file}`, type: contentType, size: data.length }
}
