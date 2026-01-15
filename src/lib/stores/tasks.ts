import { writable, derived } from 'svelte/store';
import type { Task } from '$lib/types';
import { storage } from '$lib/utils/storage';
import { generateId } from '$lib/utils/helpers';

function createTasksStore() {
  const initialValue = storage.get<Task[]>('tasks', []);
  const { subscribe, set, update } = writable<Task[]>(initialValue);

  return {
    subscribe,
    add: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      update(tasks => {
        const newTask: Task = {
          ...task,
          id: generateId(),
          status: task.status || 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const updated = [...tasks, newTask];
        storage.set('tasks', updated);
        return updated;
      });
    },
    update: (id: string, updates: Partial<Task>) => {
      update(tasks => {
        const updated = tasks.map(t =>
          t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
        );
        storage.set('tasks', updated);
        return updated;
      });
    },
    remove: (id: string) => {
      update(tasks => {
        const updated = tasks.map(t =>
          t.id === id ? { ...t, deletedAt: new Date().toISOString() } : t
        );
        storage.set('tasks', updated);
        return updated;
      });
    },
    updateActualTime: (id: string, additionalMinutes: number) => {
      update(tasks => {
        const updated = tasks.map(t => {
          if (t.id === id) {
            return {
              ...t,
              actualTime: (t.actualTime || 0) + additionalMinutes,
              updatedAt: new Date().toISOString()
            };
          }
          return t;
        });
        storage.set('tasks', updated);
        return updated;
      });
    }
  };
}

export const tasks = createTasksStore();

export const activeTasks = derived(tasks, $tasks =>
  $tasks.filter(t => !t.deletedAt)
);

export const tasksByProject = (projectId: string) =>
  derived(tasks, $tasks =>
    $tasks.filter(t => t.projectId === projectId && !t.deletedAt)
  );

export const unscheduledTasks = derived(
  [tasks],
  ([$tasks]) => {
    // This will be updated when we add events store
    return $tasks.filter(t => !t.deletedAt && t.status === 'pending');
  }
);
