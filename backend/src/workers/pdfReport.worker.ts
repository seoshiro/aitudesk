/**
 * PDF Report Worker.
 *
 * Запускается в отдельном Node.js Worker Thread из `runPdfReportWorker()`.
 * Получает данные через `workerData`, генерирует PDF через чистую функцию
 * `buildReportPdf` и возвращает байты обратно через `parentPort.postMessage`.
 *
 * Это снимает основной event loop с тяжёлой синхронной работы pdf-lib
 * (embedFont, drawText, save) — пока worker считает, основной поток
 * продолжает обслуживать другие HTTP-запросы.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { buildReportPdf, type ReportInput } from '../services/report.service';

async function run(): Promise<void> {
  if (!parentPort) {
    throw new Error('pdfReport.worker must be spawned as a Worker thread');
  }

  try {
    const bytes = await buildReportPdf(workerData as ReportInput);
    // Transfer the underlying ArrayBuffer to avoid an extra copy.
    const buffer = Buffer.from(bytes);
    parentPort.postMessage(
      { ok: true, buffer },
      [buffer.buffer as ArrayBuffer],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    parentPort.postMessage({ ok: false, error: message });
  }
}

void run();
