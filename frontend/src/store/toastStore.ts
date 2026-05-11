import { create } from 'zustand';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

interface ToastState {
  toasts: Toast[];
  add: (t: Omit<Toast, 'id'>) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (t) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, message?: string) => useToastStore.getState().add({ type: 'success', title, message }),
  error:   (title: string, message?: string) => useToastStore.getState().add({ type: 'error', title, message }),
  info:    (title: string, message?: string) => useToastStore.getState().add({ type: 'info', title, message }),
  warning: (title: string, message?: string) => useToastStore.getState().add({ type: 'warning', title, message }),
};
