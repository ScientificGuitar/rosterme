import { downloadBlob } from "@/lib/inviteQr"
import type { ReportsData } from "@/lib/types"
import type { Worksheet } from "exceljs"

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function reportsFilename(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `reports-${y}-${m}-${d}.xlsx`
}

/** Bold + freeze the header row on every sheet. */
function styleHeader(ws: Worksheet): void {
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: "frozen", ySplit: 1 }]
}

function buildSummarySheet(ws: Worksheet, data: ReportsData): void {
  ws.columns = [
    { header: "Metric", key: "metric", width: 22 },
    { header: "Value", key: "value", width: 14 },
  ]
  const s = data.summary
  ws.addRow({ metric: "Events", value: Number(s.events) })
  ws.addRow({ metric: "Slots", value: Number(s.slots) })
  ws.addRow({ metric: "Capacity", value: Number(s.capacity) })
  ws.addRow({ metric: "Active signups", value: Number(s.activeSignups) })
  ws.addRow({ metric: "Waitlisted", value: Number(s.waitlisted) })
  const fillRow = ws.addRow({ metric: "Fill rate", value: Number(s.fillRate) })
  fillRow.getCell("value").numFmt = "0%"
  styleHeader(ws)
}

function buildEventsSheet(ws: Worksheet, data: ReportsData): void {
  ws.columns = [
    { header: "Group", key: "group", width: 24 },
    { header: "Title", key: "title", width: 34 },
    { header: "Date", key: "date", width: 12 },
    { header: "Slots", key: "slots", width: 8 },
    { header: "Capacity", key: "capacity", width: 10 },
    { header: "Active signups", key: "active", width: 12 },
    { header: "Waitlisted", key: "waitlisted", width: 10 },
    { header: "Fill rate", key: "fillRate", width: 10 },
  ]
  ws.getColumn("fillRate").numFmt = "0%"
  for (const e of data.events) {
    ws.addRow({
      group: e.groupName,
      title: e.title,
      date: e.date,
      slots: Number(e.slots),
      capacity: Number(e.capacity),
      active: Number(e.activeSignups),
      waitlisted: Number(e.waitlisted),
      fillRate: Number(e.fillRate),
    })
  }
  styleHeader(ws)
}

function buildGroupsSheet(ws: Worksheet, data: ReportsData): void {
  ws.columns = [
    { header: "Group", key: "name", width: 26 },
    { header: "Events", key: "events", width: 8 },
    { header: "Slots", key: "slots", width: 8 },
    { header: "Capacity", key: "capacity", width: 10 },
    { header: "Active signups", key: "active", width: 12 },
    { header: "Fill rate", key: "fillRate", width: 10 },
  ]
  ws.getColumn("fillRate").numFmt = "0%"
  for (const g of data.groups) {
    ws.addRow({
      name: g.name,
      events: Number(g.events),
      slots: Number(g.slots),
      capacity: Number(g.capacity),
      active: Number(g.activeSignups),
      fillRate: Number(g.fillRate),
    })
  }
  styleHeader(ws)
}

function buildStatusSheet(ws: Worksheet, data: ReportsData): void {
  ws.columns = [
    { header: "Status", key: "status", width: 18 },
    { header: "Count", key: "count", width: 10 },
  ]
  const rows = Object.entries(data.signupsByStatus)
    .map(([status, count]) => ({ status, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
  for (const row of rows) ws.addRow(row)
  styleHeader(ws)
}

function buildTimelineSheet(ws: Worksheet, data: ReportsData): void {
  ws.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Signups", key: "signups", width: 10 },
  ]
  for (const d of data.signupsPerDay) {
    ws.addRow({ date: d.date, signups: Number(d.count) })
  }
  styleHeader(ws)
}

/**
 * Builds a multi-sheet .xlsx workbook from the currently filtered report
 * aggregates and downloads it. All side-effect free except the download —
 * the filtering happened server-side, so the workbook mirrors the charts.
 * exceljs is loaded lazily so the ~600 kB library only downloads on export.
 */
export async function exportReportsToExcel(data: ReportsData): Promise<void> {
  const ExcelJS = await import("exceljs")
  const wb = new ExcelJS.Workbook()
  wb.creator = "RosterMe"

  buildSummarySheet(wb.addWorksheet("Summary"), data)
  buildEventsSheet(wb.addWorksheet("Events"), data)
  buildGroupsSheet(wb.addWorksheet("Groups"), data)
  buildStatusSheet(wb.addWorksheet("Status"), data)
  buildTimelineSheet(wb.addWorksheet("Timeline"), data)

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: XLSX_MIME })
  downloadBlob(reportsFilename(), blob)
}
