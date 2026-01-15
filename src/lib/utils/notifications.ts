import { get } from 'svelte/store';
import { notifications } from '$lib/stores/notifications';
import { activeTasks } from '$lib/stores/tasks';
import { activeEvents } from '$lib/stores/events';
import { settings } from '$lib/stores/settings';
import { formatDate } from '$lib/utils/helpers';

const DAY_MS = 24 * 60 * 60 * 1000;

export function syncNotifications(): void {
  const currentNotifications = get(notifications);
  const settingsValue = get(settings);
  const tasks = get(activeTasks);
  const events = get(activeEvents);

  const existingKeys = new Set(
    currentNotifications.map(notification => `${notification.type}:${notification.message}`)
  );

  const addIfNew = (type: 'deadline' | 'buffer' | 'unscheduled' | 'weekly_review', message: string) => {
    const key = `${type}:${message}`;
    if (existingKeys.has(key)) return;
    notifications.add({ type, message });
    existingKeys.add(key);
  };

  if (settingsValue.notifications.bufferWarning.enabled) {
    const availableMinutes = Math.max(
      0,
      settingsValue.weeklyAvailableTime - settingsValue.weeklyGlobalBuffer
    );
    const totalScheduledMinutes = events.reduce((sum, event) => {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      return sum + Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
    }, 0);
    const percentage =
      availableMinutes > 0 ? Math.round((totalScheduledMinutes / availableMinutes) * 100) : 0;

    if (percentage >= settingsValue.notifications.bufferWarning.threshold) {
      addIfNew('buffer', `버퍼 소진율이 ${percentage}%에 도달했어요.`);
    }
  }

  if (settingsValue.notifications.unscheduledTask.enabled) {
    const scheduledTaskIds = new Set(events.map(event => event.taskId));
    const thresholdDays = settingsValue.notifications.unscheduledTask.days;
    const now = Date.now();

    tasks
      .filter(task => task.status === 'pending' && !scheduledTaskIds.has(task.id))
      .forEach(task => {
        const createdAt = new Date(task.createdAt);
        if (Number.isNaN(createdAt.getTime())) return;
        const diffDays = Math.floor((now - createdAt.getTime()) / DAY_MS);
        if (diffDays >= thresholdDays) {
          addIfNew('unscheduled', `미배치 테스크: ${task.title}`);
        }
      });
  }

  if (settingsValue.notifications.deadlineReminder.enabled) {
    const today = new Date();
    const todayKey = formatDate(today);
    const tomorrowKey = formatDate(new Date(today.getTime() + DAY_MS));

    tasks
      .filter(task => task.deadline && task.status !== 'completed')
      .forEach(task => {
        const deadlineKey = formatDate(task.deadline as string);
        if (deadlineKey === todayKey || deadlineKey === tomorrowKey) {
          addIfNew('deadline', `마감 임박: ${task.title} (${deadlineKey})`);
        }
      });
  }

  if (settingsValue.notifications.weeklyReview.enabled) {
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    if (currentDay === settingsValue.notifications.weeklyReview.day) {
      addIfNew('weekly_review', '이번 주 계획을 점검해보세요.');
    }
  }
}
