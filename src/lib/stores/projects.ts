import { writable, derived } from 'svelte/store';
import type { Project } from '$lib/types';
import { storage } from '$lib/utils/storage';
import { generateId } from '$lib/utils/helpers';

function createProjectsStore() {
  const initialValue = storage.get<Project[]>('projects', []);
  const { subscribe, set, update } = writable<Project[]>(initialValue);

  return {
    subscribe,
    add: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
      update(projects => {
        const newProject: Project = {
          ...project,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const updated = [...projects, newProject];
        storage.set('projects', updated);
        return updated;
      });
    },
    update: (id: string, updates: Partial<Project>) => {
      update(projects => {
        const updated = projects.map(p =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        );
        storage.set('projects', updated);
        return updated;
      });
    },
    remove: (id: string) => {
      update(projects => {
        const updated = projects.map(p =>
          p.id === id ? { ...p, deletedAt: new Date().toISOString() } : p
        );
        storage.set('projects', updated);
        return updated;
      });
    },
    permanentlyDelete: (id: string) => {
      update(projects => {
        const updated = projects.filter(p => p.id !== id);
        storage.set('projects', updated);
        return updated;
      });
    },
    restore: (id: string) => {
      update(projects => {
        const updated = projects.map(p => {
          if (p.id === id) {
            const { deletedAt, ...rest } = p;
            return rest as Project;
          }
          return p;
        });
        storage.set('projects', updated);
        return updated;
      });
    }
  };
}

export const projects = createProjectsStore();

export const activeProjects = derived(projects, $projects =>
  $projects.filter(p => !p.deletedAt)
);

export const deletedProjects = derived(projects, $projects =>
  $projects.filter(p => p.deletedAt)
);
