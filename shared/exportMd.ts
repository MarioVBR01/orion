import { columnName } from './flow'
import { PRIORITY_LABEL, TYPE_LABEL, type Card, type Comment, type Project } from './types'

export interface ExportCard {
  card: Card
  comments: Comment[]
}

export interface ExportOptions {
  /** Fecha legible de la exportación (ya formateada). */
  date: string
  /** Ruta en disco de un adjunto (para que Claude Code pueda abrir la imagen), o null. */
  attachmentPath: (url: string) => string | null
}

/** Nombre de archivo: LGG-12.md (una tarjeta) o LGG-tareas-2026-10-12.md (varias). */
export function exportFilename(project: Pick<Project, 'code'>, numbers: number[], isoDate: string): string {
  return numbers.length === 1 ? `${project.code}-${numbers[0]}.md` : `${project.code}-tareas-${isoDate.slice(0, 10)}.md`
}

const quote = (text: string) =>
  text
    .trim()
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n')

/**
 * Arma el .md que se envía al chat de Claude del proyecto: instrucciones del proyecto,
 * cómo trabajar y reportar (qué columna mover), y el detalle de cada tarea.
 * El tablero NO se actualiza solo: la persona mueve las tarjetas según lo que Claude reporte.
 */
export function buildExportMarkdown(project: Pick<Project, 'name' | 'code' | 'aiInstructions'>, items: ExportCard[], opts: ExportOptions): string {
  const n = items.length
  const ids = items.map((i) => `#${i.card.number}`).join(', ')
  const out: string[] = []

  out.push(`# Tareas para Claude · ${project.name} (${project.code})`)
  out.push('')
  out.push(`Exportado desde ORION el ${opts.date} · ${n} ${n === 1 ? 'tarea' : 'tareas'}: ${ids}`)
  out.push('')

  if (project.aiInstructions.trim()) {
    out.push('## Instrucciones del proyecto', '', project.aiInstructions.trim(), '')
  }

  out.push(
    '## Cómo trabajar estas tareas',
    '',
    `1. Trabaja las tareas en el orden en que aparecen${n > 1 ? ' (ya vienen priorizadas)' : ''}, una a la vez.`,
    '2. Antes de implementar, lee la tarea completa y abre las imágenes adjuntas. Si algo no está claro, **pregunta antes de cambiar código**.',
    '3. Haz solo lo que pide la tarea; no cambies otras partes del proyecto.',
    '4. Verifica tu cambio (tests, lint o build del proyecto) antes de darlo por terminado.',
    '5. El tablero de ORION **no se actualiza solo**: yo muevo las tarjetas según lo que me indiques. Por eso, en cada paso escribe la línea de estado exacta:',
    '',
    '| Momento | Escribe | Yo muevo la tarjeta a |',
    '| --- | --- | --- |',
    '| Al empezar una tarea | `▶ #N → En progreso` | En progreso |',
    '| Si te falta información o algo te bloquea | `⏸ #N → Por hacer: <qué falta>` | Por hacer |',
    '| Al terminar y verificar | `✅ #N → En revisión QA` | En revisión QA |',
    '',
    '6. Nunca indiques **Hecho**: eso lo decide una persona después de revisar.',
    '',
    'Al terminar cada tarea, cierra con este bloque:',
    '',
    '```',
    '✅ #N → En revisión QA',
    'Resumen: qué cambiaste y por qué',
    'Archivos: archivos principales modificados',
    'Cómo probar: pasos para verificarlo',
    'Commit/rama: (si aplica)',
    '```',
    '',
  )
  if (n > 1) {
    out.push(
      'Cuando termines todas (o te detengas), entrega una tabla final para que yo actualice el tablero:',
      '',
      '| Tarjeta | Mover a | Nota |',
      '| --- | --- | --- |',
      ...items.map((i) => `| #${i.card.number} | En revisión QA / Por hacer | … |`),
      '',
    )
  }

  items.forEach(({ card, comments }, idx) => {
    out.push('---', '')
    out.push(`## ${n > 1 ? `Tarea ${idx + 1} de ${n} · ` : ''}#${card.number} · ${card.title}`)
    out.push('')
    const meta = [
      `**Tipo:** ${TYPE_LABEL[card.type]}`,
      `**Prioridad:** ${PRIORITY_LABEL[card.priority]}`,
      `**Estado en el tablero:** ${columnName(card.column)}`,
    ]
    out.push(`- ${meta.join(' · ')}`)
    const extra = [
      card.labels.length ? `**Etiquetas:** ${card.labels.join(', ')}` : '',
      `**Reportado por:** ${card.createdBy}`,
      card.sourceObservationIds.length ? `**Origen:** observación ${card.sourceObservationIds.map((x) => `#${x}`).join(', ')}` : '',
    ].filter(Boolean)
    out.push(`- ${extra.join(' · ')}`, '')

    if (card.descriptionMd.trim()) out.push('### Descripción', '', card.descriptionMd.trim(), '')

    if (card.report) {
      const r = card.report
      const steps = r.steps.filter((s) => s.trim())
      out.push('### Reporte', '')
      out.push(`**¿Dónde?** ${r.where.trim() || '—'}`, '')
      out.push('**¿Qué hice?**', '')
      out.push(...(steps.length ? steps.map((s, i) => `${i + 1}. ${s.trim()}`) : ['—']), '')
      out.push(`**¿Qué esperaba?** ${r.expected.trim() || '—'}`, '')
      out.push(`**¿Qué pasó?** ${r.actual.trim() || '—'}`, '')
    }

    if (!card.descriptionMd.trim() && !card.report) out.push('_Sin descripción: pregunta antes de implementar._', '')

    if (card.acceptance.length) {
      out.push('### Criterios de aceptación', '')
      out.push(...card.acceptance.map((a) => `- [${a.done ? 'x' : ' '}] ${a.text}`), '')
    }

    if (card.attachments.length) {
      out.push('### Imágenes', '')
      out.push('Ábrelas antes de implementar (están en este equipo):', '')
      for (const a of card.attachments) {
        const path = opts.attachmentPath(a.url)
        out.push(`- ${a.name}${path ? `: \`${path}\`` : ''}`)
      }
      out.push('')
    }

    const notes = comments.filter((c) => c.text.trim())
    if (notes.length) {
      out.push('### Comentarios previos', '')
      for (const c of notes) out.push(`**${c.author}:**`, quote(c.text), '')
    }
  })

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}
