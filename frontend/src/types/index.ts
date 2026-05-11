// Shared TypeScript types for the frontend

export type Role = 'USER' | 'AGENT' | 'ADMIN';
export type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
export type TicketCategory = 'HARDWARE' | 'SOFTWARE' | 'NETWORK' | 'OTHER';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MessageType = 'PUBLIC' | 'INTERNAL';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  specializations?: TicketCategory[];
  createdAt?: string;
}

export interface Ticket {
  id: string;
  ticketNumber: number;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: Priority;
  status: TicketStatus;
  creator: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
  assignee: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> | null;
  slaDeadlineResponse: string | null;
  slaDeadlineResolve: string | null;
  slaBreached: boolean;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  waitingSince: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number; attachments: number };
  attachments?: Attachment[];
}

export interface TicketMessage {
  id: string;
  content: string;
  type: MessageType;
  readBy: string[];
  createdAt: string;
  author: Pick<User, 'id' | 'name' | 'role' | 'avatarUrl'>;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimetype: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: TicketCategory;
  tags: string[];
  published: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  NEW: 'Новый', IN_PROGRESS: 'В работе', WAITING: 'Ожидание',
  RESOLVED: 'Решено', CLOSED: 'Закрыт', REOPENED: 'Переоткрыт',
};

export const STATUS_CLASS: Record<TicketStatus, string> = {
  NEW: 'badge-new', IN_PROGRESS: 'badge-progress', WAITING: 'badge-waiting',
  RESOLVED: 'badge-resolved', CLOSED: 'badge-closed', REOPENED: 'badge-reopened',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Низкий', MEDIUM: 'Средний', HIGH: 'Высокий', CRITICAL: 'Критический',
};

export const PRIORITY_CLASS: Record<Priority, string> = {
  LOW: 'priority-low', MEDIUM: 'priority-medium', HIGH: 'priority-high', CRITICAL: 'priority-critical',
};

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  HARDWARE: 'Железо', SOFTWARE: 'ПО', NETWORK: 'Сеть', OTHER: 'Другое',
};
