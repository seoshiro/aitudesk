import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prismaMock } from './setup';
import {
  TEST_USER, TEST_AGENT, TEST_ADMIN,
  userToken, agentToken, adminToken,
  authHeader, SAMPLE_TICKET,
} from './helpers';

describe('GET /api/tickets', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(401);
  });

  it('returns paginated list for authenticated USER', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findMany.mockResolvedValue([SAMPLE_TICKET]);
    prismaMock.ticket.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/tickets')
      .set(authHeader(userToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tickets');
    expect(res.body).toHaveProperty('total', 1);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('totalPages', 1);
    expect(Array.isArray(res.body.tickets)).toBe(true);
  });

  it('returns paginated list for AGENT', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_AGENT);
    prismaMock.ticket.findMany.mockResolvedValue([SAMPLE_TICKET]);
    prismaMock.ticket.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/tickets')
      .set(authHeader(agentToken));

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(1);
  });

  it('supports status filter', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticket.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/tickets?status=RESOLVED')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(0);
  });

  it('supports search query', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticket.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/tickets?search=printer')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
  });

  it('supports pagination params', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.ticket.findMany.mockResolvedValue([]);
    prismaMock.ticket.count.mockResolvedValue(50);

    const res = await request(app)
      .get('/api/tickets?page=3&limit=10')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(3);
    expect(res.body.totalPages).toBe(5);
  });
});

describe('GET /api/tickets/:id', () => {
  it('returns 404 for non-existent ticket', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/tickets/nonexistent')
      .set(authHeader(userToken));

    expect(res.status).toBe(404);
  });

  it('returns ticket detail for creator', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findUnique.mockResolvedValue({ ...SAMPLE_TICKET, attachments: [] });

    const res = await request(app)
      .get(`/api/tickets/${SAMPLE_TICKET.id}`)
      .set(authHeader(userToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', SAMPLE_TICKET.id);
  });

  it('returns 403 when USER tries to access another users ticket', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findUnique.mockResolvedValue({
      ...SAMPLE_TICKET,
      creator: { id: 'someone-else', name: 'Other', email: 'o@t.com', avatarUrl: null },
      attachments: [],
    });

    const res = await request(app)
      .get(`/api/tickets/${SAMPLE_TICKET.id}`)
      .set(authHeader(userToken));

    expect(res.status).toBe(403);
  });
});

