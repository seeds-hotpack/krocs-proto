import { writable } from 'svelte/store';
import type { Settings } from '$lib/types';
import { storage } from '$lib/utils/storage';

const defaultSettings: Settings = {
  weeklyAvailableTime: 2400, // 40 hours in minutes
  monthlyAvailableTime: 9600, // 160 hours in minutes
  weeklyGlobalBuffer: 480, // 8 hours
  monthlyGlobalBuffer: 1920, // 32 hours
  globalBufferPolicy: 'warn',
  notifications: {
    deadlineReminder: { enabled: true, time: '09:00' },
    bufferWarning: { enabled: true, threshold: 80 },
    unscheduledTask: { enabled: true, days: 3 },
    weeklyReview: { enabled: true, day: 'Monday', time: '09:00' }
  },
  timeUnit: 'hour',
  defaultCalendarView: 'week',
  onboardingCompleted: false,
  skippedOnboardingSteps: []
};

function createSettingsStore() {
  const initialValue = storage.get<Settings>('settings', defaultSettings);
  const { subscribe, set, update } = writable<Settings>(initialValue);

  return {
    subscribe,
    set: (value: Settings) => {
      storage.set('settings', value);
      set(value);
    },
    update: (fn: (value: Settings) => Settings) => {
      update(value => {
        const newValue = fn(value);
        storage.set('settings', newValue);
        return newValue;
      });
    },
    reset: () => {
      storage.set('settings', defaultSettings);
      set(defaultSettings);
    },
    completeOnboarding: () => {
      update(settings => {
        const newSettings = { ...settings, onboardingCompleted: true };
        storage.set('settings', newSettings);
        return newSettings;
      });
    }
  };
}

export const settings = createSettingsStore();
