import PDFDocument from "pdfkit";

import { CURRENCY, LOCALE } from "@/constants/app";
import type { BillingReport, FinancialReport } from "@/services/ReportService";

/**
 * Server-side PDF generation (spec section 7 "Server-side PDF") using
 * pdfkit — pure-JS, no headless browser needed. Both renderers return a
 * Buffer (never write to disk) so the route handler can stream it straight
 * into the HTTP response.
 */

function formatMoney(value: string): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY }).format(
    Number(value),
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" }).format(date);
}

async function renderToBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  build(doc);
  doc.end();
  return done;
}

function drawTitle(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.fontSize(16).text(title, { align: "left" });
  doc.fontSize(10).fillColor("#555555").text(subtitle);
  doc.fillColor("#000000").moveDown(1);
}

function drawTableRow(doc: PDFKit.PDFDocument, cells: string[], widths: number[], bold = false) {
  const startX = doc.x;
  const startY = doc.y;
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
  let x = startX;
  cells.forEach((cell, i) => {
    doc.text(cell, x, startY, { width: widths[i], align: i === 0 ? "left" : "right" });
    x += widths[i];
  });
  doc.moveDown(0.5);
}

export async function renderFinancialReportPdf(report: FinancialReport): Promise<Buffer> {
  return renderToBuffer((doc) => {
    drawTitle(
      doc,
      "Laporan Keuangan",
      `Periode ${formatDate(report.from)} — ${formatDate(new Date(report.to.getTime() - 1))}`,
    );

    doc.font("Helvetica-Bold").fontSize(11).text("Pemasukan");
    doc.moveDown(0.3);
    drawTableRow(doc, ["Kategori", "Jumlah"], [350, 150], true);
    report.income.forEach((row) =>
      drawTableRow(doc, [row.categoryName, formatMoney(row.total)], [350, 150]),
    );
    drawTableRow(doc, ["Total Pemasukan", formatMoney(report.totalIncome)], [350, 150], true);

    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(11).text("Pengeluaran");
    doc.moveDown(0.3);
    drawTableRow(doc, ["Kategori", "Jumlah"], [350, 150], true);
    report.expense.forEach((row) =>
      drawTableRow(doc, [row.categoryName, formatMoney(row.total)], [350, 150]),
    );
    drawTableRow(doc, ["Total Pengeluaran", formatMoney(report.totalExpense)], [350, 150], true);

    doc.moveDown(1);
    drawTableRow(doc, ["Net (Pemasukan - Pengeluaran)", formatMoney(report.net)], [350, 150], true);
  });
}

export async function renderBillingReportPdf(report: BillingReport): Promise<Buffer> {
  return renderToBuffer((doc) => {
    drawTitle(doc, "Laporan Tagihan Santri", `${report.rows.length} tagihan`);

    const widths = [110, 70, 70, 70, 65, 65, 40];
    drawTableRow(
      doc,
      ["Santri", "Kelas", "Jenis Tagihan", "Jumlah", "Dibayar", "Sisa", "Status"],
      widths,
      true,
    );
    report.rows.forEach((row) => {
      if (doc.y > 750) doc.addPage();
      drawTableRow(
        doc,
        [
          row.santriName,
          row.className ?? "-",
          row.billType,
          formatMoney(row.amount),
          formatMoney(row.amountPaid),
          formatMoney(row.remaining),
          row.status,
        ],
        widths,
      );
    });

    doc.moveDown(1);
    drawTableRow(
      doc,
      [
        "Total",
        "",
        "",
        formatMoney(report.totalAmount),
        formatMoney(report.totalPaid),
        formatMoney(report.totalRemaining),
        "",
      ],
      widths,
      true,
    );
  });
}
