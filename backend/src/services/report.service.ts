/**
 * Pure PDF report generator — editorial style.
 *
 * Зависит только от `pdf-lib` + `@pdf-lib/fontkit` + font files on disk.
 * Никаких обращений к БД, сети, Express — работает в Worker Thread.
 */
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs';
import path from 'node:path';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CategoryBreakdown {
  category: string;
  count: number;
}

export interface PriorityBreakdown {
  priority: string;
  count: number;
}

export interface ReportInput {
  monthParam: string;        // "2024-05"
  monthLabel: string;        // "Май 2026 г."
  createdCount: number;
  closedCount: number;
  openCount: number;
  avgHours: number | null;
  avgRating: number | null;
  ratingCount: number;
  slaBreachedCount: number;
  byCategory: CategoryBreakdown[];
  byPriority: PriorityBreakdown[];
}

// back-compat: keep old field name working
export interface ReportInputLegacy extends ReportInput {
  monthName?: string;
  year?: number;
}

// ── Colours ──────────────────────────────────────────────────────────────────

const C = {
  dark:    rgb(0.12, 0.12, 0.14),
  grey70:  rgb(0.30, 0.30, 0.30),
  grey50:  rgb(0.50, 0.50, 0.50),
  grey30:  rgb(0.70, 0.70, 0.70),
  grey15:  rgb(0.85, 0.85, 0.85),
  grey08:  rgb(0.92, 0.92, 0.92),
  grey04:  rgb(0.96, 0.96, 0.96),
  white:   rgb(1, 1, 1),
  amber:   rgb(0.93, 0.79, 0.35),
  amberBg: rgb(0.99, 0.96, 0.88),
  gold:    rgb(0.85, 0.65, 0.13),
  green:   rgb(0.18, 0.70, 0.35),
  greenBg: rgb(0.91, 0.97, 0.93),
  blue:    rgb(0.22, 0.46, 0.85),
  blueBg:  rgb(0.91, 0.94, 1.00),
  red:     rgb(0.85, 0.20, 0.20),
  redBg:   rgb(1.00, 0.93, 0.93),
};

const CATEGORY_COLORS: Record<string, ReturnType<typeof rgb>> = {
  SOFTWARE: rgb(0.35, 0.55, 0.90),
  HARDWARE: rgb(0.90, 0.65, 0.25),
  NETWORK:  rgb(0.30, 0.72, 0.45),
  ACCESS:   rgb(0.70, 0.35, 0.80),
  OTHER:    rgb(0.60, 0.60, 0.60),
};

const PRIORITY_COLORS: Record<string, ReturnType<typeof rgb>> = {
  CRITICAL: rgb(0.85, 0.20, 0.20),
  HIGH:     rgb(0.90, 0.55, 0.15),
  MEDIUM:   rgb(0.93, 0.79, 0.35),
  LOW:      rgb(0.45, 0.72, 0.45),
};

const CATEGORY_LABELS: Record<string, string> = {
  SOFTWARE: 'ПО',
  HARDWARE: 'Оборудование',
  NETWORK:  'Сеть',
  ACCESS:   'Доступ',
  OTHER:    'Прочее',
};

const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Критический',
  HIGH:     'Высокий',
  MEDIUM:   'Средний',
  LOW:      'Низкий',
};

// ── Font loader ──────────────────────────────────────────────────────────────

