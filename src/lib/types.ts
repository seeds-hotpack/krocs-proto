export interface Settings {
  weeklyAvailableTime: number; // 분
  monthlyAvailableTime: number; // 분
  weeklyGlobalBuffer: number; // 분
  monthlyGlobalBuffer: number; // 분
  globalBufferPolicy: 'warn' | 'block';
  notifications: {
    deadlineReminder: { enabled: boolean; time: string };
    bufferWarning: { enabled: boolean; threshold: number };
    unscheduledTask: { enabled: boolean; days: number };
    weeklyReview: { enabled: boolean; day: string; time: string };
  };
  timeUnit: 'minute' | 'hour';
  defaultCalendarView: 'day' | 'week' | 'month';
  onboardingCompleted: boolean;
  skippedOnboardingSteps: string[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  successCriteria?: string;
  startDate?: string;
  endDate?: string;
  priority?: 'low' | 'medium' | 'high';
  weeklyBuffer?: number;
  monthlyBuffer?: number;
  bufferPolicy?: 'warn' | 'block';
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  deadline?: string;
  estimatedTime?: number;
  actualTime?: number;
  status: 'pending' | 'in_progress' | 'completed';
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  taskId: string;
  projectId: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  recurrenceRule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: string;
  };
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PomodoroSession {
  id: string;
  taskId: string;
  startTime: string;
  endTime?: string;
  duration: number;
  completed: boolean;
  createdAt: string;
}

export interface Retrospective {
  id: string;
  period: 'week' | 'month';
  startDate: string;
  endDate: string;
  content: string;
  adjustments: {
    taskId: string;
    oldEstimate: number;
    newEstimate: number;
  }[];
  createdAt: string;
}

export interface Notification {
  id: string;
  type: 'deadline' | 'buffer' | 'unscheduled' | 'weekly_review';
  message: string;
  read: boolean;
  createdAt: string;
}

export interface ChangeHistory {
  id: string;
  entityType: 'project' | 'task' | 'event';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  changes: Record<string, any>;
  createdAt: string;
}

export interface ReplanAlternative {
  id: string;
  triggerEventId: string;
  alternatives: {
    id: string;
    description: string;
    affectedEvents: string[];
    bufferImpact: number;
  }[];
  selectedAlternativeId?: string;
  createdAt: string;
}

export interface Allocation {
  projectId: string;
  period: 'week' | 'month';
  startDate: string;
  totalTime: number;
  percentage: number;
}
