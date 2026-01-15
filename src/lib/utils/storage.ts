import { browser } from '$app/environment';

const STORAGE_VERSION = '1.0.0';
const STORAGE_KEY_PREFIX = 'krocs_';

export class LocalStorageManager {
  private getKey(key: string): string {
    return `${STORAGE_KEY_PREFIX}${key}`;
  }

  get<T>(key: string, defaultValue: T): T {
    if (!browser) return defaultValue;

    try {
      const item = localStorage.getItem(this.getKey(key));
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading from localStorage: ${key}`, error);
      return defaultValue;
    }
  }

  set<T>(key: string, value: T): void {
    if (!browser) return;

    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage: ${key}`, error);
    }
  }

  remove(key: string): void {
    if (!browser) return;

    try {
      localStorage.removeItem(this.getKey(key));
    } catch (error) {
      console.error(`Error removing from localStorage: ${key}`, error);
    }
  }

  clear(): void {
    if (!browser) return;

    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(STORAGE_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing localStorage', error);
    }
  }

  exportData(): string {
    if (!browser) return '{}';

    const data: Record<string, any> = {
      version: STORAGE_VERSION,
      exportedAt: new Date().toISOString(),
      data: {}
    };

    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        const cleanKey = key.replace(STORAGE_KEY_PREFIX, '');
        try {
          data.data[cleanKey] = JSON.parse(localStorage.getItem(key) || '{}');
        } catch {
          data.data[cleanKey] = localStorage.getItem(key);
        }
      }
    });

    return JSON.stringify(data, null, 2);
  }

  importData(jsonString: string): boolean {
    if (!browser) return false;

    try {
      const data = JSON.parse(jsonString);
      if (data.data) {
        Object.keys(data.data).forEach(key => {
          this.set(key, data.data[key]);
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing data', error);
      return false;
    }
  }
}

export const storage = new LocalStorageManager();
