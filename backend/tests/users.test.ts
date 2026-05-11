import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prismaMock } from './setup';
import {
  TEST_USER, TEST_AGENT, TEST_ADMIN,
  userToken, agentToken, adminToken,
  authHeader,
} from './helpers';

describe('GET /api/users/me', () => {
  it('returns current user profile', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(TEST_USER) // auth middleware
      .mockResolvedValueOnce({ ...TEST_USER, specializations: [], createdAt: new Date() }); // route handler

    const res = await request(app)
      .get('/api/users/me')
      .set(authHeader(userToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', TEST_USER.id);
    expect(res.body).toHaveProperty('email', TEST_USER.email);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/users/me', () => {
  it('updates name', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.user.update.mockResolvedValue({ ...TEST_USER, name: 'Updated Name' });

    const res = await request(app)
      .put('/api/users/me')
      .set(authHeader(userToken))
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'Updated Name');
  });

  it('returns 400 for invalid name (too short)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const res = await request(app)
      .put('/api/users/me')
      .set(authHeader(userToken))
      .send({ name: 'A' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/users (admin only)', () => {
  it('admin sees all users', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.user.findMany.mockResolvedValue([TEST_ADMIN, TEST_AGENT, TEST_USER]);

    const res = await request(app)
      .get('/api/users')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
  });

  it('agent gets 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_AGENT);

    const res = await request(app)
      .get('/api/users')
      .set(authHeader(agentToken));

    expect(res.status).toBe(403);
  });

  it('user gets 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const res = await request(app)
      .get('/api/users')
      .set(authHeader(userToken));

    expect(res.status).toBe(403);
  });
});

describe('PUT /api/users/:id/role (admin)', () => {
  it('admin can change role', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.user.update.mockResolvedValue({ ...TEST_USER, role: 'AGENT', specializations: ['SOFTWARE'] });

    const res = await request(app)
      .put(`/api/users/${TEST_USER.id}/role`)
      .set(authHeader(adminToken))
      .send({ role: 'AGENT', specializations: ['SOFTWARE'] });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('AGENT');
  });

  it('agent cannot change role (403)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_AGENT);

    const res = await request(app)
      .put(`/api/users/${TEST_USER.id}/role`)
      .set(authHeader(agentToken))
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/users/agents', () => {
  it('admin can list agents', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.user.findMany.mockResolvedValue([TEST_AGENT]);

    const res = await request(app)
      .get('/api/users/agents')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('user cannot list agents (403)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const res = await request(app)
      .get('/api/users/agents')
      .set(authHeader(userToken));

    expect(res.status).toBe(403);
  });
});
