/**
 * Скрипт автоматического обхода всех роутов фронтенда AituDesk
 * и сохранения скриншотов (desktop + mobile, full page).
 *
 * Запуск:
 *   1. Установите Playwright (один раз):
 *        npm i -D playwright
 *        npx playwright install chromium
 *   2. Запустите фронт + бэк (docker compose up или локально).
 *   3. node scripts/screenshots.mjs
 *
 * Переменные окружения (опционально):
 *   FRONTEND_URL  (default: http://localhost:7754)
 *   API_URL       (default: http://localhost:4829/api)
 *   OUT_DIR       (default: ./screenshots)
 *   ROLE          USER | AGENT | ADMIN (default: ADMIN)
 *   EMAIL, PASSWORD — переопределить аккаунт вручную
 */

import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:7754';
const API_URL = process.env.API_URL || 'http://localhost:4829/api';
const OUT_DIR = process.env.OUT_DIR || path.resolve('screenshots');
const ROLE = (process.env.ROLE || 'ADMIN').toUpperCase();

const PRESET = {
  ADMIN: { email: 'admin@aitudesk.kz', password: 'Admin123!' },
  AGENT: { email: 'agent1@aitudesk.kz', password: 'Agent123!' },
  USER: { email: 'user1@aitudesk.kz', password: 'User123!' },
};
const CREDS = {
  email: process.env.EMAIL || PRESET[ROLE]?.email || PRESET.ADMIN.email,
  password: process.env.PASSWORD || PRESET[ROLE]?.password || PRESET.ADMIN.password,
};

/** Список роутов. Для динамических :id подставим первый доступный. */
const STATIC_ROUTES = [
  { name: '01-login', path: '/login', public: true },
  { name: '02-register', path: '/register', public: true },
  { name: '03-dashboard', path: '/dashboard' },
  { name: '04-tickets', path: '/tickets' },
  { name: '05-tickets-create', path: '/tickets/create' },
  { name: '06-kb', path: '/kb' },
  { name: '07-kb-create', path: '/kb/create', roles: ['ADMIN'] },
  { name: '08-profile', path: '/profile' },
  { name: '09-notifications', path: '/notifications' },
  { name: '10-users', path: '/users', roles: ['ADMIN'] },
  { name: '99-not-found', path: '/this-page-does-not-exist' },
];

const VIEWPORTS = [
  { tag: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { tag: 'mobile', ...devices['iPhone 13'] },
];

async function login() {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDS),
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const cookies = res.headers.getSetCookie?.() || [];
  return { ...data, refreshCookies: cookies };
}

async function fetchFirstId(token, endpoint, key = 'id') {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const arr = Array.isArray(json) ? json : json.data || json.items || json.tickets || json.articles;
    return Array.isArray(arr) && arr[0] ? arr[0][key] : null;
  } catch {
    return null;
  }
}

function safeName(s) {
  return s.replace(/[^a-z0-9._-]+/gi, '_');
}

async function captureRoute(browser, { name, path: routePath, public: isPublic }, auth) {
  for (const v of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: v.viewport,
      deviceScaleFactor: v.deviceScaleFactor,
      userAgent: v.userAgent,
      isMobile: v.isMobile,
      hasTouch: v.hasTouch,
    });

    if (!isPublic && auth) {
      // Сидим localStorage, чтобы zustand persist подхватил сессию
      await context.addInitScript((payload) => {
        window.localStorage.setItem(
          'aitudesk-auth',
          JSON.stringify({
            state: { user: payload.user, accessToken: payload.accessToken },
            version: 0,
          })
        );
      }, { user: auth.user, accessToken: auth.accessToken });
      // refresh cookie (если бэк отдаёт httpOnly — addCookies не нужен, fetch уже его не вернёт)
    }

    const page = await context.newPage();
    const url = `${FRONTEND_URL}${routePath}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(800);
      const file = path.join(OUT_DIR, `${safeName(name)}_${v.tag}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  ✓ ${v.tag.padEnd(7)} ${routePath}  →  ${path.relative(process.cwd(), file)}`);
    } catch (err) {
      console.log(`  ✗ ${v.tag.padEnd(7)} ${routePath}  —  ${err.message}`);
    } finally {
      await context.close();
    }
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`▶ Frontend: ${FRONTEND_URL}`);
  console.log(`▶ Output:   ${OUT_DIR}`);
  console.log(`▶ Role:     ${ROLE} (${CREDS.email})\n`);

  console.log('🔐 Logging in via API...');
  const auth = await login();
  console.log(`   ok, role=${auth.user?.role}\n`);

  // Подтянуть динамические id
  const ticketId = await fetchFirstId(auth.accessToken, '/tickets?limit=1');
  const kbId = await fetchFirstId(auth.accessToken, '/kb?limit=1');
  const dynamic = [];
  if (ticketId) dynamic.push({ name: '11-ticket-detail', path: `/tickets/${ticketId}` });
  if (kbId) {
    dynamic.push({ name: '12-kb-article', path: `/kb/${kbId}` });
    dynamic.push({ name: '13-kb-edit', path: `/kb/${kbId}/edit`, roles: ['ADMIN'] });
  }

  const routes = [...STATIC_ROUTES, ...dynamic].filter(
    (r) => !r.roles || r.roles.includes(auth.user?.role)
  );

  const browser = await chromium.launch();
  try {
    for (const r of routes) {
      console.log(`📸 ${r.path}`);
      await captureRoute(browser, r, auth);
    }
  } finally {
    await browser.close();
  }
  console.log(`\n✅ Done. ${routes.length * VIEWPORTS.length} скринов в ${OUT_DIR}`);
}

main().catch((e) => {
  console.error('💥', e);
  process.exit(1);
});
