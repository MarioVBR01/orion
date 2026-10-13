import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import { columnName } from '@shared/flow'
import { COLUMNS, type DailyActivity, type DailyScrum, type Project } from '@shared/types'
import { formatDateTime } from '@/lib/format'

/** "2026-10-13" → "lunes, 13/10/2026" */
export function longDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  const weekday = new Intl.DateTimeFormat('es-BO', { weekday: 'long' }).format(dt)
  return `${weekday}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

export function moveText(m: DailyActivity['moves'][number]): string {
  return m.action === 'creada' ? `Creada en ${columnName(m.to ?? '')}` : `${columnName(m.from ?? '')} → ${columnName(m.to ?? '')}`
}

const BLUE = '#2563EB'

/** La fuente del PDF (Roboto) no tiene flechas ni emojis: los reemplazamos. */
export function pdfSafe(text: string): string {
  return text
    .replace(/→/g, '»')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
}

/** Rango de fechas del periodo: "12/10/2026 al 13/10/2026". */
export function periodText(a: Pick<DailyActivity, 'from' | 'to'>): string {
  const day = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  const end = new Date(new Date(a.to).getTime() - 1)
  return `${day(new Date(a.from))} al ${day(end)}`
}

export function buildDailyDoc(project: Pick<Project, 'name' | 'code'>, daily: DailyScrum, activity: DailyActivity | undefined): TDocumentDefinitions {
  const content: Content[] = [
    { text: 'Daily Scrum', style: 'title' },
    { text: `${project.name} (${project.code}) · ${longDate(daily.date)}`, style: 'subtitle' },
  ]

  if (daily.notes.trim()) {
    content.push({ text: 'Notas', style: 'h2' }, { text: pdfSafe(daily.notes.trim()), margin: [0, 0, 0, 6] })
  }

  content.push({ text: 'Participantes', style: 'h2' })
  if (daily.entries.length) {
    content.push({
      table: {
        headerRows: 1,
        widths: [90, '*', '*', 110],
        body: [
          ['Participante', '¿Qué hice ayer?', '¿Qué haré hoy?', 'Impedimentos'].map((t) => ({ text: t, style: 'th' })),
          ...daily.entries.map((e) => [
            { text: pdfSafe(e.person), bold: true },
            pdfSafe(e.yesterday) || '—',
            pdfSafe(e.today) || '—',
            { text: pdfSafe(e.blockers) || 'Ninguno', color: e.blockers ? '#B91C1C' : '#6B7280' },
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
    })
  } else {
    content.push({ text: 'Sin participantes registrados.', italics: true, color: '#6B7280' })
  }

  content.push({ text: 'Actividad del tablero', style: 'h2' })
  if (activity) {
    content.push({
      text: `Periodo: ${periodText(activity)}`,
      style: 'muted',
      margin: [0, 0, 0, 4],
    })
  }
  if (activity?.moves.length) {
    content.push({
      table: {
        headerRows: 1,
        widths: [32, '*', 140, 60, 70],
        body: [
          ['#', 'Tarjeta', 'Movimiento', 'Por', 'Hora'].map((t) => ({ text: t, style: 'th' })),
          ...activity.moves.map((m) => [
            `#${m.cardNumber}`,
            pdfSafe(m.cardTitle),
            pdfSafe(moveText(m)),
            m.actor === 'claude' ? 'Claude (IA)' : m.actor,
            formatDateTime(new Date(m.at)),
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
      fontSize: 8.5,
    })
  } else {
    content.push({ text: 'Sin movimientos en el periodo.', italics: true, color: '#6B7280' })
  }

  content.push({ text: 'Estado del tablero', style: 'h2' })
  content.push({
    table: {
      widths: COLUMNS.map(() => '*'),
      body: [
        COLUMNS.map((c) => ({ text: c.name, style: 'th', alignment: 'center' as const })),
        COLUMNS.map((c) => ({ text: String(daily.boardSnapshot[c.id] ?? 0), alignment: 'center' as const, fontSize: 12, bold: true })),
      ],
    },
    layout: 'lightHorizontalLines',
  })
  content.push({ text: `Estado registrado al guardar el daily (${formatDateTime(new Date(daily.updatedAt))}).`, style: 'muted', margin: [0, 4, 0, 0] })

  return {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 48],
    info: { title: `Daily Scrum ${project.code} ${daily.date}`, author: 'ORION Manager' },
    content,
    defaultStyle: { fontSize: 9.5, lineHeight: 1.2 },
    styles: {
      title: { fontSize: 20, bold: true, color: BLUE },
      subtitle: { fontSize: 11, color: '#374151', margin: [0, 2, 0, 10] },
      h2: { fontSize: 12, bold: true, margin: [0, 12, 0, 4] },
      th: { bold: true, fillColor: '#EFF6FF', color: '#1E3A8A' },
      muted: { fontSize: 8, color: '#6B7280' },
    },
    footer: (page, pages) => ({
      columns: [
        { text: `Generado con ORION Manager · ${formatDateTime(new Date())}`, style: 'muted' },
        { text: `Página ${page} de ${pages}`, alignment: 'right', style: 'muted' },
      ],
      margin: [40, 16, 40, 0],
    }),
  }
}

/** Genera y descarga el PDF (pdfmake se carga solo al exportar). */
export async function downloadDailyPdf(project: Pick<Project, 'name' | 'code'>, daily: DailyScrum, activity: DailyActivity | undefined) {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  pdfMake.addVirtualFileSystem(vfs)
  await pdfMake.createPdf(buildDailyDoc(project, daily, activity)).download(`${project.code}-daily-${daily.date}.pdf`)
}