describe('POST /api/tickets', () => {
  it('creates a ticket and returns 201', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.user.findMany.mockResolvedValue([{ id: TEST_AGENT.id }]);
    prismaMock.ticket.count.mockResolvedValue(0);
    prismaMock.ticket.create.mockResolvedValue(SAMPLE_TICKET);
    prismaMock.notification.create.mockResolvedValue({ id: 'n1' });

    const res = await request(app)
      .post('/api/tickets')
      .set(authHeader(userToken))
      .field('subject', 'Printer not working')
      .field('description', 'The office printer refuses to print anything at all')
      .field('category', 'HARDWARE')
      .field('priority', 'MEDIUM');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('returns 400 for missing required fields', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const res = await request(app)
      .post('/api/tickets')
      .set(authHeader(userToken))
      .send({ subject: 'Hi' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid priority', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const res = await request(app)
      .post('/api/tickets')
      .set(authHeader(userToken))
      .send({
        subject: 'Valid subject here',
        description: 'A valid description that is long enough',
        category: 'SOFTWARE',
        priority: 'INVALID',
      });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({
        subject: 'Valid subject here',
        description: 'A valid description that is long enough',
        category: 'SOFTWARE',
        priority: 'MEDIUM',
      });

    expect(res.status).toBe(401);
  });
});

describe('PUT /api/tickets/:id/status', () => {
  it('agent can set IN_PROGRESS', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_AGENT);
    prismaMock.ticket.findUnique.mockResolvedValue({ ...SAMPLE_TICKET, status: 'NEW' });
    prismaMock.ticket.update.mockResolvedValue({ ...SAMPLE_TICKET, status: 'IN_PROGRESS' });
    prismaMock.notification.create.mockResolvedValue({ id: 'n2' });

    const res = await request(app)
      .put(`/api/tickets/${SAMPLE_TICKET.id}/status`)
      .set(authHeader(agentToken))
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
  });

  it('agent can set RESOLVED', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_AGENT);
    prismaMock.ticket.findUnique.mockResolvedValue({ ...SAMPLE_TICKET, status: 'IN_PROGRESS' });
    prismaMock.ticket.update.mockResolvedValue({ ...SAMPLE_TICKET, status: 'RESOLVED' });
    prismaMock.notification.create.mockResolvedValue({ id: 'n3' });

    const res = await request(app)
      .put(`/api/tickets/${SAMPLE_TICKET.id}/status`)
      .set(authHeader(agentToken))
      .send({ status: 'RESOLVED' });

    expect(res.status).toBe(200);
  });

  it('user cannot set IN_PROGRESS', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findUnique.mockResolvedValue({ ...SAMPLE_TICKET, status: 'NEW' });

    const res = await request(app)
      .put(`/api/tickets/${SAMPLE_TICKET.id}/status`)
      .set(authHeader(userToken))
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(403);
  });

  it('user can close a RESOLVED ticket they own', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findUnique.mockResolvedValue({ ...SAMPLE_TICKET, status: 'RESOLVED', creatorId: TEST_USER.id });
    prismaMock.ticket.update.mockResolvedValue({ ...SAMPLE_TICKET, status: 'CLOSED' });
    prismaMock.notification.create.mockResolvedValue({ id: 'n4' });

    const res = await request(app)
      .put(`/api/tickets/${SAMPLE_TICKET.id}/status`)
      .set(authHeader(userToken))
      .send({ status: 'CLOSED' });

    expect(res.status).toBe(200);
  });

  it('user cannot close a non-RESOLVED ticket', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findUnique.mockResolvedValue({ ...SAMPLE_TICKET, status: 'IN_PROGRESS', creatorId: TEST_USER.id });

    const res = await request(app)
      .put(`/api/tickets/${SAMPLE_TICKET.id}/status`)
      .set(authHeader(userToken))
      .send({ status: 'CLOSED' });

    expect(res.status).toBe(400);
  });

  it('agent cannot modify another agents ticket', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_AGENT);
    prismaMock.ticket.findUnique.mockResolvedValue({ ...SAMPLE_TICKET, assigneeId: 'other-agent-id' });

    const res = await request(app)
      .put(`/api/tickets/${SAMPLE_TICKET.id}/status`)
      .set(authHeader(agentToken))
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent ticket', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_AGENT);
    prismaMock.ticket.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/tickets/fake-id/status')
      .set(authHeader(agentToken))
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tickets/:id/assign', () => {
  it('admin can reassign a ticket', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.ticket.update.mockResolvedValue({ ...SAMPLE_TICKET, assigneeId: 'new-agent' });
    prismaMock.notification.create.mockResolvedValue({ id: 'n5' });

    const res = await request(app)
      .put(`/api/tickets/${SAMPLE_TICKET.id}/assign`)
      .set(authHeader(adminToken))
      .send({ assigneeId: 'new-agent' });

    expect(res.status).toBe(200);
  });

  it('agent cannot reassign (403)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_AGENT);

    const res = await request(app)
      .put(`/api/tickets/${SAMPLE_TICKET.id}/assign`)
      .set(authHeader(agentToken))
      .send({ assigneeId: 'new-agent' });

    expect(res.status).toBe(403);
  });

  it('user cannot reassign (403)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const res = await request(app)
      .put(`/api/tickets/${SAMPLE_TICKET.id}/assign`)
      .set(authHeader(userToken))
      .send({ assigneeId: 'new-agent' });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/tickets/:id/rate', () => {
  it('creator can rate a CLOSED ticket', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findUnique.mockResolvedValue({ ...SAMPLE_TICKET, status: 'CLOSED', creatorId: TEST_USER.id });
    prismaMock.rating.upsert.mockResolvedValue({ id: 'r1', score: 5, comment: null, ticketId: SAMPLE_TICKET.id });
    prismaMock.notification.create.mockResolvedValue({ id: 'n6' });

    const res = await request(app)
      .post(`/api/tickets/${SAMPLE_TICKET.id}/rate`)
      .set(authHeader(userToken))
      .send({ score: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('score', 5);
  });

  it('returns 400 for score out of range', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findUnique.mockResolvedValue({ ...SAMPLE_TICKET, status: 'CLOSED', creatorId: TEST_USER.id });

    const res = await request(app)
      .post(`/api/tickets/${SAMPLE_TICKET.id}/rate`)
      .set(authHeader(userToken))
      .send({ score: 0 });

    expect(res.status).toBe(400);
  });

  it('returns 400 for score > 5', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findUnique.mockResolvedValue({ ...SAMPLE_TICKET, status: 'CLOSED', creatorId: TEST_USER.id });

    const res = await request(app)
      .post(`/api/tickets/${SAMPLE_TICKET.id}/rate`)
      .set(authHeader(userToken))
      .send({ score: 6 });

    expect(res.status).toBe(400);
  });

  it('cannot rate a non-CLOSED ticket', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findUnique.mockResolvedValue({ ...SAMPLE_TICKET, status: 'RESOLVED', creatorId: TEST_USER.id });

    const res = await request(app)
      .post(`/api/tickets/${SAMPLE_TICKET.id}/rate`)
      .set(authHeader(userToken))
      .send({ score: 4 });

    expect(res.status).toBe(400);
  });

  it('non-creator cannot rate', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findUnique.mockResolvedValue({ ...SAMPLE_TICKET, status: 'CLOSED', creatorId: 'someone-else' });

    const res = await request(app)
      .post(`/api/tickets/${SAMPLE_TICKET.id}/rate`)
      .set(authHeader(userToken))
      .send({ score: 4 });

    expect(res.status).toBe(403);
  });
});
