import { writable, derived } from 'svelte/store';
import type { Notification } from '$lib/types';
import { storage } from '$lib/utils/storage';
import { generateId } from '$lib/utils/helpers';

function createNotificationsStore() {
  const initialValue = storage.get<Notification[]>('notifications', []);
  const { subscribe, set, update } = writable<Notification[]>(initialValue);

  return {
    subscribe,
    add: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
      update(notifications => {
        const newNotification: Notification = {
          ...notification,
          id: generateId(),
          read: false,
          createdAt: new Date().toISOString()
        };
        const updated = [newNotification, ...notifications];
        storage.set('notifications', updated);
        return updated;
      });
    },
    markAsRead: (id: string) => {
      update(notifications => {
        const updated = notifications.map(n => (n.id === id ? { ...n, read: true } : n));
        storage.set('notifications', updated);
        return updated;
      });
    },
    markAllAsRead: () => {
      update(notifications => {
        const updated = notifications.map(n => ({ ...n, read: true }));
        storage.set('notifications', updated);
        return updated;
      });
    },
    clear: () => {
      set([]);
      storage.set('notifications', []);
    }
  };
}

export const notifications = createNotificationsStore();

export const unreadNotifications = derived(notifications, $notifications =>
  $notifications.filter(n => !n.read)
);

export const unreadCount = derived(unreadNotifications, $unread => $unread.length);
