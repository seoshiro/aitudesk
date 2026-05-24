import { Router, Response } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const aiRouter = Router();
aiRouter.use(authenticate);

// ── AI provider (OpenAI-compatible) ────────────────────────────────────────
// Поддерживаются любые OpenAI-совместимые провайдеры: Google Gemini, Groq,
// OpenRouter, Cerebras, NVIDIA Integrate, OpenAI и т.д. — нужно только
// прописать соответствующие AI_BASE_URL / AI_MODEL в .env.
//
// Старые имена NVIDIA_* читаются как fallback для обратной совместимости.
const AI_BASE_URL =
  process.env['AI_BASE_URL'] ??
  process.env['NVIDIA_BASE_URL'] ??
  'https://api.groq.com/openai/v1';
const AI_API_KEY = process.env['AI_API_KEY'] ?? process.env['NVIDIA_API_KEY'] ?? '';
const AI_MODEL =
  process.env['AI_MODEL'] ?? process.env['NVIDIA_MODEL'] ?? 'llama-3.3-70b-versatile';

const openai = new OpenAI({
  apiKey: AI_API_KEY,
  baseURL: AI_BASE_URL,
});

// ── Schemas ───────────────────────────────────────────────────────────────
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(ChatMessageSchema).max(20).optional(),
  lang: z.enum(['ru', 'en', 'kk']).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  'как', 'что', 'это', 'для', 'или', 'при', 'где', 'когда', 'почему',
  'кто', 'чем', 'мне', 'меня', 'моя', 'мой', 'моё', 'мои', 'есть',
  'нет', 'был', 'была', 'было', 'быть', 'буду', 'будет', 'свой',
  'своя', 'своё', 'свои', 'если', 'делать', 'начал', 'начала',
  'the', 'and', 'for', 'how', 'what', 'why', 'who', 'when', 'where',
  'are', 'was', 'were', 'this', 'that', 'with', 'from',
]);

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  ).slice(0, 8);
}

interface KbHit {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  score: number;
}

type KbLocale = 'ru' | 'en' | 'kk';
type MessageRoute = 'greeting' | 'support_question' | 'off_topic' | 'unclear';
type AiAnswerReason =
  | 'answered'
  | 'greeting'
  | 'off_topic'
  | 'unclear'
  | 'no_context'
  | 'generation_error';

const SERVICE_TERMS = [
  'aitudesk', 'service desk', 'help desk', 'поддерж', 'техподдерж', 'сервис', 'заяв', 'тикет',
  'обращен', 'аккаунт', 'учет', 'учёт', 'логин', 'парол', 'доступ', 'авторизац', 'войти',
  'зайти', 'ошиб', 'не работает',
  'не открывается', 'не запускается', 'слом', 'настро', 'установ', 'принтер', 'wi-fi', 'wifi',
  'вайфай', 'vpn', 'сеть', 'интернет', 'office', 'outlook', 'почт', '1с', 'kundelik',
  'компьютер', 'ноутбук', 'проектор', 'сканер', 'файл', 'вложен', 'база знаний', 'статья',
  'мыш', 'мышк', 'клавиат', 'монитор', 'экран', 'usb', 'bluetooth', 'блютуз', 'драйвер',
  'windows', 'браузер', 'chrome', 'edge', 'кэш', 'куки', 'звук', 'микрофон', 'камера',
  'наушник', 'заряд', 'батар', 'диск', 'память', 'word', 'excel', 'powerpoint', 'teams',
  'ticket', 'request', 'issue', 'support', 'account', 'password', 'login', 'access', 'error',
  'printer', 'network', 'email', 'mail', 'computer', 'laptop', 'projector', 'attachment',
  'mouse', 'keyboard', 'monitor', 'screen', 'driver', 'browser', 'cache', 'cookies',
  'double click', 'microphone', 'camera', 'headphones', 'battery',
  'өтінім', 'сұрау', 'қолдау', 'аккаунт', 'құпия', 'кіру', 'қолжет', 'қате', 'істемейді',
  'ашылмайды', 'бапта', 'орнат', 'желі', 'пошта', 'компьютер', 'білім базасы', 'мақала',
  'тышқан', 'пернетақта', 'экран', 'драйвер', 'браузер', 'дыбыс', 'микрофон', 'камера',
];

const EMPTY_REPLY_RE = /^[-—–_.\s]+$/u;

