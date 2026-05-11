import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prismaMock } from './setup';
import {
  TEST_USER, TEST_ADMIN,
  userToken, adminToken,
  authHeader,
} from './helpers';

const SAMPLE_ARTICLE = {
  id: 'article-001',
  title: 'How to reset your password',
  content: 'Go to settings and click Reset Password...',
  category: 'SOFTWARE',
  tags: ['password', 'reset'],
  authorId: TEST_ADMIN.id,
  published: true,
  viewCount: 42,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GET /api/kb/articles', () => {
  it('returns list of articles', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.knowledgeArticle.findMany.mockResolvedValue([SAMPLE_ARTICLE]);
    prismaMock.knowledgeArticle.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/kb/articles')
      .set(authHeader(userToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('articles');
    expect(res.body.articles).toHaveLength(1);
    expect(res.body).toHaveProperty('total', 1);
  });

  it('supports search', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.knowledgeArticle.findMany.mockResolvedValue([]);
    prismaMock.knowledgeArticle.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/kb/articles?search=vpn')
      .set(authHeader(userToken));

    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(0);
  });

  it('supports category filter', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.knowledgeArticle.findMany.mockResolvedValue([SAMPLE_ARTICLE]);
    prismaMock.knowledgeArticle.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/kb/articles?category=SOFTWARE')
      .set(authHeader(userToken));

    expect(res.status).toBe(200);
  });
});

describe('GET /api/kb/articles/:id', () => {
  it('returns article and increments view count', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.knowledgeArticle.findUnique.mockResolvedValue(SAMPLE_ARTICLE);
    prismaMock.knowledgeArticle.update.mockResolvedValue({ ...SAMPLE_ARTICLE, viewCount: 43 });

    const res = await request(app)
      .get(`/api/kb/articles/${SAMPLE_ARTICLE.id}`)
      .set(authHeader(userToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('title', SAMPLE_ARTICLE.title);
    expect(prismaMock.knowledgeArticle.update).toHaveBeenCalled();
  });

  it('returns 404 for missing article', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.knowledgeArticle.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/kb/articles/nonexistent')
      .set(authHeader(userToken));

    expect(res.status).toBe(404);
  });
});

describe('POST /api/kb/articles (admin)', () => {
  it('admin creates an article', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.knowledgeArticle.create.mockResolvedValue(SAMPLE_ARTICLE);

    const res = await request(app)
      .post('/api/kb/articles')
      .set(authHeader(adminToken))
      .send({
        title: 'New KB Article Title',
        content: 'This is the body of the knowledge base article with enough content.',
        category: 'SOFTWARE',
        tags: ['test'],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('user cannot create (403)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const res = await request(app)
      .post('/api/kb/articles')
      .set(authHeader(userToken))
      .send({
        title: 'New KB Article Title',
        content: 'This is the body of the article with enough content here.',
        category: 'SOFTWARE',
      });

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid data', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);

    const res = await request(app)
      .post('/api/kb/articles')
      .set(authHeader(adminToken))
      .send({ title: 'Hi', content: 'short', category: 'BAD' });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/kb/articles/:id (admin)', () => {
  it('admin can update', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.knowledgeArticle.update.mockResolvedValue({ ...SAMPLE_ARTICLE, title: 'Updated' });

    const res = await request(app)
      .put(`/api/kb/articles/${SAMPLE_ARTICLE.id}`)
      .set(authHeader(adminToken))
      .send({ title: 'Updated' });

    expect(res.status).toBe(200);
  });

  it('user cannot update (403)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const res = await request(app)
      .put(`/api/kb/articles/${SAMPLE_ARTICLE.id}`)
      .set(authHeader(userToken))
      .send({ title: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/kb/articles/:id (admin)', () => {
  it('admin can delete', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.knowledgeArticle.delete.mockResolvedValue(SAMPLE_ARTICLE);

    const res = await request(app)
      .delete(`/api/kb/articles/${SAMPLE_ARTICLE.id}`)
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message', 'Deleted');
  });

  it('user cannot delete (403)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const res = await request(app)
      .delete(`/api/kb/articles/${SAMPLE_ARTICLE.id}`)
      .set(authHeader(userToken));

    expect(res.status).toBe(403);
  });
});
