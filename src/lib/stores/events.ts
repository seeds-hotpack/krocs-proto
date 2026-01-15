import { writable, derived } from 'svelte/store';
import type { Event } from '$lib/types';
import { storage } from '$lib/utils/storage';
import { generateId } from '$lib/utils/helpers';

function createEventsStore() {
  const initialValue = storage.get<Event[]>('events', []);
  const { subscribe, set, update } = writable<Event[]>(initialValue);

  return {
    subscribe,
    add: (event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => {
      update(events => {
        const newEvent: Event = {
          ...event,
          id: generateId(),
          isRecurring: event.isRecurring || false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const updated = [...events, newEvent];
        storage.set('events', updated);
        return updated;
      });
    },
    update: (id: string, updates: Partial<Event>) => {
      update(events => {
        const updated = events.map(e =>
          e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
        );
        storage.set('events', updated);
        return updated;
      });
    },
    remove: (id: string) => {
      update(events => {
        const updated = events.map(e =>
          e.id === id ? { ...e, deletedAt: new Date().toISOString() } : e
        );
        storage.set('events', updated);
        return updated;
      });
    },
    move: (id: string, newStartTime: string, newEndTime: string) => {
      update(events => {
        const updated = events.map(e => {
          if (e.id === id) {
            return {
              ...e,
              startTime: newStartTime,
              endTime: newEndTime,
              updatedAt: new Date().toISOString()
            };
          }
          return e;
        });
        storage.set('events', updated);
        return updated;
      });
    },
    getEventsByDateRange: (startDate: string, endDate: string) => {
      let result: Event[] = [];
      subscribe(events => {
        result = events.filter(e => {
          if (e.deletedAt) return false;
          const eventStart = new Date(e.startTime);
          const rangeStart = new Date(startDate);
          const rangeEnd = new Date(endDate);
          return eventStart >= rangeStart && eventStart <= rangeEnd;
        });
      })();
      return result;
    }
  };
}

export const events = createEventsStore();

export const activeEvents = derived(events, $events =>
  $events.filter(e => !e.deletedAt)
);

export const eventsByDate = (date: string) =>
  derived(events, $events => {
    const targetDate = new Date(date).toDateString();
    return $events.filter(e => {
      if (e.deletedAt) return false;
      const eventDate = new Date(e.startTime).toDateString();
      return eventDate === targetDate;
    });
  });