const GREETING_PATTERNS = [
  /^(привет|здравствуй(те)?|добрый\s+(день|вечер|утро)|хай|салам|hello|hi|hey|good\s+(morning|afternoon|evening)|сәлем|салем)$/iu,
  /^(спасибо|благодарю|ок|окей|понял(а)?|ясно|thanks|thank\s+you|thx|рахмет)$/iu,
  /^(ты\s+тут\??|вы\s+тут\??|поможешь\??|можешь\s+помочь\??|help\??|can\s+you\s+help\??)$/iu,
];

const THANKS_RE = /^(спасибо|благодарю|thanks|thank\s+you|thx|рахмет)$/iu;
const HELP_RE = /^(поможешь\??|можешь\s+помочь\??|help\??|can\s+you\s+help\??)$/iu;

const UNCLEAR_PATTERNS = [
  /^(не\s+работает|ошибка|не\s+могу|помоги\s+с\s+проблемой|ничего\s+не\s+получается|сломалось|проблема|не\s+получается)$/iu,
  /^(error|problem|does\s+not\s+work|not\s+working|cannot|can't|help\s+with\s+a\s+problem)$/iu,
  /^(қате|істемейді|ашылмайды|мәселе|көмектесіңіз|ештеңе\s+шықпайды)$/iu,
];

const OFF_TOPIC_PATTERNS = [
  /(кто\s+такой|кто\s+такая|кто\s+такие|расскажи\s+про|расскажи\s+об|кто\s+президент|напиши\s+код|реши\s+задачу|анекдот|фотосинтез|вторая\s+мировая|история\s+войны)/iu,
  /(who\s+is|tell\s+me\s+about|president\s+of|write\s+(a\s+)?code|python\s+code|solve\s+(a\s+)?math|joke|photosynthesis|world\s+war)/iu,
  /(кім\s+ол|туралы\s+айтып\s+бер|президенті\s+кім|код\s+жаз|есеп\s+шығар|әзіл|фотосинтез)/iu,
];

const fallbackMessages: Record<AiAnswerReason, Record<KbLocale, string>> = {
  answered: {
    ru: '',
    en: '',
    kk: '',
  },
  greeting: {
    ru: 'Здравствуйте! Я технический ассистент AituDesk. Могу помочь с заявками, доступом, аккаунтом, ошибками и работой сервиса. Что хотите узнать?',
    en: 'Hello! I am the AituDesk technical support assistant. I can help with tickets, access, accounts, errors, and using the service. What would you like to know?',
    kk: 'Сәлеметсіз бе! Мен AituDesk техникалық қолдау ассистентімін. Өтінімдер, қолжетімділік, аккаунт, қателер және сервис жұмысы бойынша көмектесе аламын. Не білгіңіз келеді?',
  },
  off_topic: {
    ru: 'Извините, я не могу ответить на этот вопрос, потому что я AI-ассистент технической поддержки AituDesk и помогаю только с вопросами, связанными с работой сервиса, заявками, аккаунтом, доступом, ошибками и базой знаний.',
    en: 'Sorry, I cannot answer that question because I am the AituDesk technical support AI assistant. I only help with service desk topics such as tickets, accounts, access, errors, and the knowledge base.',
    kk: 'Кешіріңіз, бұл сұраққа жауап бере алмаймын, себебі мен AituDesk техникалық қолдау AI ассистентімін. Мен тек сервис жұмысы, өтінімдер, аккаунт, қолжетімділік, қателер және білім базасы бойынша көмектесемін.',
  },
  unclear: {
    ru: 'Уточните, пожалуйста, что именно не работает: вход в аккаунт, создание заявки, доступ к странице, уведомления или другая функция AituDesk?',
    en: 'Please clarify what exactly is not working: account login, ticket creation, page access, notifications, or another AituDesk feature?',
    kk: 'Нақты не істемей тұрғанын нақтылаңыз: аккаунтқа кіру, өтінім жасау, бетке қолжетімділік, хабарландырулар немесе AituDesk-тің басқа функциясы ма?',
  },
  no_context: {
    ru: 'Я не нашёл точной информации по этому вопросу в базе знаний. Пожалуйста, уточните запрос или обратитесь к оператору поддержки.',
    en: 'I could not find exact information about this question in the knowledge base. Please clarify your request or contact a support operator.',
    kk: 'Бұл сұрақ бойынша білім базасынан нақты ақпарат таба алмадым. Сұрағыңызды нақтылаңыз немесе қолдау операторына хабарласыңыз.',
  },
  generation_error: {
    ru: 'Сейчас не удалось получить ответ от AI-сервиса. Проверьте настройки API-ключа или попробуйте позже.',
    en: 'The AI service could not generate a response right now. Please check the API key settings or try again later.',
    kk: 'Қазір AI сервисінен жауап алу мүмкін болмады. API кілті баптауларын тексеріңіз немесе кейінірек қайталап көріңіз.',
  },
};

function parseLocale(value: unknown): KbLocale {
  const candidate = typeof value === 'string' ? value.split('-')[0] : 'ru';
  return candidate === 'en' || candidate === 'kk' || candidate === 'ru' ? candidate : 'ru';
}

function getFallback(reason: Exclude<AiAnswerReason, 'answered'>, locale: KbLocale): string {
  return fallbackMessages[reason][locale] ?? fallbackMessages[reason].ru;
}

function isEmptyReply(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (EMPTY_REPLY_RE.test(trimmed)) return true;
  return ['null', 'undefined', 'nan'].includes(trimmed.toLowerCase());
}

function isServiceRelatedQuestion(message: string): boolean {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return SERVICE_TERMS.some((term) => normalized.includes(term));
}

function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[!?.,;:()[\]{}"'«»]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyMessage(message: string): MessageRoute {
  const normalized = normalizeMessage(message);
  if (!normalized) return 'unclear';

  const isShort = normalized.split(' ').length <= 5 && normalized.length <= 48;
  if (isShort && GREETING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'greeting';
  }

  if (UNCLEAR_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'unclear';
  }

  if (isServiceRelatedQuestion(normalized)) {
    return 'support_question';
  }

  if (OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'off_topic';
  }

  return normalized.endsWith('?') ? 'off_topic' : 'unclear';
}

function buildGreetingReply(message: string, locale: KbLocale): string {
  const normalized = normalizeMessage(message);
  if (THANKS_RE.test(normalized)) {
    if (locale === 'en') return 'You are welcome! If you have questions about AituDesk, I will help.';
    if (locale === 'kk') return 'Оқасы жоқ! AituDesk бойынша сұрақтарыңыз болса, көмектесемін.';
    return 'Пожалуйста! Если появятся вопросы по AituDesk, я помогу.';
  }
  if (HELP_RE.test(normalized)) {
    if (locale === 'en') return 'Yes, of course. Describe the issue or ask a question about AituDesk.';
    if (locale === 'kk') return 'Иә, әрине. Мәселені сипаттаңыз немесе AituDesk бойынша сұрақ қойыңыз.';
    return 'Да, конечно. Опишите проблему или задайте вопрос по AituDesk.';
  }
  return getFallback('greeting', locale);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[.*?\]\(.+?\)/g, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildContextFallback(context: KbHit[], locale: KbLocale): string {
  const primary = context[0];
  if (!primary) return getFallback('no_context', locale);
  const summary = stripMarkdown(primary.content).slice(0, 700);
  const sourceLine = locale === 'en'
    ? `Source: ${primary.title}.`
    : locale === 'kk'
      ? `Дереккөз: ${primary.title}.`
      : `Источник: ${primary.title}.`;

  if (summary) {
    return `${summary}\n\n${sourceLine}`;
  }
  return sourceLine;
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function buildGeneralItFallback(message: string, locale: KbLocale): string {
  const normalized = normalizeMessage(message);

  if (includesAny(normalized, ['клавиат', 'keyboard', 'пернетақта'])) {
    if (locale === 'en') {
      return 'If the keyboard is not working, first reconnect it or try another USB port. For a wireless keyboard, check the batteries and reconnect the receiver or Bluetooth pairing. Restart the computer, test the keyboard in another app or on another computer, and check whether Num Lock or language/layout settings are causing the issue. If it still does not work, create a support ticket and include the keyboard model, connection type, and what exactly does not respond.';
    }
    if (locale === 'kk') {
      return 'Пернетақта жұмыс істемесе, алдымен оны қайта қосыңыз немесе басқа USB портына салып көріңіз. Сымсыз болса, батареясын, қабылдағышын немесе Bluetooth байланысын тексеріңіз. Компьютерді қайта іске қосыңыз, пернетақтаны басқа бағдарламада немесе басқа компьютерде тексеріңіз, Num Lock және тіл/ layout баптауларын қараңыз. Әлі жұмыс істемесе, модельін, қосылу түрін және нақты қандай батырмалар істемейтінін көрсетіп өтінім жасаңыз.';
    }
    return 'Если клавиатура не работает, сначала отключите и подключите её заново или попробуйте другой USB-порт. Если клавиатура беспроводная, проверьте батарейки, USB-приёмник или Bluetooth-подключение. Перезагрузите компьютер, проверьте клавиатуру в другой программе или на другом компьютере, а также посмотрите Num Lock и раскладку языка. Если проблема остаётся, создайте заявку и укажите модель клавиатуры, тип подключения и что именно не реагирует.';
  }

  if (includesAny(normalized, ['мыш', 'мышк', 'mouse', 'double click', 'дабл клик', 'двойн'])) {
    if (locale === 'en') {
      return 'If your mouse double-clicks by itself, first try another USB port or another mouse to separate a device issue from a computer issue. Check the double-click speed in mouse settings, clean the button area, replace the battery if it is wireless, and update or reinstall the mouse driver. If it still double-clicks on another computer, the mouse button is likely worn out and should be replaced or sent to IT support.';
    }
    if (locale === 'kk') {
      return 'Тышқан өзі екі рет басылып тұрса, алдымен басқа USB портына немесе басқа компьютерге қосып тексеріңіз. Тышқан баптауларындағы double-click жылдамдығын қараңыз, батырма айналасын тазалаңыз, сымсыз болса батареясын ауыстырыңыз және драйверді жаңартыңыз. Басқа компьютерде де қайталанса, батырма тозған болуы мүмкін, IT қолдауға көрсеткен дұрыс.';
    }
    return 'Если мышка начала делать двойной клик сама по себе, сначала проверьте её в другом USB-порту или на другом компьютере. Затем откройте настройки мыши и уменьшите/проверьте скорость двойного щелчка, очистите область кнопки, замените батарейку у беспроводной мыши и обновите или переустановите драйвер. Если на другом компьютере проблема повторяется, скорее всего износилась кнопка мыши — лучше заменить мышь или передать её в IT-поддержку.';
  }

  if (includesAny(normalized, ['аккаунт', 'логин', 'парол', 'доступ', 'авторизац', 'войти', 'зайти', 'account', 'login', 'password', 'access'])) {
    if (locale === 'en') {
      return 'If you cannot sign in to your account, check that the email/login is typed correctly, make sure Caps Lock is off, try resetting the password, and clear the browser cache or try another browser. If access is still blocked, create a ticket and include your account email, the service you are trying to open, and a screenshot of the error.';
    }
    if (locale === 'kk') {
      return 'Аккаунтқа кіре алмасаңыз, логин/email дұрыс жазылғанын, Caps Lock өшірулі екенін тексеріңіз, құпиясөзді қалпына келтіріп көріңіз, браузер кэшін тазалаңыз немесе басқа браузер қолданыңыз. Мәселе шешілмесе, өтінім жасап, аккаунт email-ін, қай сервиске кіре алмай тұрғаныңызды және қате скриншотын қосыңыз.';
    }
    return 'Если вы не можете зайти в аккаунт, проверьте правильность логина или email, убедитесь, что Caps Lock выключен, попробуйте сбросить пароль, очистить кэш браузера или открыть сервис в другом браузере. Если доступ всё равно не работает, создайте заявку и укажите email аккаунта, какой сервис не открывается и приложите скриншот ошибки.';
  }

  if (includesAny(normalized, ['страниц', 'сайт', 'браузер', 'chrome', 'edge', 'кэш', 'куки', 'browser', 'page', 'site', 'cache'])) {
    if (locale === 'en') {
      return 'If a page does not open, refresh it, check the internet connection, try another browser or incognito mode, clear cache and cookies, and copy the exact error text. If the issue remains, send a ticket with the page address, screenshot, browser name, and time of the error.';
    }
    if (locale === 'kk') {
      return 'Бет ашылмаса, оны қайта жүктеңіз, интернет байланысын тексеріңіз, басқа браузер немесе incognito режимін қолданып көріңіз, кэш пен cookies тазалаңыз. Мәселе қалса, бет мекенжайын, скриншотты, браузер атауын және қате уақытын көрсетіп өтінім жіберіңіз.';
    }
    return 'Если страница не открывается, обновите её, проверьте интернет, попробуйте другой браузер или режим инкогнито, очистите кэш и cookies. Если проблема остаётся, создайте заявку и укажите адрес страницы, текст ошибки, браузер и приложите скриншот.';
  }

  if (locale === 'en') {
    return 'This looks like an IT support issue. Please describe the device or service, what exactly happens, when it started, what you already tried, and attach a screenshot or photo if possible. I can suggest next steps or help you prepare a support ticket.';
  }
  if (locale === 'kk') {
    return 'Бұл IT қолдау мәселесіне ұқсайды. Қай құрылғы немесе сервис екенін, нақты не болып жатқанын, қашан басталғанын, не тексеріп көргеніңізді жазыңыз және мүмкін болса скриншот немесе фото қосыңыз. Мен келесі қадамдарды ұсына аламын немесе өтінім дайындауға көмектесемін.';
  }
  return 'Похоже, это вопрос для IT-поддержки. Опишите, пожалуйста, устройство или сервис, что именно происходит, когда началось, что уже пробовали, и приложите скриншот или фото, если есть. Я подскажу следующие шаги или помогу оформить заявку.';
}

function shouldPreferGeneralItFallback(message: string, context: KbHit[]): boolean {
  const normalized = normalizeMessage(message);
  const primary = context[0];
  const primaryText = primary ? normalizeMessage(`${primary.title} ${primary.content}`) : '';

  if (includesAny(normalized, ['клавиат', 'keyboard', 'пернетақта'])) return true;
  if (includesAny(normalized, ['мыш', 'мышк', 'mouse', 'дабл клик', 'двойн'])) return true;

  const accountQuestion = includesAny(normalized, ['аккаунт', 'логин', 'парол', 'доступ', 'авторизац', 'войти', 'зайти']);
  if (accountQuestion && primaryText.includes('office') && !primaryText.includes('сброс')) {
    return true;
  }

  return false;
}

function buildSupportFallback(message: string, context: KbHit[], locale: KbLocale): string {
  if (context.length === 0 || shouldPreferGeneralItFallback(message, context)) {
    return buildGeneralItFallback(message, locale);
  }
  return buildContextFallback(context, locale);
}

function selectArticleText(article: {
  title: string;
  content: string;
  translations?: Array<{ locale: string; title: string; content: string }>;
}, locale: KbLocale): { title: string; content: string } {
  const translation =
    article.translations?.find((item) => item.locale === locale) ??
    article.translations?.find((item) => item.locale === 'ru') ??
    article.translations?.[0];
  return translation ? { title: translation.title, content: translation.content } : { title: article.title, content: article.content };
}

async function retrieveContext(query: string, locale: KbLocale, limit = 3): Promise<KbHit[]> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const orConditions = keywords.flatMap((kw) => [
    { title: { contains: kw, mode: 'insensitive' as const } },
    { content: { contains: kw, mode: 'insensitive' as const } },
    { tags: { has: kw } },
    {
      translations: {
        some: {
          locale,
          OR: [
            { title: { contains: kw, mode: 'insensitive' as const } },
            { content: { contains: kw, mode: 'insensitive' as const } },
          ],
        },
      },
    },
    ...(locale === 'ru'
      ? []
      : [{
          translations: {
            some: {
              locale: 'ru' as const,
              OR: [
                { title: { contains: kw, mode: 'insensitive' as const } },
                { content: { contains: kw, mode: 'insensitive' as const } },
              ],
            },
          },
        }]),
  ]);

  const articles = await prisma.knowledgeArticle.findMany({
    where: { published: true, OR: orConditions },
    include: { translations: true },
    orderBy: { viewCount: 'desc' },
    take: limit * 3,
  });

  // Re-rank by simple keyword frequency score
  const scored = articles.map((a) => {
    const selected = selectArticleText(a, locale);
    const haystack = `${selected.title}\n${selected.content}\n${a.tags.join(' ')}`.toLowerCase();
    const score = keywords.reduce(
      (s, kw) => s + (haystack.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))?.length ?? 0),
      0,
    );
    return { article: a, score };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => {
      const selected = selectArticleText(x.article, locale);
      return {
        id: x.article.id,
        title: selected.title,
        content: selected.content,
        category: x.article.category,
        tags: x.article.tags,
        score: x.score,
      };
    });
}

function buildSystemPrompt(context: KbHit[], locale: KbLocale): string {
  const languageName = locale === 'en' ? 'English' : locale === 'kk' ? 'Kazakh' : 'Russian';
  const base =
    `You are the AituDesk technical support AI assistant. Reply in ${languageName}. ` +
    'You can greet the user, answer short polite messages, and ask clarifying questions when the problem is vague. ' +
    'Your factual/help scope is limited to IT support: AituDesk, service desk workflows, tickets, accounts, access, passwords, errors, college IT services, computers, peripherals, printers, network, Wi-Fi, browsers, Office, and the knowledge base. ' +
    'Refuse only real off-topic general-knowledge requests, coding/math tasks, jokes, history, politics, science, or other topics unrelated to AituDesk support. ' +
    'If the question is in IT-support scope and knowledge-base context is provided, use it when it is directly relevant. If the context is weak or about a different product, do not force it; give practical IT troubleshooting advice instead. ' +
    'If the question is in IT-support scope but the context does not contain the exact answer, give safe general troubleshooting steps and suggest creating a ticket with details if needed. ' +
    'Do not invent facts. Never return an empty response, "_", "__", "-", or "—". Keep the answer concise and practical.';

  if (context.length === 0) {
    return base;
  }

  const blocks = context
    .map(
      (a, i) =>
        `### Источник ${i + 1}: ${a.title} (категория: ${a.category})\n${a.content.slice(0, 1500)}`,
    )
    .join('\n\n---\n\n');

  return `${base}\n\n[КОНТЕКСТ ИЗ БАЗЫ ЗНАНИЙ]\n${blocks}`;
}

// ── Routes ────────────────────────────────────────────────────────────────

// POST /api/ai/chat
aiRouter.post('/chat', validate(ChatRequestSchema), async (req: AuthRequest, res: Response) => {
  if (!AI_API_KEY) {
    res.status(503).json({ error: 'AI assistant is not configured (AI_API_KEY missing)' });
    return;
  }

  const { message, history = [], lang } = ChatRequestSchema.parse(req.body);
  const locale = parseLocale(lang ?? req.headers['accept-language']);

  try {
    const route = classifyMessage(message);

    if (route === 'greeting') {
      res.json({
        reply: buildGreetingReply(message, locale),
        reason: 'greeting',
        sources: [],
      });
      return;
    }

    if (route === 'unclear') {
      res.json({
        reply: getFallback('unclear', locale),
        reason: 'unclear',
        sources: [],
      });
      return;
    }

    if (route === 'off_topic') {
      res.json({
        reply: getFallback('off_topic', locale),
        reason: 'off_topic',
        sources: [],
      });
      return;
    }

    const retrievedContext = await retrieveContext(message, locale);
    const context = shouldPreferGeneralItFallback(message, retrievedContext) ? [] : retrievedContext;
    const sources = context.map((c) => ({ id: c.id, title: c.title, category: c.category }));

    const systemPrompt = buildSystemPrompt(context, locale);

    const params = {
      model: AI_MODEL,
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 700,
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: message },
      ],
    };

    // Retry with exponential backoff for 429 / 5xx
    const MAX_RETRIES = 3;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const completion = await openai.chat.completions.create(params);
        const rawReply = completion.choices[0]?.message?.content;
        const reply = isEmptyReply(rawReply)
          ? buildSupportFallback(message, context, locale)
          : rawReply.trim();
        res.json({
          reply,
          reason: isEmptyReply(rawReply) ? 'generation_error' : 'answered',
          sources,
        });
        return;
      } catch (e: unknown) {
        lastErr = e;
        const status = (e as { status?: number }).status;
        const retryable = status === 429 || (status !== undefined && status >= 500);
        if (!retryable || attempt === MAX_RETRIES) break;
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        console.warn(`[AI] attempt ${attempt + 1} failed (${status}), retrying in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastErr;
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'AI request failed';
    const status = (err as { status?: number }).status;
    console.error('[AI] chat error:', detail);
    res.status(status === 429 ? 429 : 502).json({
      error: getFallback('generation_error', locale),
      reason: 'generation_error',
    });
  }
});
