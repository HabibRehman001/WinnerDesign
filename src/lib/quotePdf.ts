import { jsPDF } from 'jspdf'
import { sceneCapture } from './capture'
import { moneyPlain } from './pricing'
import { renderPlanDataUrl, type PlanDesign } from '../plan/draw'
import type { Quote } from './pricing'
import type { ClientInfo, CurrencyCode } from '../types'

export function exportQuotation(input: {
  projectName: string
  client: ClientInfo
  design: PlanDesign
  quote: Quote
}) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = 210
  pdf.setFillColor(0, 102, 204)
  pdf.rect(0, 0, pageWidth, 18, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text('WINNER DESIGN', 10, 11.5)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text('Kitchen & Bathroom Quotation', 62, 11.5)

  pdf.setTextColor(26, 29, 32)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text(input.projectName || 'Kitchen quotation', 10, 28)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  const clientLines = [
    input.client.name || 'Client not set',
    input.client.address || 'Address not set',
    `Reference ${input.client.reference || '—'}`,
    new Date().toLocaleDateString('en-GB'),
  ]
  clientLines.forEach((line, index) => pdf.text(line, 10, 34 + index * 4.5))

  const plan = renderPlanDataUrl(input.design, 1100, 760)
  const render = sceneCapture.grab?.() ?? null
  if (plan) pdf.addImage(plan, 'JPEG', 10, 54, 92, 62)
  if (render) pdf.addImage(render, 'JPEG', 108, 54, 92, 62)
  pdf.setFontSize(8)
  pdf.setTextColor(90, 96, 104)
  pdf.text('2D floor plan', 10, 119)
  pdf.text('3D view', 108, 119)

  let y = 126
  pdf.setFillColor(45, 49, 57)
  pdf.rect(10, y, 190, 7, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  const headers = ['Code', 'Description', 'Size / note', 'Qty', 'Unit', 'Amount']
  const cols = [12, 32, 92, 150, 164, 188]
  headers.forEach((header, index) => pdf.text(header, cols[index], y + 4.8))
  y += 9
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(26, 29, 32)

  input.quote.lines.forEach((entry, index) => {
    if (y > 270) {
      pdf.addPage()
      y = 16
    }
    if (index % 2 === 0) {
      pdf.setFillColor(245, 246, 248)
      pdf.rect(10, y - 4, 190, 6.2, 'F')
    }
    pdf.text(entry.sku.slice(0, 16), 12, y)
    pdf.text(entry.name.slice(0, 34), 32, y)
    pdf.text(entry.detail.slice(0, 32), 92, y)
    pdf.text(String(entry.qty % 1 ? entry.qty.toFixed(2) : entry.qty), 150, y)
    pdf.text(entry.unit, 164, y)
    pdf.text(moneyPlain(entry.total, input.design.options.currency), 188, y, { align: 'right' })
    y += 6.2
  })

  y += 4
  const summary = [
    ['Goods', moneyPlain(input.quote.net, input.design.options.currency)],
    ['Fitting', moneyPlain(input.quote.fitting, input.design.options.currency)],
    ['VAT', moneyPlain(input.quote.vat, input.design.options.currency)],
    ['Total', moneyPlain(input.quote.gross, input.design.options.currency)],
  ]
  summary.forEach((row, index) => {
    const bold = index === summary.length - 1
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    if (bold) {
      pdf.setFillColor(0, 102, 204)
      pdf.rect(120, y - 4.5, 80, 7, 'F')
      pdf.setTextColor(255, 255, 255)
    }
    pdf.text(row[0], 124, y)
    pdf.text(row[1], 196, y, { align: 'right' })
    pdf.setTextColor(26, 29, 32)
    y += 7
  })

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(90, 96, 104)
  const note = pdf.splitTextToSize(input.quote.notes, 180)
  pdf.text(note, 10, Math.min(y + 6, 286))

  pdf.save(`${(input.projectName || 'quotation').replace(/\s+/g, '-').toLowerCase()}.pdf`)
}

export function orderIssues(quote: Quote) {
  const issues: string[] = []
  for (const line of quote.lines) {
    if (!line.sku.trim()) issues.push(`${line.name} is missing a product code`)
    if (!(line.unitPrice > 0)) issues.push(`${line.sku || line.name} has no price`)
  }
  return issues
}

export function exportSupplierOrder(input: { projectName: string; client: ClientInfo; quote: Quote; currency: CurrencyCode }) {
  const issues = orderIssues(input.quote)
  if (issues.length) return issues
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  pdf.setFontSize(14)
  pdf.text('Supplier order', 10, 16)
  pdf.setFontSize(10)
  pdf.text(input.projectName, 10, 24)
  pdf.text(input.client.name || 'Client not set', 10, 30)
  pdf.text(`Reference ${input.client.reference || '—'}`, 10, 36)
  let y = 48
  for (const line of input.quote.lines) {
    if (y > 280) {
      pdf.addPage()
      y = 16
    }
    pdf.text(`${line.sku}  ${line.name}  x${line.qty}  ${moneyPlain(line.total, input.currency)}`, 10, y)
    y += 6
  }
  pdf.save(`${(input.projectName || 'order').replace(/\s+/g, '-').toLowerCase()}-order.pdf`)
  return []
}

export function exportInstallerPack(input: { projectName: string; design: PlanDesign; quote: Quote }) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  pdf.setFontSize(14)
  pdf.text('Installer pack', 10, 16)
  pdf.setFontSize(10)
  pdf.text(input.projectName, 10, 24)
  const plan = renderPlanDataUrl(input.design, 1100, 760)
  if (plan) pdf.addImage(plan, 'JPEG', 10, 30, 180, 110)
  let y = 148
  pdf.text('Cabinet list', 10, y)
  y += 6
  for (const line of input.quote.lines) {
    if (y > 280) {
      pdf.addPage()
      y = 16
    }
    pdf.text(`${line.sku}  ${line.name}  ${line.detail}`, 10, y)
    y += 5
  }
  pdf.save(`${(input.projectName || 'installer').replace(/\s+/g, '-').toLowerCase()}-installer.pdf`)
}
