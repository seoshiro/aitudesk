import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function MockOpenAI() {
    return {
    chat: {
      completions: {
        create: createMock,
      },
    },
  };
  }),
}));

process.env['AI_API_KEY'] = 'test-ai-key';

import { app } from '../src/index';
import { prismaMock } from './setup';
import { TEST_USER, userToken, authHeader } from './helpers';

const KB_CREATE_TICKET = {
  id: 'kb-create-ticket',
  title: 'Как создать заявку в Service Desk',
  content:
    '## Как создать заявку\n\nОткройте раздел заявок, нажмите кнопку создания новой заявки, заполните тему, описание, категорию и отправьте форму.',
  category: 'OTHER',
  tags: ['заявка', 'тикет', 'service desk'],
  authorId: 'admin-id-001',
  published: true,
  viewCount: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
  translations: [
    {
      id: 'tr-ru',
      articleId: 'kb-create-ticket',
      locale: 'ru',
      title: 'Как создать заявку в Service Desk',
      content:
        '## Как создать заявку\n\nОткройте раздел заявок, нажмите кнопку создания новой заявки, заполните тему, описание, категорию и отправьте форму.',
      slug: 'kak-sozdat-zayavku',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

const KB_OFFICE = {
  id: 'kb-office',
  title: 'Установка Microsoft Office 365',
  content:
    '## Установка Office 365\n\nОткройте portal.office.com, войдите с корпоративным аккаунтом и нажмите «Установить Office».',
  category: 'SOFTWARE',
  tags: ['office', 'аккаунт'],
  authorId: 'admin-id-001',
  published: true,
  viewCount: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
  translations: [
    {
      id: 'tr-office-ru',
      articleId: 'kb-office',
      locale: 'ru',
      title: 'Установка Microsoft Office 365',
      content:
        '## Установка Office 365\n\nОткройте portal.office.com, войдите с корпоративным аккаунтом и нажмите «Установить Office».',
      slug: 'office-365',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

describe('POST /api/ai/chat', () => {
  beforeEach(() => {
    createMock.mockReset();
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
  });

  it('answers greetings without treating them as off-topic', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader(userToken))
      .send({ message: 'привет', lang: 'ru', history: [] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('технический ассистент AituDesk');
    expect(res.body.reply).not.toContain('не могу ответить');
    expect(res.body.reply).not.toBe('—');
    expect(res.body.reason).toBe('greeting');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('answers short help requests as service small talk', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader(userToken))
      .send({ message: 'поможешь?', lang: 'ru', history: [] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('Да, конечно');
    expect(res.body.reply).not.toContain('не могу ответить');
    expect(res.body.reason).toBe('greeting');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('uses KB context when provider returns an empty reply', async () => {
    prismaMock.knowledgeArticle.findMany.mockResolvedValue([KB_CREATE_TICKET]);
    createMock.mockResolvedValue({ choices: [{ message: { content: '—' } }] });

    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader(userToken))
      .send({ message: 'Как создать заявку?', lang: 'ru', history: [] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('Откройте раздел заявок');
    expect(res.body.reply).not.toBe('—');
    expect(res.body.sources).toHaveLength(1);
    expect(res.body.reason).toBe('generation_error');
  });

  it('answers IT peripheral questions even without KB context', async () => {
    prismaMock.knowledgeArticle.findMany.mockResolvedValue([]);
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'Проверьте мышь в другом USB-порту и настройку скорости двойного щелчка.' } }],
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader(userToken))
      .send({ message: 'что делать если у меня мышка начала дабл кликать', lang: 'ru', history: [] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('мыш');
    expect(res.body.reply).not.toContain('не могу ответить');
    expect(res.body.reason).toBe('answered');
    expect(createMock).toHaveBeenCalledOnce();
  });

  it('uses a general IT fallback for empty model replies on mouse problems', async () => {
    prismaMock.knowledgeArticle.findMany.mockResolvedValue([]);
    createMock.mockResolvedValue({ choices: [{ message: { content: '—' } }] });

    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader(userToken))
      .send({ message: 'проблемы с мышкой', lang: 'ru', history: [] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('мыш');
    expect(res.body.reply).toContain('двойной клик');
    expect(res.body.reply).not.toBe('—');
    expect(res.body.sources).toHaveLength(0);
    expect(res.body.reason).toBe('generation_error');
  });

  it('does not answer keyboard issues with an unrelated browser article', async () => {
    prismaMock.knowledgeArticle.findMany.mockResolvedValue([{
      ...KB_OFFICE,
      id: 'kb-kundelik',
      title: 'Электронный журнал Kundelik не загружается',
      content: 'Журнал не открывается: очистите кэш браузера, попробуйте режим инкогнито, откройте в Chrome или Edge.',
      tags: ['kundelik', 'браузер', 'не работает'],
      translations: [{
        ...KB_OFFICE.translations[0],
        id: 'tr-kundelik-ru',
        articleId: 'kb-kundelik',
        title: 'Электронный журнал Kundelik не загружается',
        content: 'Журнал не открывается: очистите кэш браузера, попробуйте режим инкогнито, откройте в Chrome или Edge.',
      }],
    }]);
    createMock.mockResolvedValue({ choices: [{ message: { content: '—' } }] });

    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader(userToken))
      .send({ message: 'что делать если клавиатура не работает', lang: 'ru', history: [] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('клавиатура');
    expect(res.body.reply).not.toContain('Kundelik');
    expect(res.body.reply).not.toContain('кэш браузера');
    expect(res.body.sources).toHaveLength(0);
    expect(res.body.reason).toBe('generation_error');
  });

  it('does not use an irrelevant Office article as fallback for account login issues', async () => {
    prismaMock.knowledgeArticle.findMany.mockResolvedValue([KB_OFFICE]);
    createMock.mockResolvedValue({ choices: [{ message: { content: '—' } }] });

    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader(userToken))
      .send({ message: 'я не могу зайти на свой аккаунт', lang: 'ru', history: [] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('зайти в аккаунт');
    expect(res.body.reply).not.toContain('Установка Office 365');
    expect(res.body.reply).not.toContain('portal.office.com');
    expect(res.body.sources).toHaveLength(0);
    expect(res.body.reason).toBe('generation_error');
  });

  it('refuses off-topic questions without calling the provider', async () => {
    prismaMock.knowledgeArticle.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader(userToken))
      .send({ message: 'кто такой гитлер', lang: 'ru', history: [] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('AI-ассистент технической поддержки AituDesk');
    expect(res.body.reply).not.toContain('истор');
    expect(res.body.reply).not.toBe('—');
    expect(res.body.reason).toBe('off_topic');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('asks for clarification on vague support problems', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader(userToken))
      .send({ message: 'ошибка', lang: 'ru', history: [] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('Уточните');
    expect(res.body.reply).not.toContain('не могу ответить');
    expect(res.body.reply).not.toBe('—');
    expect(res.body.reason).toBe('unclear');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('answers in-scope IT questions without requiring KB context', async () => {
    prismaMock.knowledgeArticle.findMany.mockResolvedValue([]);
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'Проверьте интернет, обновите страницу и попробуйте другой браузер.' } }],
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader(userToken))
      .send({ message: 'Почему не открывается страница?', lang: 'ru', history: [] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('браузер');
    expect(res.body.reply).not.toBe('—');
    expect(res.body.reason).toBe('answered');
    expect(createMock).toHaveBeenCalledOnce();
  });

  it('returns a safe AI-service message when provider fails', async () => {
    prismaMock.knowledgeArticle.findMany.mockResolvedValue([KB_CREATE_TICKET]);
    createMock.mockRejectedValue({ status: 401, message: 'Invalid API Key' });

    const res = await request(app)
      .post('/api/ai/chat')
      .set(authHeader(userToken))
      .send({ message: 'Как создать заявку?', lang: 'ru', history: [] });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain('не удалось получить ответ от AI-сервиса');
    expect(res.body.error).not.toContain('Invalid API Key');
    expect(res.body.reason).toBe('generation_error');
  });
});
