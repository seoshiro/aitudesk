// Backend (Prisma enum) ↔ UI labels & helpers

export type BackendRole = 'USER' | 'AGENT' | 'ADMIN';
export type BackendStatus =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'WAITING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED';
export type BackendPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BackendCategory = 'HARDWARE' | 'SOFTWARE' | 'NETWORK' | 'OTHER';

export const roleLabelKeys: Record<BackendRole, string> = {
  USER: 'entities.roles.USER',
  AGENT: 'entities.roles.AGENT',
  ADMIN: 'entities.roles.ADMIN',
};

export const statusLabelKeys: Record<BackendStatus, string> = {
  NEW: 'entities.statuses.NEW',
  IN_PROGRESS: 'entities.statuses.IN_PROGRESS',
  WAITING: 'entities.statuses.WAITING',
  RESOLVED: 'entities.statuses.RESOLVED',
  CLOSED: 'entities.statuses.CLOSED',
  REOPENED: 'entities.statuses.REOPENED',
};

export const priorityLabelKeys: Record<BackendPriority, string> = {
  LOW: 'entities.priorities.LOW',
  MEDIUM: 'entities.priorities.MEDIUM',
  HIGH: 'entities.priorities.HIGH',
  CRITICAL: 'entities.priorities.CRITICAL',
};

export const categoryLabelKeys: Record<string, string> = {
  HARDWARE: 'entities.categories.HARDWARE',
  SOFTWARE: 'entities.categories.SOFTWARE',
  NETWORK: 'entities.categories.NETWORK',
  ACCESS: 'entities.categories.ACCESS',
  OTHER: 'entities.categories.OTHER',
};

export const notificationTypeLabelKeys: Record<string, string> = {
  NEW_MESSAGE: 'entities.notifications.NEW_MESSAGE',
  TICKET_ASSIGNED: 'entities.notifications.TICKET_ASSIGNED',
  STATUS_CHANGED: 'entities.notifications.STATUS_CHANGED',
  TICKET_RATED: 'entities.notifications.TICKET_RATED',
  SLA_BREACH: 'entities.notifications.SLA_BREACH',
};

export const getRoleLabelKey = (role: BackendRole) => roleLabelKeys[role];
export const getStatusLabelKey = (status: BackendStatus) => statusLabelKeys[status];
export const getPriorityLabelKey = (priority: BackendPriority) => priorityLabelKeys[priority];
export const getCategoryLabelKey = (category: BackendCategory | string) =>
  categoryLabelKeys[category] ?? category;
export const getNotificationTypeLabelKey = (type: string) =>
  notificationTypeLabelKeys[type] ?? type;

// SLA reference hours, mirrors backend/sla.service
export const slaHours: Record<BackendPriority, { response: number; resolve: number }> = {
  CRITICAL: { response: 0.5, resolve: 1 },
  HIGH: { response: 1, resolve: 4 },
  MEDIUM: { response: 4, resolve: 24 },
  LOW: { response: 24, resolve: 72 },
};

// Deterministic accent color from a string (for avatars)
const PALETTE = [
  '#3f64a8',
  '#5d7f9e',
  '#7a6f53',
  '#4f7a5c',
  '#8a5a4b',
  '#6a5d8c',
  '#4f6d7a',
  '#8a7a4c',
];
export function colorFromString(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
