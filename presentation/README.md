# AituDesk · Presentation

Editorial-стиль презентация дипломного проекта в формате `.pptx` с нативными
PowerPoint-переходами (Fade · Push · Morph · Split · Wipe).

## Файлы

| Файл | Что это |
|---|---|
| `build.py` | Генератор: 20 слайдов, дизайн-система, screenshot showcases, transitions |
| `AituDesk-Presentation.pptx` | Готовая презентация (открывать в PowerPoint 2019+ или Microsoft 365) |

## Перегенерировать

```powershell
# Один раз — установка зависимостей
python -m pip install python-pptx Pillow

# Сборка
python build.py
```

Скрипт берёт скриншоты из `../screenshots/` (11 штук, desktop-версия каждого экрана).

## Структура (20 слайдов)

| # | Раздел | Источник |
|---|---|---|
| 01 | Cover · Service Desk для колледжа | — |
| 02 | § 01 — О проекте | README.md |
| 03 | § 02 — Технологический стек | README.md |
| 04 | § 03 — Роли пользователей | README.md |
| 05 | § 04 — Жизненный цикл тикета | README.md |
| 06 | § 05 — SLA по приоритетам | README.md |
| 07 | § 06 — Аутентификация | `screenshots/01-login_desktop.png` |
| 08 | § 07 — Регистрация | `screenshots/02-register_desktop.png` |
| 09 | § 08 — Дашборд | `screenshots/03-dashboard_desktop.png` |
| 10 | § 09 — Лента тикетов | `screenshots/04-tickets_desktop.png` |
| 11 | § 10 — Деталь тикета + чат | `screenshots/11-ticket-detail_desktop.png` |
| 12 | § 11 — Создание тикета | `screenshots/05-tickets-create_desktop.png` |
| 13 | § 12 — База знаний | `screenshots/06-kb_desktop.png` |
| 14 | § 13 — Уведомления | `screenshots/09-notifications_desktop.png` |
| 15 | § 14 — Админ · пользователи | `screenshots/10-users_desktop.png` |
| 16 | § 15 — Профиль | `screenshots/08-profile_desktop.png` |
| 17 | § 16 — Realtime через Socket.IO | README.md |
| 18 | § 17 — Мониторинг (Prometheus + Grafana) | README.md |
| 19 | § 18 — Тестирование (Vitest + Supertest) | README.md |
| 20 | Финал · Спасибо | — |

## Дизайн-система

Снята с фронтенда AituDesk (`frontend/src/index.css`) — editorial/газета:

- **Палитра.** Бумажный фон `#FAF8F2`, чернила `#1A1A2E`, акцент-бургунди `#B33B3B`,
  navy-primary `#2D3A6E`, статусные цвета (success/warning/info) для SLA и flow.
- **Типографика.** Georgia (Literata fallback) для заголовков, Calibri (Inter fallback)
  для body, Consolas (Geist Mono fallback) для номеров, ID, чисел.
- **Сигнатура.** § нумерация секций, тонкие hairlines `#D8D0BE`,
  двойная rule под masthead, monospaced uppercase tracking 200–400.

## Анимация

Каждый слайд имеет нативный PowerPoint transition, добавленный через прямую запись
XML в `<p:sld>`:

| Слайд | Transition |
|---|---|
| 01 (Cover) | `fade` slow |
| 02–06 (контент) | `push left` / `fade` |
| 07–16 (скриншоты) | чередование `morph` / `push` / `fade` |
| 17 (Realtime) | `split horizontal out` |
| 18 (Мониторинг) | `push left` |
| 19 (Тесты) | `wipe left` |
| 20 (Финал) | `fade` slow |

`Morph` (PowerPoint 2019+/365) даёт smooth-переходы между screenshot-слайдами,
если общие элементы есть — masthead/footer плавно сохраняются.

## Совместимость

| Программа | Поддержка |
|---|---|
| **PowerPoint 365 / 2019+** | ✅ Все transitions работают (включая Morph) |
| **PowerPoint 2016** | ⚠ Morph деградирует до Fade, остальное OK |
| **LibreOffice Impress** | ⚠ Большинство transitions OK, Morph не поддерживается |
| **Google Slides** | ⚠ Импорт работает, transitions могут упроститься |
| **Keynote** | ⚠ Morph ↦ Magic Move (близкий аналог) |

Шрифты Georgia / Calibri / Consolas — стандартные на Windows и macOS, fallback
не требуется. На Linux (без MS-шрифтов) система подставит DejaVu Serif / Sans / Mono.
