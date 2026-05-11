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

export const roleLabels: Record<BackendRole, string> = {
  USER: 'Пользователь',
  AGENT: 'Агент поддержки',
  ADMIN: 'Администратор',
};

export const statusLabels: Record<BackendStatus, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  WAITING: 'Ожидает',
  RESOLVED: 'Решена',
  CLOSED: 'Закрыта',
  REOPENED: 'Возобновлена',
};

export const priorityLabels: Record<BackendPriority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
  CRITICAL: 'Критичный',
};

export const categoryLabels: Record<BackendCategory, string> = {
  HARDWARE: 'Оборудование',
  SOFTWARE: 'Программы',
  NETWORK: 'Сеть',
  OTHER: 'Другое',
};

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

// Relative ru datetime
export function formatRelativeRu(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const diff = Date.now() - date.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 45) return 'только что';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const day = Math.round(hr / 24);
  if (day === 1) return 'вчера';
  if (day < 7) return `${day} дн назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
