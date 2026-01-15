import { writable, derived } from 'svelte/store';
import type { PomodoroSession } from '$lib/types';
import { storage } from '$lib/utils/storage';
import { generateId } from '$lib/utils/helpers';

function createPomodoroStore() {
  const initialValue = storage.get<PomodoroSession[]>('pomodoroSessions', []);
  const { subscribe, set, update } = writable<PomodoroSession[]>(initialValue);

  return {
    subscribe,
    add: (session: Omit<PomodoroSession, 'id' | 'createdAt'>) => {
      update(sessions => {
        const newSession: PomodoroSession = {
          ...session,
          id: generateId(),
          createdAt: new Date().toISOString()
        };
        const updated = [newSession, ...sessions];
        storage.set('pomodoroSessions', updated);
        return updated;
      });
    },
    clear: () => {
      set([]);
      storage.set('pomodoroSessions', []);
    }
  };
}

export const pomodoroSessions = createPomodoroStore();

export const sessionsByTask = (taskId: string) =>
  derived(pomodoroSessions, $sessions =>
    $sessions.filter(session => session.taskId === taskId)
  );
