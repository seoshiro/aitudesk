/**
 * Запуск генерации PDF-отчёта в отдельном Worker Thread.
 *
 * Production (dist):   запускает `dist/workers/pdfReport.worker.js`.
 * Test / VITEST:       fallback на синхронный вызов `buildReportPdf` —
 *                      worker-файл может ещё не быть скомпилирован, а сам
 *                      воркер мешает изоляции тестов.
 * Dev (ts-node):       тоже fallback — путь до .js не существует.
 *
 * Снимает блокировку event loop с тяжёлой работы pdf-lib (раньше p95 latency
 * улетал на ~5s во время генерации; теперь основной поток свободен).
 */
import path from 'node:path';
import fs from 'node:fs';
import { Worker } from 'node:worker_threads';
import { buildReportPdf, type ReportInput } from './report.service';

const WORKER_FILENAME = 'pdfReport.worker.js';

function resolveWorkerPath(): string | null {
  // __dirname в production будет .../dist/services
  const candidates = [
    path.resolve(__dirname, '..', 'workers', WORKER_FILENAME),
    path.resolve(process.cwd(), 'dist', 'workers', WORKER_FILENAME),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function shouldUseFallback(): boolean {
  if (process.env['VITEST']) return true;
  if (process.env['NODE_ENV'] === 'test') return true;
  if (process.env['PDF_WORKER_DISABLED'] === '1') return true;
  return resolveWorkerPath() === null;
}

export async function runPdfReport(input: ReportInput): Promise<Buffer> {
  // Fallback path
  if (shouldUseFallback()) {
    const bytes = await buildReportPdf(input);
    return Buffer.from(bytes);
  }

  const workerPath = resolveWorkerPath()!;

  return await new Promise<Buffer>((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData: input });

    const cleanup = (): void => {
      worker.removeAllListeners();
    };

    worker.on('message', (msg: { ok: boolean; buffer?: Buffer; error?: string }) => {
      cleanup();
      void worker.terminate();
      if (msg.ok && msg.buffer) {
        resolve(Buffer.from(msg.buffer));
      } else {
        reject(new Error(msg.error ?? 'PDF worker returned no payload'));
      }
    });

    worker.on('error', (err) => {
      cleanup();
      void worker.terminate();
      reject(err);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        cleanup();
        reject(new Error(`PDF worker exited with code ${code}`));
      }
    });
  });
}