function findFontDir(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'assets', 'fonts'),        // dist/services -> assets
    path.resolve(process.cwd(), 'assets', 'fonts'),                 // cwd/assets
    path.resolve(__dirname, '..', '..', '..', 'assets', 'fonts'),   // deeper nesting
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'PTSans-Regular.ttf'))) return dir;
  }
  throw new Error(`Font directory not found. Searched: ${candidates.join(', ')}`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function drawSection(
  page: PDFPage, font: PDFFont, num: string, title: string,
  x: number, y: number,
): number {
  const sectionNum = `§ ${num}`;
  page.drawText(sectionNum, { x, y, size: 9, font, color: C.grey50 });
  const numW = font.widthOfTextAtSize(sectionNum, 9);
  page.drawText(title, { x: x + numW + 8, y, size: 14, font, color: C.dark });
  return y - 28;
}

function drawMetricCard(
  page: PDFPage, font: PDFFont, fontBold: PDFFont,
  label: string, value: string, bgColor: ReturnType<typeof rgb>,
  barColor: ReturnType<typeof rgb>, ratio: number,
  x: number, y: number, cardW: number, cardH: number,
): number {
  // Background
  page.drawRectangle({ x, y: y - cardH, width: cardW, height: cardH, color: bgColor });
  // Progress bar
  const barW = Math.max(cardW * Math.min(ratio, 1), 2);
  page.drawRectangle({
    x, y: y - cardH, width: barW, height: cardH,
    color: barColor, opacity: 0.15,
  });
  // Label
  page.drawText(label, {
    x: x + 12, y: y - cardH + (cardH - 11) / 2,
    size: 11, font, color: C.grey70,
  });
  // Value (right-aligned)
  const valW = fontBold.widthOfTextAtSize(value, 15);
  page.drawText(value, {
    x: x + cardW - valW - 14, y: y - cardH + (cardH - 13) / 2,
    size: 15, font: fontBold, color: C.dark,
  });
  return y - cardH - 6;
}

function drawHorizontalBar(
  page: PDFPage, font: PDFFont, fontBold: PDFFont,
  label: string, count: number, maxCount: number, color: ReturnType<typeof rgb>,
  x: number, y: number, totalW: number, barH: number,
): number {
  const labelW = 110;
  const countStr = String(count);
  const countW = fontBold.widthOfTextAtSize(countStr, 11);
  // Label
  page.drawText(label, { x, y: y - barH + 5, size: 10, font, color: C.grey70 });
  // Bar bg
  const barX = x + labelW;
  const barMaxW = totalW - labelW - countW - 20;
  page.drawRectangle({ x: barX, y: y - barH + 2, width: barMaxW, height: barH - 4, color: C.grey04 });
  // Bar fill
  const ratio = maxCount > 0 ? count / maxCount : 0;
  const fillW = Math.max(barMaxW * ratio, 2);
  page.drawRectangle({ x: barX, y: y - barH + 2, width: fillW, height: barH - 4, color });
  // Count
  page.drawText(countStr, {
    x: x + totalW - countW, y: y - barH + 5,
    size: 11, font: fontBold, color: C.dark,
  });
  return y - barH - 4;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function buildReportPdf(input: ReportInputLegacy): Promise<Uint8Array> {
  const {
    monthLabel, createdCount, closedCount, openCount,
    avgHours, avgRating, ratingCount, slaBreachedCount,
    byCategory, byPriority,
  } = input;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  // Load Cyrillic fonts
  const fontsDir = findFontDir();
  const regularBytes = fs.readFileSync(path.join(fontsDir, 'PTSans-Regular.ttf'));
  const boldBytes = fs.readFileSync(path.join(fontsDir, 'PTSans-Bold.ttf'));
  const font = await doc.embedFont(regularBytes);
  const fontBold = await doc.embedFont(boldBytes);

  const page = doc.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  const ml = 50;                // margin left
  const mr = 50;                // margin right
  const cw = width - ml - mr;   // content width
  let y = 841.89 - 45;

  // ── Header ──────────────────────────────────────────────────────────────
  page.drawText('AituDesk', { x: ml, y, size: 24, font: fontBold, color: C.dark });
  // Thin line under header
  y -= 12;
  page.drawLine({ start: { x: ml, y }, end: { x: width - mr, y }, thickness: 0.5, color: C.grey15 });
  y -= 22;

  // Issue date
  const now = new Date();
  const dateStr = `ВЫПУСК · ${now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}`;
  page.drawText(dateStr, { x: ml, y, size: 8, font, color: C.grey50 });
  y -= 26;

  // Title
  page.drawText('Отчёт за месяц', { x: ml, y, size: 26, font: fontBold, color: C.dark });
  y -= 18;
  page.drawText(`Ежемесячный обзор показателей службы поддержки`, {
    x: ml, y, size: 10, font, color: C.grey50,
  });
  y -= 10;

  // Month pill
  y -= 16;
  const pillText = monthLabel || input.monthParam;
  const pillW = font.widthOfTextAtSize(pillText, 10) + 20;
  page.drawRectangle({ x: ml, y: y - 4, width: pillW, height: 20, color: C.grey08 });
  page.drawText(pillText, { x: ml + 10, y: y, size: 10, font, color: C.grey70 });
  y -= 36;

  // ── § 01 Ключевые метрики ───────────────────────────────────────────────
  y = drawSection(page, fontBold, '01', 'Ключевые метрики', ml, y);

  const maxCreated = Math.max(createdCount, closedCount, openCount, 1);
  y = drawMetricCard(page, font, fontBold,
    'СОЗДАНО ТИКЕТОВ', String(createdCount),
    C.amberBg, C.amber, createdCount / maxCreated, ml, y, cw, 34);
  y = drawMetricCard(page, font, fontBold,
    'ЗАКРЫТО ТИКЕТОВ', String(closedCount),
    C.greenBg, C.green, closedCount / maxCreated, ml, y, cw, 34);
  y = drawMetricCard(page, font, fontBold,
    'ОТКРЫТЫХ ТИКЕТОВ', String(openCount),
    C.blueBg, C.blue, openCount / maxCreated, ml, y, cw, 34);

  const avgHoursStr = avgHours != null ? `${avgHours.toFixed(1)} ч` : '—';
  y = drawMetricCard(page, font, fontBold,
    'СРЕДНЕЕ ВРЕМЯ РЕШЕНИЯ', avgHoursStr,
    C.grey04, C.grey30, 0.5, ml, y, cw, 34);

  const ratingStr = avgRating != null
    ? `${avgRating.toFixed(1)}/5 (${ratingCount} оценок)`
    : 'нет оценок';
  y = drawMetricCard(page, font, fontBold,
    'СРЕДНЯЯ УДОВЛЕТВОРЁННОСТЬ', ratingStr,
    C.grey04, C.gold, avgRating ? avgRating / 5 : 0, ml, y, cw, 34);

  if (slaBreachedCount > 0) {
    y = drawMetricCard(page, font, fontBold,
      'НАРУШЕНИЙ SLA', String(slaBreachedCount),
      C.redBg, C.red, Math.min(slaBreachedCount / maxCreated, 1), ml, y, cw, 34);
  }

  y -= 16;

  // ── § 02 Разбивка по категориям ─────────────────────────────────────────
  if (byCategory.length > 0) {
    y = drawSection(page, fontBold, '02', 'Разбивка по категориям', ml, y);
    const maxCat = Math.max(...byCategory.map(c => c.count), 1);
    for (const { category, count } of byCategory) {
      y = drawHorizontalBar(
        page, font, fontBold,
        CATEGORY_LABELS[category] ?? category, count, maxCat,
        CATEGORY_COLORS[category] ?? C.grey50,
        ml, y, cw, 22,
      );
    }
    y -= 16;
  }

  // ── § 03 Разбивка по приоритетам ────────────────────────────────────────
  if (byPriority.length > 0) {
    y = drawSection(page, fontBold, '03', 'Разбивка по приоритетам', ml, y);
    const maxPri = Math.max(...byPriority.map(p => p.count), 1);
    for (const { priority, count } of byPriority) {
      y = drawHorizontalBar(
        page, font, fontBold,
        PRIORITY_LABELS[priority] ?? priority, count, maxPri,
        PRIORITY_COLORS[priority] ?? C.grey50,
        ml, y, cw, 22,
      );
    }
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  const footerY = 35;
  page.drawLine({
    start: { x: ml, y: footerY + 12 },
    end: { x: width - mr, y: footerY + 12 },
    thickness: 0.5, color: C.grey15,
  });
  const footerLeft = `AituDesk Service Desk · Сформировано: ${now.toISOString().slice(0, 16).replace('T', ' ')}`;
  page.drawText(footerLeft, { x: ml, y: footerY, size: 8, font, color: C.grey50 });
  const brand = 'AituDesk';
  const brandW = fontBold.widthOfTextAtSize(brand, 8);
  page.drawText(brand, {
    x: width - mr - brandW, y: footerY,
    size: 8, font: fontBold, color: C.grey50,
  });

  return await doc.save();
}
