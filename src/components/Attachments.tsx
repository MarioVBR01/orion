import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, FileText, ImagePlus, Loader2, X, ZoomIn, ZoomOut } from 'lucide-react'
import type { Attachment } from '@shared/types'
import { uploadFile } from '@/lib/api'
import { errorMessage, useToast } from './Toast'

const isImage = (a: Attachment) => a.type.startsWith('image/')

/** 📎 Subida múltiple: arrastrar y soltar, pegar desde el portapapeles (Ctrl+V) o elegir archivos. */
export function AttachmentsInput({ projectId, value, onChange }: { projectId: number; value: Attachment[]; onChange: (v: Attachment[]) => void }) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [over, setOver] = useState(false)
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  }, [value])

  const upload = useCallback(
    async (files: File[]) => {
      if (!files.length) return
      setUploading((n) => n + files.length)
      for (const f of files) {
        try {
          const a = await uploadFile(projectId, f)
          latest.current = [...latest.current, a]
          onChange(latest.current)
        } catch (e) {
          toast.error(`${f.name}: ${errorMessage(e)}`)
        } finally {
          setUploading((n) => n - 1)
        }
      }
    },
    [projectId, onChange, toast],
  )

  // Pegar imágenes desde el portapapeles mientras el formulario está abierto.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.length) {
        e.preventDefault()
        void upload(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [upload])

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Agregar imágenes: arrastra, pega con Ctrl+V o haz clic"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void upload([...e.dataTransfer.files])
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center text-sm transition-colors ${
          over ? 'border-brand bg-blue-50 text-brand' : 'border-gray-300 text-gray-500 hover:bg-gray-50'
        }`}
      >
        {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
        <span>{uploading ? `Subiendo ${uploading}…` : 'Arrastra imágenes aquí, pégalas con Ctrl+V o haz clic'}</span>
        <span className="text-xs text-gray-400">PNG, JPG, GIF, WebP, PDF o video · máx. 15 MB</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,video/mp4,video/webm"
        className="hidden"
        onChange={(e) => {
          void upload([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      {value.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {value.map((a) => (
            <li key={a.url} className="group relative">
              <Thumb a={a} />
              <button
                type="button"
                aria-label={`Quitar ${a.name}`}
                className="absolute -top-2 -right-2 rounded-full bg-white p-0.5 text-gray-500 shadow ring-1 ring-gray-200 hover:text-red-600"
                onClick={() => onChange(value.filter((x) => x.url !== a.url))}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Thumb({ a, onClick }: { a: Attachment; onClick?: () => void }) {
  const cls = 'h-20 w-20 rounded-lg object-cover ring-1 ring-gray-200'
  const body = isImage(a) ? (
    <img src={a.url} alt={a.name} className={cls} loading="lazy" />
  ) : (
    <span className={`${cls} flex flex-col items-center justify-center gap-1 bg-gray-50 p-1 text-[10px] text-gray-500`}>
      <FileText className="h-6 w-6" />
      <span className="w-full truncate text-center">{a.name}</span>
    </span>
  )
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={`Ver ${a.name}`} className="block rounded-lg focus-visible:ring-2">
      {body}
    </button>
  ) : (
    body
  )
}

/** Galería de adjuntos con visor ampliado (zoom y navegación con flechas). */
export function Gallery({ attachments }: { attachments: Attachment[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const images = attachments.filter(isImage)
  const others = attachments.filter((a) => !isImage(a))
  if (!attachments.length) return null
  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {images.map((a, i) => (
          <li key={a.url}>
            <Thumb a={a} onClick={() => setOpen(i)} />
          </li>
        ))}
        {others.map((a) => (
          <li key={a.url}>
            <a href={a.url} target="_blank" rel="noreferrer">
              <Thumb a={a} />
            </a>
          </li>
        ))}
      </ul>
      {open !== null && images[open] && (
        <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}

function Lightbox({ images, index, onIndex, onClose }: { images: Attachment[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const [zoom, setZoom] = useState(false)
  const img = images[index]!
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      if (e.key === 'ArrowRight' && index < images.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, images.length, onClose, onIndex])

  return (
    <div data-nested-modal className="fixed inset-0 z-[70] flex flex-col bg-black/90" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 p-3 text-white">
        <span className="truncate text-sm">{img.name} · {index + 1}/{images.length}</span>
        <button className="ml-auto rounded-lg p-2 hover:bg-white/10" aria-label={zoom ? 'Alejar' : 'Acercar'} onClick={() => setZoom((z) => !z)}>
          {zoom ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
        </button>
        <button className="rounded-lg p-2 hover:bg-white/10" aria-label="Cerrar visor" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className={`relative flex-1 ${zoom ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden'}`}>
        <img
          src={img.url}
          alt={img.name}
          onClick={() => setZoom((z) => !z)}
          className={zoom ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain'}
        />
      </div>
      {images.length > 1 && (
        <>
          <button disabled={index === 0} aria-label="Imagen anterior" onClick={() => onIndex(index - 1)} className="absolute top-1/2 left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button disabled={index === images.length - 1} aria-label="Imagen siguiente" onClick={() => onIndex(index + 1)} className="absolute top-1/2 right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-30">
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
    </div>
  )
}
