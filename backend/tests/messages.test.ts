import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prismaMock } from './setup';
import {
  TEST_USER, TEST_AGENT,
  userToken, agentToken,
  authHeader, SAMPLE_TICKET,
} from './helpers';

describe('GET /api/tickets/:id/messages', () => {
  it('returns messages for a ticket', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findUnique.mockResolvedValue({ id: SAMPLE_TICKET.id, creatorId: TEST_USER.id });
    prismaMock.ticketMessage.findMany.mockResolvedValue([
      {
        id: 'msg-1',
        content: 'Hello',
        type: 'PUBLIC',
        readBy: [],
        createdAt: new Date(),
        author: { id: TEST_USER.id, name: TEST_USER.name, role: 'USER', avatarUrl: null },
        attachments: [],
      },
    ]);

    const res = await request(app)
      .get(`/api/tickets/${SAMPLE_TICKET.id}/messages`)
      .set(authHeader(userToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toHaveProperty('content', 'Hello');
  });

  it('returns 404 for non-existent ticket', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/tickets/fake-id/messages')
      .set(authHeader(userToken));

    expect(res.status).toBe(404);
  });
});

describe('POST /api/tickets/:id/messages', () => {
  it('creates a message', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_AGENT);
    prismaMock.ticket.findUnique.mockResolvedValue(SAMPLE_TICKET);
    prismaMock.ticketMessage.create.mockResolvedValue({
      id: 'msg-2',
      content: 'Working on it',
      type: 'PUBLIC',
      readBy: [],
      createdAt: new Date(),
      author: { id: TEST_AGENT.id, name: TEST_AGENT.name, role: 'AGENT', avatarUrl: null },
      attachments: [],
    });
    prismaMock.notification.create.mockResolvedValue({ id: 'n1' });

    const res = await request(app)
      .post(`/api/tickets/${SAMPLE_TICKET.id}/messages`)
      .set(authHeader(agentToken))
      .field('content', 'Working on it');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('content', 'Working on it');
  });

  it('returns 400 for empty content and no files', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_AGENT);
    prismaMock.ticket.findUnique.mockResolvedValue(SAMPLE_TICKET);

    const res = await request(app)
      .post(`/api/tickets/${SAMPLE_TICKET.id}/messages`)
      .set(authHeader(agentToken))
      .send({ content: '' });

    expect(res.status).toBe(400);
  });

  it('USER cannot send INTERNAL messages', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const res = await request(app)
      .post(`/api/tickets/${SAMPLE_TICKET.id}/messages`)
      .set(authHeader(userToken))
      .field('content', 'Secret note')
      .field('type', 'INTERNAL');

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent ticket', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_AGENT);
    prismaMock.ticket.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/tickets/fake-id/messages')
      .set(authHeader(agentToken))
      .field('content', 'Hello');

    expect(res.status).toBe(404);
  });
});
