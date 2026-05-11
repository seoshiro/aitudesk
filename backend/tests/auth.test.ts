import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/index';
import { prismaMock } from './setup';
import { TEST_USER, TEST_ADMIN, adminToken, authHeader } from './helpers';

describe('POST /api/auth/register', () => {
  it('creates a new user and returns 201 with accessToken', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'new-user-id',
      name: 'New User',
      email: 'new@test.com',
      role: 'USER',
      avatarUrl: null,
      passwordHash: 'hashed',
    });
    prismaMock.refreshToken.create.mockResolvedValue({ id: 'rt1' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'new@test.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user).toHaveProperty('email', 'new@test.com');
  });

  it('returns 409 if email already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup User', email: TEST_USER.email, password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for invalid input (short name)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'a@b.com', password: '123456' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Good Name', email: 'not-email', password: '123456' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for too-short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Good Name', email: 'test@x.com', password: '12' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns accessToken and user on valid credentials', async () => {
    const hash = await bcrypt.hash('correct_pass', 12);
    prismaMock.user.findUnique.mockResolvedValue({
      ...TEST_USER,
      passwordHash: hash,
    });
    prismaMock.refreshToken.create.mockResolvedValue({ id: 'rt2' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'correct_pass' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user).toHaveProperty('id', TEST_USER.id);
  });

  it('returns 401 for unknown email', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'pass' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('returns 401 for wrong password', async () => {
    const hash = await bcrypt.hash('real_password', 12);
    prismaMock.user.findUnique.mockResolvedValue({ ...TEST_USER, passwordHash: hash });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'wrong_password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('returns 400 for missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'x@y.com' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears cookie when authenticated', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post('/api/auth/logout')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns 401 when no refresh cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No refresh token');
  });
});
