import { vi, beforeEach } from 'vitest';

// Tests must not depend on a local backend/.env. The AI provider is mocked,
// so any non-empty key enables the route under test.
process.env.AI_API_KEY ??= 'test-ai-key';

// ── Mock Prisma ──────────────────────────────────────────────────────────────
const mockPrismaModels = {
  user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
  ticket: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  ticketMessage: { findMany: vi.fn(), create: vi.fn() },
  ticketAttachment: {},
  notification: { findMany: vi.fn(), create: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  rating: { upsert: vi.fn(), aggregate: vi.fn() },
  refreshToken: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  knowledgeArticle: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  slaPolicy: {},
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $queryRaw: vi.fn(),
};

vi.mock('../src/lib/prisma', () => ({
  prisma: mockPrismaModels,
}));

// ── Mock Socket ──────────────────────────────────────────────────────────────
vi.mock('../src/socket', () => ({
  initSocket: vi.fn(),
  emitNotification: vi.fn(),
  emitToTicket: vi.fn(),
  getIo: vi.fn(() => ({ to: () => ({ emit: vi.fn() }) })),
}));

// ── Reset all mocks between tests ────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

export { mockPrismaModels as prismaMock };
