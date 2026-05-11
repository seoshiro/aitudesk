import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'aitudesk_jwt_super_secret_key_change_in_production';

export const TEST_ADMIN = {
  id: 'admin-id-001',
  email: 'admin@test.com',
  role: 'ADMIN' as const,
  name: 'Test Admin',
  avatarUrl: null,
  specializations: [],
  passwordHash: '$2a$12$fake',
};

export const TEST_AGENT = {
  id: 'agent-id-001',
  email: 'agent@test.com',
  role: 'AGENT' as const,
  name: 'Test Agent',
  avatarUrl: null,
  specializations: ['SOFTWARE', 'HARDWARE'],
  passwordHash: '$2a$12$fake',
};

export const TEST_USER = {
  id: 'user-id-001',
  email: 'user@test.com',
  role: 'USER' as const,
  name: 'Test User',
  avatarUrl: null,
  specializations: [],
  passwordHash: '$2a$12$fake',
};

export function makeToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
}

export const adminToken = makeToken(TEST_ADMIN.id);
export const agentToken = makeToken(TEST_AGENT.id);
export const userToken = makeToken(TEST_USER.id);

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const SAMPLE_TICKET = {
  id: 'ticket-001',
  ticketNumber: 1,
  subject: 'Test Ticket',
  description: 'This is a test ticket description',
  category: 'SOFTWARE',
  priority: 'MEDIUM',
  status: 'NEW',
  creatorId: TEST_USER.id,
  assigneeId: TEST_AGENT.id,
  slaDeadlineResponse: new Date(Date.now() + 8 * 3600000),
  slaDeadlineResolve: new Date(Date.now() + 24 * 3600000),
  slaBreached: false,
  firstResponseAt: null,
  resolvedAt: null,
  waitingSince: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  creator: { id: TEST_USER.id, name: TEST_USER.name, email: TEST_USER.email, avatarUrl: null },
  assignee: { id: TEST_AGENT.id, name: TEST_AGENT.name, email: TEST_AGENT.email, avatarUrl: null },
  _count: { messages: 0, attachments: 0 },
};
