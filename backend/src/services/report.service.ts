/**
 * Pure PDF report generator.
 *
 * Зависит только от `pdf-lib`. Никаких обращений к БД, сети, Express
 * — это позволяет:
 *   1. Запускать функцию в Worker Thread без переноса всего контекста
 *      приложения (Prisma, Socket.IO и т.д.).
 *   2. Юнит-тестировать без моков.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface ReportInput {
  monthParam: string; // "2024-01"
  monthName: string; // "Yanvar"
  year: number;
  createdCount: number;
  closedCount: number;
  avgHours: number | null;
  avgRating: number | null;
  ratingCount: number;
}

export async function buildReportPdf(input: ReportInput): Promise<Uint8Array> {
  const { monthName, year, createdCount, closedCount, avgHours, avgRating, ratingCount } = input;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  // Header bar
  page.drawRectangle({
    x: 0,
    y: y - 10,
    width,
    height: 50,
    color: rgb(0.13, 0.13, 0.17),
  });
  page.drawText('AituDesk', {
    x: margin,
    y: y + 5,
    size: 22,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  y -= 80;

  // Title
  const title = `Otchet za ${monthName} ${year}`;
  page.drawText(title, {
    x: margin,
    y,
    size: 20,
    font: fontBold,
    color: rgb(0.13, 0.13, 0.17),
  });
  y -= 15;

  page.drawText('Monthly Report', {
    x: margin,
    y,
    size: 11,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 40;

  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 35;

  const rows: [string, string][] = [
    ['Sozdano tiketov za mesyac', String(createdCount)],
    ['Zakryto tiketov', String(closedCount)],
    [
      'Sredneye vremya resheniya',
      avgHours ? `${Number(avgHours).toFixed(1)} ch` : 'net dannyh',
    ],
    [
      'Srednyaya udovletvorennost',
      avgRating ? `${avgRating.toFixed(1)}/5 (${ratingCount} ocenok)` : 'net ocenok',
    ],
  ];

  for (const [label, value] of rows) {
    page.drawText(label, {
      x: margin,
      y,
      size: 13,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(value, {
      x: width - margin - font.widthOfTextAtSize(value, 14),
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.13, 0.13, 0.17),
    });
    y -= 30;

    page.drawLine({
      start: { x: margin, y: y + 10 },
      end: { x: width - margin, y: y + 10 },
      thickness: 0.5,
      color: rgb(0.92, 0.92, 0.92),
    });
  }

  y -= 40;
  const generated = `Sformirovano: ${new Date().toISOString().slice(0, 10)}`;
  page.drawText(generated, {
    x: margin,
    y: margin,
    size: 9,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });

  return await doc.save();
}
