import { PrismaClient, Role, TicketCategory, Priority, TicketStatus, MessageType, KnowledgeLocale } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
const AGENT_PASSWORD = process.env.SEED_AGENT_PASSWORD ?? 'Agent123!';
const USER_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'User123!';

const seedTitleTranslations: Record<string, { en: string; kk: string }> = {
  'Как сбросить пароль учётной записи': {
    en: 'How to reset an account password',
    kk: 'Есептік жазба құпиясөзін қалай қалпына келтіруге болады',
  },
  'Установка Microsoft Office 365': {
    en: 'Installing Microsoft Office 365',
    kk: 'Microsoft Office 365 орнату',
  },
  'Outlook не получает письма — что делать': {
    en: 'Outlook is not receiving mail',
    kk: 'Outlook хаттарды қабылдамаса не істеу керек',
  },
  'Как настроить почту на iPhone и Android': {
    en: 'Setting up email on iPhone and Android',
    kk: 'iPhone және Android құрылғыларында поштаны баптау',
  },
  'Удаление вирусов и рекламного ПО в браузере': {
    en: 'Removing browser viruses and adware',
    kk: 'Браузердегі вирус пен жарнамалық бағдарламаны жою',
  },
  'Как защититься от фишинга и подозрительных писем': {
    en: 'Protecting yourself from phishing and suspicious emails',
    kk: 'Фишингтен және күмәнді хаттардан қорғану',
  },
  'Электронный журнал Kundelik не загружается': {
    en: 'Kundelik electronic journal does not load',
    kk: 'Kundelik электрондық журналы жүктелмейді',
  },
  'Установка и настройка 1С:Бухгалтерия': {
    en: 'Installing and configuring 1C Accounting',
    kk: '1С:Бухгалтерия орнату және баптау',
  },
  'Лицензии на специализированный софт (AutoCAD, MATLAB, Adobe)': {
    en: 'Licenses for specialized software: AutoCAD, MATLAB, Adobe',
    kk: 'Арнайы бағдарламалар лицензиялары: AutoCAD, MATLAB, Adobe',
  },
  'Office 365 не запускается после Windows Update': {
    en: 'Office 365 does not start after Windows Update',
    kk: 'Windows Update кейін Office 365 іске қосылмайды',
  },
  'Принтер не печатает — пошаговое решение': {
    en: 'Printer is not printing: step-by-step fix',
    kk: 'Принтер басып шығармайды: қадамдық шешім',
  },
  'Как подключиться к проектору': {
    en: 'How to connect to a projector',
    kk: 'Проекторға қалай қосылуға болады',
  },
  'Настройка Wi-Fi на ноутбуке': {
    en: 'Configuring Wi-Fi on a laptop',
    kk: 'Ноутбукте Wi-Fi баптау',
  },
  'Нет доступа к сетевой папке': {
    en: 'No access to a network folder',
    kk: 'Желілік бумаға қолжетімділік жоқ',
  },
  'Как получить VPN-доступ для удалённой работы': {
    en: 'How to request VPN access for remote work',
    kk: 'Қашықтан жұмыс үшін VPN қолжетімділігін алу',
  },
  'Медленный интернет — диагностика': {
    en: 'Slow internet: diagnostics',
    kk: 'Баяу интернет: диагностика',
  },
  'Как создать заявку в Service Desk': {
    en: 'How to create a Service Desk ticket',
    kk: 'Service Desk өтінімін қалай құруға болады',
  },
  'Резервное копирование рабочих файлов': {
    en: 'Backing up work files',
    kk: 'Жұмыс файлдарының резервтік көшірмесін жасау',
  },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function englishContent(title: string, category: TicketCategory, tags: string[]): string {
  return `## ${title}

This official AituDesk knowledge-base article explains a common ${category.toLowerCase()} support scenario for the college.

1. Check the basic conditions first: power, network connection, account access, or the exact error text.
2. Restart the affected application or device if it is safe to do so.
3. Record the room number, device model, user account, screenshots, and any recent changes.
4. If the issue is not resolved, create a Service Desk ticket and choose the ${category} category.

Useful keywords: ${tags.join(', ')}.`;
}

function kazakhContent(title: string, category: TicketCategory, tags: string[]): string {
  return `## ${title}

Бұл AituDesk базасындағы ресми мақала колледждегі ${category} санатына қатысты жиі кездесетін жағдайды түсіндіреді.

1. Алдымен негізгі шарттарды тексеріңіз: қуат көзі, желі қосылымы, есептік жазба немесе қате мәтіні.
2. Қауіпсіз болса, қолданбаны немесе құрылғыны қайта іске қосыңыз.
3. Аудитория нөмірін, құрылғы моделін, пайдаланушы аккаунтын, скриншоттарды және соңғы өзгерістерді жазып алыңыз.
4. Мәселе шешілмесе, Service Desk өтінімін құрып, ${category} санатын таңдаңыз.

Пайдалы кілтсөздер: ${tags.join(', ')}.`;
}

async function main(): Promise<void> {
  console.log('🌱 Starting database seed...');

  // Seed must be additive/idempotent: never delete user tickets, messages,
  // ratings, or admin-authored KB articles during normal backend startup.
  // ── SLA Policies ────────────────────────────────────────────────────────
  await prisma.slaPolicy.upsert({ where: { priority: Priority.CRITICAL }, update: {}, create: { priority: Priority.CRITICAL, responseHours: 2, resolutionHours: 4 } });
  await prisma.slaPolicy.upsert({ where: { priority: Priority.HIGH }, update: {}, create: { priority: Priority.HIGH, responseHours: 4, resolutionHours: 8 } });
  await prisma.slaPolicy.upsert({ where: { priority: Priority.MEDIUM }, update: {}, create: { priority: Priority.MEDIUM, responseHours: 8, resolutionHours: 24 } });
  await prisma.slaPolicy.upsert({ where: { priority: Priority.LOW }, update: {}, create: { priority: Priority.LOW, responseHours: 24, resolutionHours: 72 } });
  console.log('✅ SLA policies created');

  // ── Admin ───────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aitudesk.kz' },
    update: {},
    create: { email: 'admin@aitudesk.kz', passwordHash: adminHash, name: 'Айгерим Досова', role: Role.ADMIN, specializations: [] },
  });

  // ── Agents ──────────────────────────────────────────────────────────────
  const agentHash = await bcrypt.hash(AGENT_PASSWORD, 12);
  const agent1 = await prisma.user.upsert({
    where: { email: 'agent1@aitudesk.kz' },
    update: {},
    create: { email: 'agent1@aitudesk.kz', passwordHash: agentHash, name: 'Дамир Сейткали', role: Role.AGENT, specializations: [TicketCategory.HARDWARE, TicketCategory.NETWORK] },
  });
  const agent2 = await prisma.user.upsert({
    where: { email: 'agent2@aitudesk.kz' },
    update: {},
    create: { email: 'agent2@aitudesk.kz', passwordHash: agentHash, name: 'Айша Нурланова', role: Role.AGENT, specializations: [TicketCategory.SOFTWARE] },
  });
  const agent3 = await prisma.user.upsert({
    where: { email: 'agent3@aitudesk.kz' },
    update: {},
    create: { email: 'agent3@aitudesk.kz', passwordHash: agentHash, name: 'Бекзат Ахметов', role: Role.AGENT, specializations: [TicketCategory.NETWORK, TicketCategory.OTHER] },
  });
  console.log('✅ Agents created');

  // ── Users ───────────────────────────────────────────────────────────────
  const userHash = await bcrypt.hash(USER_PASSWORD, 12);
  const userNames = ['Алина Ким', 'Руслан Жаксыбеков', 'Жанна Сейткалиева', 'Нурлан Абенов', 'Дина Мухамеджан'];
  const users = [];
  for (let i = 1; i <= 5; i++) {
    const u = await prisma.user.upsert({
      where: { email: `user${i}@aitudesk.kz` },
      update: {},
      create: { email: `user${i}@aitudesk.kz`, passwordHash: userHash, name: userNames[i - 1] ?? `User ${i}`, role: Role.USER },
    });
    users.push(u);
  }
  console.log('✅ Users created');

  // ── Knowledge Articles ──────────────────────────────────────────────────
  const kbArticles: Array<{ title: string; content: string; category: TicketCategory; tags: string[] }> = [
    // ── SOFTWARE ──────────────────────────────────────────────────────────
    {
      title: 'Как сбросить пароль учётной записи',
      content: '## Сброс пароля\n\nЕсли вы забыли пароль от корпоративной учётной записи, выполните следующие шаги:\n\n1. Перейдите на страницу входа в портал колледжа\n2. Нажмите ссылку «Забыли пароль?»\n3. Введите ваш корпоративный email (формат `i.familiya@aitu.kz`)\n4. Проверьте почту и перейдите по ссылке из письма\n5. Задайте новый пароль (минимум 12 символов, цифры и спецсимволы)\n\nЕсли письмо не пришло в течение 5 минут — проверьте папку «Спам». Если и там его нет — создайте заявку SOFTWARE с темой «Сброс пароля».',
      category: TicketCategory.SOFTWARE,
      tags: ['пароль', 'аккаунт', 'логин', 'почта', 'reset'],
    },
    {
      title: 'Установка Microsoft Office 365',
      content: '## Установка Office 365 для преподавателей и студентов\n\n1. Откройте portal.office.com\n2. Войдите с корпоративным аккаунтом (@aitu.kz)\n3. Нажмите «Установить Office» в правом верхнем углу\n4. Скачается установочный файл (~7 МБ)\n5. Запустите его — установка займёт 15–30 минут в зависимости от скорости интернета\n\nЛицензия активируется автоматически при первом входе. Если просит ключ — выйдите из аккаунта и зайдите заново через `Файл → Учётная запись → Выйти`.\n\nКоличество устройств на одну учётку: 5 ПК + 5 телефонов + 5 планшетов.',
      category: TicketCategory.SOFTWARE,
      tags: ['office', 'word', 'excel', 'установка', 'лицензия'],
    },
    {
      title: 'Outlook не получает письма — что делать',
      content: '## Проблемы с почтой Outlook\n\n### Самопроверка:\n1. Проверьте подключение к интернету (откройте любой сайт)\n2. Откройте `Файл → Параметры учётной записи → Параметры` и нажмите «Проверить почту»\n3. Очистите папку «Исходящие» — застрявшее письмо может блокировать приём\n4. Закройте Outlook → дождитесь полного завершения процесса в Диспетчере задач → откройте снова\n\n### Если не помогло:\n- Удалите учётную запись и добавьте заново через `Файл → Добавить учётную запись`\n- Проверьте, не заполнен ли почтовый ящик (лимит 50 ГБ)\n\nЕсли проблема с конкретным письмом — переслать тикет SOFTWARE с приложенным скриншотом ошибки.',
      category: TicketCategory.SOFTWARE,
      tags: ['outlook', 'почта', 'email', 'exchange'],
    },
    {
      title: 'Как настроить почту на iPhone и Android',
      content: '## Корпоративная почта на смартфоне\n\n### iPhone (через Exchange ActiveSync):\n1. Настройки → Почта → Учётные записи → Добавить учётную запись\n2. Выберите **Microsoft Exchange**\n3. Email: `i.familiya@aitu.kz`, Описание: AituMail\n4. Пароль — корпоративный\n5. Сервер оставьте пустым — iPhone подтянет автоматически\n\n### Android (Outlook app):\n1. Установите Microsoft Outlook из Google Play\n2. Введите корпоративный email\n3. Пароль — корпоративный\n4. Дайте разрешения на уведомления\n\nЕсли подключение не проходит — попробуйте включить VPN или проверьте, не блокирует ли работодатель доступ извне колледжа.',
      category: TicketCategory.SOFTWARE,
      tags: ['почта', 'iphone', 'android', 'мобильный', 'exchange'],
    },
    {
      title: 'Удаление вирусов и рекламного ПО в браузере',
      content: '## Браузер открывает рекламу — пошаговая чистка\n\n### Признаки заражения:\n- Вкладки с рекламой казино, push-уведомления\n- Стартовая страница изменилась\n- Новые расширения, которых вы не ставили\n\n### Чистка:\n1. Откройте `chrome://extensions` → удалите подозрительные расширения\n2. Сбросьте настройки браузера: `chrome://settings/reset`\n3. Запустите Kaspersky → полная проверка системы\n4. Дополнительно: AdwCleaner или Malwarebytes (бесплатные)\n5. Очистите автозагрузку: `Win+R → msconfig → Автозагрузка`\n\nЕсли заражение не уходит — создайте тикет SOFTWARE с пометкой CRITICAL и не вводите пароли до диагностики.',
      category: TicketCategory.SOFTWARE,
      tags: ['вирус', 'реклама', 'chrome', 'браузер', 'безопасность'],
    },
    {
      title: 'Как защититься от фишинга и подозрительных писем',
      content: '## Фишинговые письма — как распознать\n\n### Красные флаги:\n- Срочность («аккаунт будет удалён через 24 часа»)\n- Письмо от службы поддержки с адреса вне домена @aitu.kz\n- Просьба перейти по ссылке и ввести пароль\n- Ошибки в имени домена (`aitu-college.com` вместо `aitu.kz`)\n- Вложения `.exe`, `.zip`, `.scr`, макросы в `.docm`\n\n### Что делать:\n1. **Не нажимайте ссылки**, не открывайте вложения\n2. Перешлите письмо как вложение на security@aitu.kz\n3. Удалите письмо\n\n### Если уже ввели пароль:\n- Немедленно смените пароль (Office 365 → Мой профиль → Пароль)\n- Включите двухфакторную аутентификацию\n- Создайте тикет с приоритетом CRITICAL',
      category: TicketCategory.SOFTWARE,
      tags: ['фишинг', 'безопасность', 'phishing', 'почта'],
    },
    {
      title: 'Электронный журнал Kundelik не загружается',
      content: '## Kundelik — типовые проблемы и решения\n\n### Журнал не открывается:\n1. Очистите кэш браузера (`Ctrl+Shift+Delete`)\n2. Попробуйте режим инкогнито\n3. Откройте в Chrome или Edge — Firefox иногда некорректно работает с SOAP\n\n### Не показываются классы:\n1. Проверьте, что вы вошли под корпоративным аккаунтом, а не личным\n2. Закройте все вкладки Kundelik и откройте заново\n3. Если у вас несколько ролей (учитель + куратор) — переключитесь в правом верхнем углу\n\n### Не сохраняются оценки:\n- Время сессии — 30 минут. Если не нажимать «Сохранить» дольше — пропадёт. Сохраняйте после каждого изменения.\n- Если сервер недоступен — обратитесь в Service Desk SOFTWARE с пометкой CRITICAL до 18:00 в день сдачи.',
      category: TicketCategory.SOFTWARE,
      tags: ['kundelik', 'журнал', 'оценки', 'преподаватель'],
    },
    {
      title: 'Установка и настройка 1С:Бухгалтерия',
      content: '## 1С на рабочем месте бухгалтера\n\n### Установка:\n1. Запросите дистрибутив у системного администратора (тикет SOFTWARE)\n2. Запустите `setup.exe` от имени администратора\n3. Выберите «Полная установка» (Платформа + Конфигурация)\n\n### Подключение к серверной базе:\n1. Откройте 1С → «Добавить» → «Добавление в список существующей информационной базы»\n2. Тип: **Сервер 1С:Предприятия**\n3. Кластер: `1c-srv.aitu.local`, имя базы: `accounting_main`\n4. Пользователь: ваша корпоративная учётка\n\n### Ошибка «Не удалось получить список баз»:\n- Перезапустите службу `1C:Enterprise Server Agent` (требует прав админа)\n- Проверьте, что вы в одной сети с сервером (VPN не работает — используйте RDP)',
      category: TicketCategory.SOFTWARE,
      tags: ['1с', '1c', 'бухгалтерия', 'предприятие'],
    },
    {
      title: 'Лицензии на специализированный софт (AutoCAD, MATLAB, Adobe)',
      content: '## Получение академических лицензий\n\n### AutoCAD (для кафедры архитектуры):\n- Студенты — бесплатно через Autodesk Education на 1 год\n- Регистрация на autodesk.com/education с почтой @aitu.kz\n\n### MATLAB:\n- Лицензия 30 мест, ключ у завлаба кафедры КТ\n- Установка через `Login Named User` → ваш корпоративный email\n\n### Adobe Creative Cloud:\n- Лицензий нет, но есть бесплатный Adobe Express\n- Альтернатива: GIMP, Inkscape, DaVinci Resolve\n\nДля установки на компьютер колледжа — создайте тикет SOFTWARE с указанием названия ПО, аудитории и обоснованием.',
      category: TicketCategory.SOFTWARE,
      tags: ['autocad', 'matlab', 'adobe', 'лицензия', 'софт'],
    },
    {
      title: 'Office 365 не запускается после Windows Update',
      content: '## Office перестал работать после обновления Windows\n\n### Типовые ошибки:\n- `0x8004FC12` — нарушена активация\n- `Cannot start Word` — повреждены компоненты\n\n### Решение (Quick Repair):\n1. Параметры → Приложения → Найдите Microsoft 365\n2. Нажмите «Изменить» → **Быстрое восстановление**\n3. Перезагрузите ПК\n\n### Если не помогло (Online Repair):\n1. Тот же путь → **Восстановление по сети**\n2. Потребуется интернет (~700 МБ)\n3. Время: 20–40 минут\n\n### Полная переустановка:\n1. Удалите Office через `setup.officedeploymenttool`\n2. Скачайте заново с portal.office.com\n3. Активация — автоматически по корпоративной учётке',
      category: TicketCategory.SOFTWARE,
      tags: ['office', 'windows update', 'word', 'excel', 'ремонт'],
    },

    // ── HARDWARE ──────────────────────────────────────────────────────────
    {
      title: 'Принтер не печатает — пошаговое решение',
      content: '## Принтер не работает\n\n### Базовые проверки:\n1. Убедитесь, что принтер включён и индикатор горит зелёным\n2. Проверьте, что бумага загружена и нет замятия\n3. Проверьте уровень тонера/чернил\n4. Проверьте сетевой кабель или Wi-Fi\n\n### Программные шаги:\n1. Откройте `Параметры → Bluetooth и устройства → Принтеры и сканеры`\n2. Выберите принтер → «Открыть очередь» → отмените все задания\n3. Перезапустите службу: `Win+R → services.msc → Диспетчер печати → Перезапустить`\n4. Если принтер показан как «Автономный» — снимите этот режим\n\n### Если ничего не помогает:\n- Удалите принтер и добавьте заново\n- Скачайте свежий драйвер с сайта производителя\n- Создайте тикет HARDWARE с моделью принтера и текстом ошибки',
      category: TicketCategory.HARDWARE,
      tags: ['принтер', 'печать', 'hp', 'canon', 'драйвер'],
    },
    {
      title: 'Как подключиться к проектору',
      content: '## Подключение ноутбука к проектору\n\n### Шаги:\n1. Подключите HDMI кабель к ноутбуку и проектору\n2. Включите проектор кнопкой на корпусе или пульте\n3. Дождитесь инициализации (10–30 секунд)\n4. На ноутбуке нажмите `Win+P` → выберите режим:\n   - **Только экран ПК** — изображение только на ноуте\n   - **Дублировать** — одинаковое на обоих\n   - **Расширить** — рабочий стол растянут\n   - **Только второй экран** — только проектор\n\n### Нет сигнала:\n- На пульте проектора нажмите `Source` или `Input` → выберите HDMI\n- Проверьте, что используется правильный HDMI порт (обычно HDMI 1)\n- Попробуйте перезагрузить проектор и ноутбук\n\n### Только VGA:\n- Используйте переходник HDMI→VGA (есть у лаборанта)\n- VGA не передаёт звук — нужен дополнительно аудиокабель 3.5 мм',
      category: TicketCategory.HARDWARE,
      tags: ['проектор', 'hdmi', 'vga', 'презентация', 'epson'],
    },
    {
      title: 'Синий экран смерти (BSOD) — диагностика',
      content: '## Что делать при BSOD\n\n### Сразу после падения:\n1. **Запишите код ошибки** (`KERNEL_DATA_INPAGE_ERROR`, `IRQL_NOT_LESS_OR_EQUAL` и т.п.)\n2. Сфотографируйте QR-код с экрана\n3. Перезагрузите компьютер\n\n### Типовые причины и действия:\n- `KERNEL_DATA_INPAGE_ERROR` — проблема с диском. Запустите `chkdsk C: /f /r`\n- `MEMORY_MANAGEMENT` — проблемы с RAM. Запустите `mdsched.exe`\n- `DRIVER_IRQL_NOT_LESS_OR_EQUAL` — кривой драйвер. Откатите последний обновлённый\n- `SYSTEM_THREAD_EXCEPTION_NOT_HANDLED` — обычно драйвер видеокарты\n\n### Если падает регулярно:\n- Создайте тикет HARDWARE с приоритетом HIGH\n- Приложите `C:\\Windows\\Minidump\\*.dmp` (последний файл)\n- Не работайте на этом ПК до диагностики — возможна потеря данных',
      category: TicketCategory.HARDWARE,
      tags: ['bsod', 'синий экран', 'падение', 'kernel', 'диагностика'],
    },
    {
      title: 'Зависает ПК — диагностика и решение',
      content: '## Компьютер зависает или работает медленно\n\n### Быстрая диагностика:\n1. `Ctrl+Shift+Esc` — откройте Диспетчер задач\n2. Посмотрите вкладку «Производительность»:\n   - **CPU 100%** — какой-то процесс грузит. Завершите его на вкладке «Процессы»\n   - **Память 95%+** — мало RAM, нужно закрыть программы или добавить планку\n   - **Диск 100%** — проблема с HDD/SSD, см. раздел ниже\n\n### Высокая загрузка диска:\n1. Отключите индексацию: `services.msc → Windows Search → Отключить`\n2. Отключите SuperFetch/SysMain аналогично\n3. Если HDD старый (5+ лет) — он скоро умрёт, бэкапьте данные\n\n### Зависает только в одной программе:\n- Проверьте обновления программы\n- Переустановите её\n- Если зависает Photoshop/AutoCAD — проблема в RAM, нужно минимум 8 ГБ',
      category: TicketCategory.HARDWARE,
      tags: ['зависает', 'медленный', 'тормозит', 'cpu', 'память'],
    },
    {
      title: 'Не работает звук — пошаговая проверка',
      content: '## Пропал звук на компьютере\n\n### Проверка 1 — устройство по умолчанию:\n1. ПКМ по значку динамика → «Открыть параметры звука»\n2. Раздел «Вывод» → выберите правильное устройство (динамики/наушники)\n3. Проверьте громкость — не на нуле\n\n### Проверка 2 — драйверы:\n1. `Win+X → Диспетчер устройств`\n2. Раскройте «Звуковые устройства»\n3. Если есть жёлтый треугольник — ПКМ → «Обновить драйвер»\n4. Если нет устройств вообще — переустановите драйвер с сайта Realtek/материнки\n\n### Проверка 3 — физика:\n- Проверьте, что кабель воткнут в зелёный разъём (не розовый микрофонный)\n- На передней панели разъёмы могут не работать — попробуйте задние\n- Bluetooth наушники — проверьте уровень заряда\n\n### Лингафонный кабинет:\n- Проверьте кросс-коммутатор у преподавателя\n- Создайте тикет HARDWARE с номером ПК и аудитории',
      category: TicketCategory.HARDWARE,
      tags: ['звук', 'динамики', 'наушники', 'realtek', 'драйвер'],
    },
    {
      title: 'Замена монитора и подключение второго экрана',
      content: '## Подключение монитора к ПК\n\n### Подключение:\n1. Найдите свободный видеовыход на ПК: HDMI / DisplayPort / DVI / VGA\n2. Подключите кабель — порядок: ПК → кабель → монитор\n3. Включите монитор и выберите правильный источник кнопкой `Source`\n\n### Два монитора одновременно:\n1. `Win+P` → **Расширить**\n2. `Параметры → Система → Дисплей` → перетащите экраны в нужном порядке\n3. Выберите главный (там будет панель задач)\n\n### Проблемы:\n- **Нет сигнала** — кабель неисправен или не тот источник на мониторе\n- **Размытое изображение** — выставьте рекомендуемое разрешение и масштаб 100%\n- **Тусклые цвета** — нужен IPS, а не TN (для дизайна и фото)\n\nДля закупки нового монитора создайте тикет HARDWARE с приоритетом LOW и обоснованием (диагональ, тип матрицы, разрешение).',
      category: TicketCategory.HARDWARE,
      tags: ['монитор', 'экран', 'hdmi', 'displayport', 'два монитора'],
    },
    {
      title: 'Сканер документов не работает',
      content: '## Проблемы со сканированием\n\n### Ошибка «Устройство не готово»:\n1. Выключите сканер на 30 секунд → включите снова\n2. Проверьте, что USB кабель плотно сидит\n3. Откройте Параметры → Принтеры и сканеры → найдите сканер → нажмите «Тест»\n\n### Сканирует с полосами/искажениями:\n- Откройте крышку и протрите стекло мягкой тканью + средство для стёкол\n- Очистите ролики автоподатчика (если есть)\n\n### Не находит сканер:\n1. Удалите устройство → отсоедините USB → подождите 1 минуту\n2. Подключите снова → дождитесь автоустановки драйвера\n3. Если не помогает — установите драйвер с сайта производителя (Canon DR серия, HP ScanJet)\n\nДля Canon DR-C225 II используйте утилиту **CaptureOnTouch** — она надёжнее стандартного «Сканирование» Windows.',
      category: TicketCategory.HARDWARE,
      tags: ['сканер', 'canon', 'hp', 'документы'],
    },

    // ── NETWORK ───────────────────────────────────────────────────────────
    {
      title: 'Нет доступа к интернету в аудитории',
      content: '## Проблемы с интернетом — диагностика\n\n### Шаг 1 — физическое подключение:\n- Если кабель — убедитесь, что он плотно вставлен в обе стороны (на ПК и в розетку)\n- Если Wi-Fi — нажмите на значок сети, проверьте, что подключены к **AituCollege_5G**, а не к гостевой\n\n### Шаг 2 — командная строка:\n```\nipconfig /release\nipconfig /renew\nipconfig /flushdns\n```\nЕсли получили адрес `169.254.x.x` — DHCP не отвечает, проблема сетевая.\n\n### Шаг 3 — пинг:\n```\nping 8.8.8.8       — проверка интернета\nping aitu.kz       — проверка DNS\n```\n- Первый есть, второй нет — проблема с DNS, поменяйте на `8.8.8.8` и `1.1.1.1`\n- Оба не работают — создайте тикет NETWORK с указанием аудитории\n\n### Шаг 4 — другое устройство:\nПопробуйте подключиться с телефона к той же Wi-Fi. Если тоже нет — точно сетевая проблема.',
      category: TicketCategory.NETWORK,
      tags: ['интернет', 'wifi', 'сеть', 'ping', 'dns'],
    },
    {
      title: 'Wi-Fi постоянно отключается — что делать',
      content: '## Wi-Fi разрывается каждые несколько минут\n\n### Самопроверка:\n1. Перезагрузите Wi-Fi на ноутбуке (значок сети → отключить → включить через 10 секунд)\n2. «Забудьте» сеть и подключитесь заново с вводом пароля\n3. Обновите драйвер сетевой карты в Диспетчере устройств\n\n### Настройки энергосбережения:\n1. Диспетчер устройств → Сетевые адаптеры → ваш Wi-Fi\n2. ПКМ → Свойства → вкладка **Управление электропитанием**\n3. **Снимите** галочку «Разрешить отключение этого устройства»\n4. Это часто решает проблему на ноутбуках\n\n### Проблема массовая:\nЕсли Wi-Fi разрывается у нескольких человек на одном этаже — точка доступа перегружена или неисправна. Создайте тикет NETWORK с приоритетом HIGH, укажите:\n- Этаж и номера аудиторий\n- Время и частоту разрывов\n- Сколько человек страдает',
      category: TicketCategory.NETWORK,
      tags: ['wifi', 'wi-fi', 'разрыв', 'сеть', 'aitucollege'],
    },
    {
      title: 'Доступ к сетевой папке отдела',
      content: '## Не открывается \\\\fileserver\\share\\\n\n### Проверка прав:\n1. ПКМ по папке → Свойства → вкладка **Безопасность**\n2. Найдите вашу группу (обычно `KAF-IT`, `BUH`, `STUDENTS`)\n3. Если группы нет — у вас нет прав, нужно запросить через тикет NETWORK\n\n### Ошибка «Доступ запрещён»:\n1. Закройте все открытые файлы из этой папки\n2. Запустите `Win+R → cmd → net use * /delete` (отключит все сетевые подключения)\n3. Откройте папку заново — Windows запросит логин/пароль\n4. Введите: домен `AITU\\ваш_логин` + корпоративный пароль\n\n### Папка пропала вообще:\n- Проверьте VPN — для удалённой работы нужен корпоративный VPN\n- Проверьте, что вы в той же сети, что и сервер (не в гостевом Wi-Fi)\n\n### Запрос новых прав:\nСоздайте тикет NETWORK, укажите:\n- Точный путь к папке\n- Какое право нужно (чтение / запись / полный)\n- Обоснование (для какой работы)',
      category: TicketCategory.NETWORK,
      tags: ['сетевая папка', 'доступ', 'fileserver', 'shared', 'smb'],
    },
    {
      title: 'Настройка корпоративного VPN',
      content: '## VPN для удалённой работы\n\n### Зачем нужен:\n- Доступ к 1С Бухгалтерия из дома\n- Доступ к сетевым папкам \\\\fileserver\\\n- Безопасное подключение к корпоративным ресурсам\n\n### Запрос доступа:\n1. Создайте тикет NETWORK с темой «VPN для удалённой работы»\n2. Укажите ФИО, должность, ID сотрудника, кафедру\n3. Получите от админа: VPN-сервер, логин, пароль, конфиг-файл (`.ovpn`)\n\n### Установка (Windows):\n1. Скачайте OpenVPN GUI с официального сайта\n2. Поместите `.ovpn` файл в `C:\\Program Files\\OpenVPN\\config\\`\n3. Запустите OpenVPN GUI от имени администратора\n4. ПКМ по значку в трее → Connect → введите логин/пароль\n\n### Проверка:\n- После подключения должен появиться адрес из подсети `10.10.x.x`\n- Команда `ping 10.10.0.1` должна работать\n- Откройте `\\\\fileserver` — должны увидеть сетевые папки\n\n### Не подключается:\n- Проверьте, что брандмауэр или антивирус не блокируют OpenVPN\n- Попробуйте с мобильного интернета — может блокировать ваш домашний провайдер',
      category: TicketCategory.NETWORK,
      tags: ['vpn', 'openvpn', 'удалённая работа', 'home office'],
    },
    {
      title: 'Медленный интернет — диагностика',
      content: '## Интернет тормозит\n\n### Замер скорости:\n1. Откройте speedtest.net или fast.com\n2. Запустите тест\n3. Сравните с тарифом (для колледжа базовая аудитория — 50–100 Мбит/с)\n\n### Если скорость намного ниже:\n1. Закройте приложения, потребляющие сеть (Steam, торренты, OneDrive sync)\n2. В Диспетчере задач → вкладка «Производительность» → «Сеть» — посмотрите, что грузит канал\n3. Попробуйте с другого устройства — если на телефоне быстро, проблема в ПК (драйвер, вирусы)\n\n### Тормозит только в определённое время:\n- Часы пиковой нагрузки (10:00–14:00) — нормально, общий канал делится на всех\n- Если разница в 100x — обратитесь в Service Desk, возможно DDoS или зависшая точка\n\n### В библиотеке/общественной зоне:\n- Гостевая Wi-Fi имеет ограничение скорости 5 Мбит/с — это by design\n- Для нормальной скорости подключайтесь к корпоративной сети с авторизацией',
      category: TicketCategory.NETWORK,
      tags: ['медленный интернет', 'скорость', 'speedtest', 'тормозит'],
    },

    // ── OTHER ─────────────────────────────────────────────────────────────
    {
      title: 'Как создать заявку в Service Desk',
      content: '## Правильное оформление заявки\n\n### Что обязательно указать:\n1. **Тема** — кратко и по делу. Плохо: «Не работает». Хорошо: «Принтер HP в 305 не печатает после смены тонера»\n2. **Описание** — что произошло, что вы уже пробовали, какие сообщения об ошибках видели\n3. **Категория** — HARDWARE / SOFTWARE / NETWORK / OTHER\n4. **Приоритет:**\n   - **CRITICAL** — работа полностью остановлена для группы людей\n   - **HIGH** — работа затруднена, есть дедлайны\n   - **MEDIUM** — есть проблема, но можно работать\n   - **LOW** — улучшения, закупки, новые функции\n5. **Скриншоты ошибок** — приложите, если есть\n\n### Что не нужно делать:\n- Не дублируйте заявки — найдите свою в списке и добавьте комментарий\n- Не ставьте CRITICAL без реальной причины\n- Не пишите «Срочно!!!» в теме — приоритет указывается отдельным полем\n\n### SLA:\n- CRITICAL — ответ за 2 часа, решение за 4 часа\n- HIGH — ответ 4 ч / решение 8 ч\n- MEDIUM — 8 ч / 24 ч\n- LOW — 24 ч / 72 ч',
      category: TicketCategory.OTHER,
      tags: ['заявка', 'тикет', 'service desk', 'sla', 'правила'],
    },
    {
      title: 'Резервное копирование рабочих файлов',
      content: '## Бэкапы — это обязательно\n\n### Куда бэкапить:\n1. **OneDrive** (входит в Office 365) — 1 ТБ на пользователя, синхронизация автоматическая\n2. **Сетевая папка \\\\fileserver\\backup\\$username** — для общих рабочих документов\n3. **Внешний USB-диск** — для личных копий, минимум раз в неделю\n\n### Что бэкапить обязательно:\n- Рабочий стол\n- Папка «Документы»\n- Учебные материалы / лекции / научные работы\n- 1С базы (если работаете с бухгалтерией)\n- Закладки браузера и пароли (через синхронизацию аккаунта)\n\n### Чего никогда не делать:\n- Хранить единственную копию диссертации/диплома на одной флешке\n- Хранить пароли в текстовом файле без шифрования\n- Удалять «старые» файлы без копии\n\n### При сбое HDD:\n- Прекратите работу, не выключайте/включайте многократно\n- Создайте тикет HARDWARE с пометкой «требуется восстановление данных»\n- НЕ пытайтесь сами разобрать диск',
      category: TicketCategory.OTHER,
      tags: ['бэкап', 'backup', 'onedrive', 'резервное копирование'],
    },
  ];

  for (const article of kbArticles) {
    const slug = slugify(article.title).slice(0, 60);
    const id = `seed-kb-${slug}`;
    const translatedTitle = seedTitleTranslations[article.title] ?? {
      en: `AituDesk guide: ${article.tags.slice(0, 2).join(', ') || article.category.toLowerCase()}`,
      kk: `AituDesk нұсқаулығы: ${article.tags.slice(0, 2).join(', ') || article.category}`,
    };
    const storedArticle = await prisma.knowledgeArticle.upsert({
      where: { id },
      update: {},
      create: {
        id,
        title: article.title,
        content: article.content,
        category: article.category,
        tags: article.tags,
        authorId: admin.id,
        published: true,
      },
    });

    const translations = [
      { locale: KnowledgeLocale.ru, title: storedArticle.title, content: storedArticle.content },
      {
        locale: KnowledgeLocale.en,
        title: translatedTitle.en,
        content: englishContent(translatedTitle.en, article.category, article.tags),
      },
      {
        locale: KnowledgeLocale.kk,
        title: translatedTitle.kk,
        content: kazakhContent(translatedTitle.kk, article.category, article.tags),
      },
    ];

    for (const translation of translations) {
      await prisma.knowledgeArticleTranslation.upsert({
        where: {
          articleId_locale: {
            articleId: storedArticle.id,
            locale: translation.locale,
          },
        },
        update: {},
        create: {
          articleId: storedArticle.id,
          locale: translation.locale,
          title: translation.title,
          content: translation.content,
          slug: slugify(translation.title),
        },
      });
    }
  }
  console.log(`✅ ${kbArticles.length} knowledge articles created`);

  // ── Tickets ─────────────────────────────────────────────────────────────
  const now = new Date();
  const agents = [agent1, agent2, agent3];

  const ticketSpecs: Array<{
    subject: string; description: string; category: TicketCategory; priority: Priority;
    status: TicketStatus; creatorIdx: number; assigneeIdx?: number; hoursAgo: number;
  }> = [
    { subject: 'Принтер HP в 305 аудитории не печатает', description: 'HP LaserJet Pro M404dn — задания зависают в очереди, индикатор мигает оранжевым. Перезагрузка не помогла.', category: TicketCategory.HARDWARE, priority: Priority.HIGH, status: TicketStatus.IN_PROGRESS, creatorIdx: 0, assigneeIdx: 0, hoursAgo: 5 },
    { subject: 'Wi-Fi отключается каждые 5 минут', description: 'На 2-м этаже корпуса Б сеть AituCollege_5G постоянно разрывается. Студенты не могут работать на парах.', category: TicketCategory.NETWORK, priority: Priority.CRITICAL, status: TicketStatus.IN_PROGRESS, creatorIdx: 1, assigneeIdx: 2, hoursAgo: 3 },
    { subject: 'Не могу войти в 1С Бухгалтерию', description: 'При запуске 1С 8.3 появляется ошибка "Не удалось получить список информационных баз". Вчера всё работало нормально.', category: TicketCategory.SOFTWARE, priority: Priority.CRITICAL, status: TicketStatus.IN_PROGRESS, creatorIdx: 2, assigneeIdx: 1, hoursAgo: 1 },
    { subject: 'Проектор не видит ноутбук через HDMI', description: 'Epson EB-X51 в ауд. 101 — при подключении через HDMI изображение не появляется. VGA тоже не работает. Лампа менялась год назад.', category: TicketCategory.HARDWARE, priority: Priority.MEDIUM, status: TicketStatus.RESOLVED, creatorIdx: 3, assigneeIdx: 0, hoursAgo: 96 },
    { subject: 'Синий экран смерти на ПК №7', description: 'BSOD с кодом KERNEL_DATA_INPAGE_ERROR на рабочем месте №7 в ауд. 312. Происходит при открытии AutoCAD. Возможно проблема с HDD.', category: TicketCategory.HARDWARE, priority: Priority.HIGH, status: TicketStatus.NEW, creatorIdx: 4, hoursAgo: 2 },
    { subject: 'Нет доступа к сетевой папке отдела', description: '\\\\fileserver\\share\\kaf-IT — "Доступ запрещён" у учётки d.serikova. Коллеги с той же группой доступа заходят нормально.', category: TicketCategory.NETWORK, priority: Priority.HIGH, status: TicketStatus.RESOLVED, creatorIdx: 0, assigneeIdx: 2, hoursAgo: 60 },
    { subject: 'Завис компьютер в библиотеке', description: 'ПК на стойке №3 полностью завис — мышь и клавиатура не реагируют. Принудительная перезагрузка не помогает, зависает снова через 10 минут.', category: TicketCategory.HARDWARE, priority: Priority.MEDIUM, status: TicketStatus.NEW, creatorIdx: 1, hoursAgo: 4 },
    { subject: 'Не работает сканер документов', description: 'Canon DR-C225 II в канцелярии — при сканировании выдаёт ошибку "Устройство не готово". Драйвер переустановлен, не помогло.', category: TicketCategory.HARDWARE, priority: Priority.LOW, status: TicketStatus.WAITING, creatorIdx: 2, assigneeIdx: 0, hoursAgo: 20 },
    { subject: 'Нужно установить Microsoft Office', description: 'На 12 компьютерах в ауд. 215 нужна установка Office 365. Лицензии выделены, ключи у завкафедры Ермекова А.Т.', category: TicketCategory.SOFTWARE, priority: Priority.MEDIUM, status: TicketStatus.WAITING, creatorIdx: 3, assigneeIdx: 1, hoursAgo: 12 },
    { subject: 'Забыл пароль от корпоративной почты', description: 'Не могу войти в Outlook — после отпуска забыл пароль. Веб-версия тоже не пускает. Логин: a.nurzhanov@aitu.kz', category: TicketCategory.SOFTWARE, priority: Priority.HIGH, status: TicketStatus.CLOSED, creatorIdx: 4, assigneeIdx: 1, hoursAgo: 72 },
    { subject: 'Рекламный вирус в браузере Chrome', description: 'Открываются вкладки с рекламой казино и push-уведомления. Kaspersky обнаружил 3 трояна, но удалить не смог. Нужна полная проверка.', category: TicketCategory.SOFTWARE, priority: Priority.HIGH, status: TicketStatus.REOPENED, creatorIdx: 0, assigneeIdx: 1, hoursAgo: 36 },
    { subject: 'Интернет в библиотеке тормозит после обеда', description: 'Скорость падает до 0.5 Мбит/с с 14:00 по будням, хотя канал 100 Мбит/с. 30+ студентов не могут работать.', category: TicketCategory.NETWORK, priority: Priority.MEDIUM, status: TicketStatus.NEW, creatorIdx: 1, hoursAgo: 2 },
    { subject: 'Настроить VPN для преподавателя', description: 'Маратов К.Б. (кафедра информатики) — нужен VPN-доступ к файловому серверу и 1С для удалённой работы из дома.', category: TicketCategory.NETWORK, priority: Priority.LOW, status: TicketStatus.IN_PROGRESS, creatorIdx: 2, assigneeIdx: 2, hoursAgo: 8 },
    { subject: 'Пропал звук в лингафонном кабинете', description: 'На ПК №2-5 в ауд. 408 нет звука. Realtek Audio в диспетчере устройств с жёлтым треугольником. Драйверы обновлены.', category: TicketCategory.HARDWARE, priority: Priority.LOW, status: TicketStatus.CLOSED, creatorIdx: 3, assigneeIdx: 0, hoursAgo: 120 },
    { subject: 'ПК зависает при открытии Photoshop', description: '4 GB RAM — при запуске Photoshop CC 2024 загрузка ЦП 100%, система зависает. Просим установить планку DDR4 8 GB.', category: TicketCategory.HARDWARE, priority: Priority.MEDIUM, status: TicketStatus.NEW, creatorIdx: 4, hoursAgo: 4 },
    { subject: 'Электронный журнал Kundelik не загружается', description: 'SOAP-ошибка "Сервер недоступен". У 5 преподавателей с 9 утра. Оценки за четверть нужно сдать сегодня до 18:00.', category: TicketCategory.SOFTWARE, priority: Priority.CRITICAL, status: TicketStatus.IN_PROGRESS, creatorIdx: 0, assigneeIdx: 1, hoursAgo: 2 },
    { subject: 'Настроить почту на iPhone преподавателя', description: 'Ермекова А.Т. купила iPhone 15, нужно настроить Exchange ActiveSync. Параметры IMAP/SMTP не подходят.', category: TicketCategory.SOFTWARE, priority: Priority.LOW, status: TicketStatus.CLOSED, creatorIdx: 1, assigneeIdx: 1, hoursAgo: 200 },
    { subject: 'Заменить мониторы в ауд. 202', description: 'Samsung 19" TN 2009 года — плохая цветопередача для курсов графического дизайна. Нужны IPS 24" для Adobe Illustrator.', category: TicketCategory.HARDWARE, priority: Priority.LOW, status: TicketStatus.NEW, creatorIdx: 2, hoursAgo: 2 },
    { subject: 'Office 365 не запускается после Windows Update', description: 'После обновления KB5034441 перестали работать Word и Excel. Ошибка 0x8004FC12. Откат обновления невозможен.', category: TicketCategory.SOFTWARE, priority: Priority.HIGH, status: TicketStatus.IN_PROGRESS, creatorIdx: 3, assigneeIdx: 1, hoursAgo: 6 },
    { subject: 'Закупка лицензий MATLAB R2025a на 30 мест', description: 'Кафедра "Компьютерные технологии" запрашивает Academic License. Бюджет согласован с проректором, нужна закупка.', category: TicketCategory.SOFTWARE, priority: Priority.MEDIUM, status: TicketStatus.WAITING, creatorIdx: 4, assigneeIdx: 1, hoursAgo: 48 },
  ];

  const existingTickets = await prisma.ticket.count();
  if (existingTickets === 0) {
    for (let idx = 0; idx < ticketSpecs.length; idx++) {
      const spec = ticketSpecs[idx];
      if (!spec) continue;
      const createdAt = new Date(now.getTime() - spec.hoursAgo * 60 * 60 * 1000);
      const sla = spec.priority === Priority.CRITICAL ? { r: 2, res: 4 }
        : spec.priority === Priority.HIGH ? { r: 4, res: 8 }
        : spec.priority === Priority.MEDIUM ? { r: 8, res: 24 }
        : { r: 24, res: 72 };

      const assignee = spec.assigneeIdx !== undefined ? agents[spec.assigneeIdx] : undefined;

      const ticket = await prisma.ticket.create({
        data: {
          subject: spec.subject,
          description: spec.description,
          category: spec.category,
          priority: spec.priority,
          status: spec.status,
          creatorId: users[spec.creatorIdx]?.id ?? users[0]!.id,
          assigneeId: assignee?.id,
          slaDeadlineResponse: new Date(createdAt.getTime() + sla.r * 60 * 60 * 1000),
          slaDeadlineResolve: new Date(createdAt.getTime() + sla.res * 60 * 60 * 1000),
          slaBreached: ([TicketStatus.RESOLVED, TicketStatus.CLOSED] as TicketStatus[]).includes(spec.status) ? false : new Date() > new Date(createdAt.getTime() + sla.res * 60 * 60 * 1000),
          firstResponseAt: assignee ? new Date(createdAt.getTime() + 30 * 60 * 1000) : undefined,
          resolvedAt: ([TicketStatus.RESOLVED, TicketStatus.CLOSED] as TicketStatus[]).includes(spec.status) ? new Date(createdAt.getTime() + sla.res * 0.8 * 60 * 60 * 1000) : undefined,
          createdAt,
          updatedAt: createdAt,
        },
      });

      // Add a sample message to each ticket
      if (assignee) {
        await prisma.ticketMessage.create({
          data: {
            ticketId: ticket.id,
            authorId: assignee.id,
            content: 'Добрый день! Принял вашу заявку в работу. Разберусь в течение ближайшего времени.',
            type: MessageType.PUBLIC,
            createdAt: new Date(createdAt.getTime() + 30 * 60 * 1000),
            updatedAt: new Date(createdAt.getTime() + 30 * 60 * 1000),
          },
        });
      }

      // Add ratings for CLOSED tickets
      if (spec.status === TicketStatus.CLOSED) {
        await prisma.rating.create({
          data: {
            ticketId: ticket.id,
            userId: users[spec.creatorIdx]?.id ?? users[0]!.id,
            score: [4, 5, 5, 3, 5][idx % 5] ?? 5,
            comment: idx % 2 === 0 ? 'Быстро решили проблему, спасибо!' : 'Всё хорошо, но немного долго.',
          },
        });
      }
    }
    console.log('✅ 20 tickets created with messages and ratings');
  } else {
    console.log(`↪️  Skipped demo tickets because ${existingTickets} tickets already exist`);
  }
  console.log('🌱 Seed completed successfully!');
  console.log('');
  console.log('📋 Test accounts:');
  console.log('   Admin: admin@aitudesk.kz / configured seed password');
  console.log('   Agents: agent1-3@aitudesk.kz / configured seed password');
  console.log('   Users: user1-5@aitudesk.kz / configured seed password');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
