import { create } from 'zustand';

export interface Notification {
  id: string;
  ticketId: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotifState {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (n: Notification[], count: number) => void;
  addNotification: (n: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export const useNotifStore = create<NotifState>((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications, unreadCount) => set({ notifications, unreadCount }),
  addNotification: (n) => set((s) => ({
    notifications: [n, ...s.notifications].slice(0, 50),
    unreadCount: s.unreadCount + (n.read ? 0 : 1),
  })),
  markRead: (id) => set((s) => ({
    notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
    unreadCount: Math.max(0, s.unreadCount - (s.notifications.find(n => n.id === id)?.read ? 0 : 1)),
  })),
  markAllRead: () => set((s) => ({ notifications: s.notifications.map(n => ({ ...n, read: true })), unreadCount: 0 })),
}));
