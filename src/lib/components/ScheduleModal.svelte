<script lang="ts">
  import { get } from 'svelte/store';
  import { activeProjects } from '$lib/stores/projects';
  import { activeTasks, tasks } from '$lib/stores/tasks';
  import { activeEvents, events } from '$lib/stores/events';
  import { settings } from '$lib/stores/settings';
  import type { Task } from '$lib/types';
  import { formatDate, getWeekEndDate, getWeekStartDate } from '$lib/utils/helpers';

  type Props = {
    taskId?: string | null;
    projectId?: string | null;
    onClose?: () => void;
    defaultDate?: string;
  };

  let { taskId = null, projectId = null, onClose, defaultDate }: Props = $props();

  const existingTask = $derived(taskId ? $activeTasks.find(item => item.id === taskId) : null);
  const isExistingTask = $derived(!!existingTask);

  const defaultProjectId = projectId || $activeProjects[0]?.id || '';
  let formData = $state({
    projectId: defaultProjectId,
    title: '',
    estimatedTime: 60,
    priority: 'medium' as Task['priority'],
    deadline: defaultDate || '',
    startDate: defaultDate || formatDate(new Date()),
    startTime: '09:00'
  });

  const selectedProject = $derived(
    $activeProjects.find(project => project.id === formData.projectId)
  );

  $effect(() => {
    if (isExistingTask) return;
    if (!formData.projectId && defaultProjectId) {
      formData = { ...formData, projectId: defaultProjectId };
    }
  });

  $effect(() => {
    if (!existingTask) return;
    formData = {
      projectId: existingTask.projectId,
      title: existingTask.title,
      estimatedTime: existingTask.estimatedTime || 60,
      priority: existingTask.priority || 'medium',
      deadline: existingTask.deadline || defaultDate || '',
      startDate: defaultDate || formatDate(new Date()),
      startTime: '09:00'
    };
  });

  function closeModal() {
    onClose?.();
  }

  function handleSubmit() {
    if (!formData.projectId) return;
    if (!isExistingTask && !formData.title.trim()) return;

    const durationMinutes = Math.max(1, Number(formData.estimatedTime) || 0);
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
    if (Number.isNaN(startDateTime.getTime())) {
      alert('시작 날짜와 시간을 확인해주세요.');
      return;
    }

    const weekStart = getWeekStartDate(startDateTime);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = getWeekEndDate(startDateTime);
    weekEnd.setHours(23, 59, 59, 999);
    const scheduledMinutes = $activeEvents.reduce((sum, event) => {
      const eventStart = new Date(event.startTime);
      if (eventStart < weekStart || eventStart > weekEnd) return sum;
      const eventEnd = new Date(event.endTime);
      const diff = Math.max(0, (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60));
      return sum + diff;
    }, 0);

    const availableMinutes = Math.max(
      0,
      $settings.weeklyAvailableTime - $settings.weeklyGlobalBuffer
    );
    const projectedMinutes = scheduledMinutes + durationMinutes;

    if (availableMinutes > 0 && projectedMinutes > availableMinutes) {
      if ($settings.globalBufferPolicy === 'block') {
        alert('버퍼를 초과하여 일정 배치가 차단되었습니다.');
        return;
      }

      const shouldProceed = confirm('버퍼를 초과했습니다. 그래도 배치할까요?');
      if (!shouldProceed) return;
    }

    const effectiveDeadline = formData.deadline || formData.startDate;
    let resolvedTaskId = taskId;

    if (selectedProject?.endDate && effectiveDeadline) {
      if (new Date(effectiveDeadline) > new Date(selectedProject.endDate)) {
        alert('테스크 마감일은 프로젝트 종료일 이후일 수 없습니다.');
        return;
      }
    }

    if (isExistingTask && resolvedTaskId) {
      const updates: Partial<Task> = {
        estimatedTime: durationMinutes,
        priority: formData.priority,
        deadline: effectiveDeadline
      };

      tasks.update(resolvedTaskId, updates);
    } else {
      tasks.add({
        projectId: formData.projectId,
        title: formData.title.trim(),
        estimatedTime: durationMinutes,
        priority: formData.priority,
        deadline: effectiveDeadline,
        status: 'pending'
      });

      const createdTask = get(tasks).filter(item => !item.deletedAt).slice(-1)[0];
      resolvedTaskId = createdTask?.id ?? null;
    }

    if (!resolvedTaskId) {
      alert('테스크를 찾을 수 없습니다.');
      return;
    }

    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
    events.add({
      taskId: resolvedTaskId,
      projectId: formData.projectId,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      isRecurring: false
    });

    closeModal();
  }
</script>

<div class="fixed z-50 inset-0 overflow-y-auto" style="background-color: rgba(0,0,0,0.5);">
  <div class="flex items-center justify-center min-h-screen p-4">
    <div
      class="relative bg-white rounded-lg shadow-xl max-w-lg w-full"
      style="z-index: 51;"
    >
      <form
        onsubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
            일정 추가
          </h3>

          <div class="space-y-4">
            <div>
              <label for="project" class="block text-sm font-medium text-gray-700 mb-1">
                프로젝트 *
              </label>
              <select
                id="project"
                bind:value={formData.projectId}
                required
                disabled={isExistingTask}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">선택하세요</option>
                {#each $activeProjects as project}
                  <option value={project.id}>{project.name}</option>
                {/each}
              </select>
            </div>

          <div>
            <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
              작업 제목 *
            </label>
            <input
              id="title"
              type="text"
              bind:value={formData.title}
              required={!isExistingTask}
              disabled={isExistingTask}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="예: 기획서 작성"
            />
          </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">
                  일정 날짜
                </label>
                <input
                  id="startDate"
                  type="date"
                  bind:value={formData.startDate}
                  max={selectedProject?.endDate}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label for="startTime" class="block text-sm font-medium text-gray-700 mb-1">
                  시작 시간
                </label>
                <input
                  id="startTime"
                  type="time"
                  bind:value={formData.startTime}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label for="estimatedTime" class="block text-sm font-medium text-gray-700 mb-1">
                예상 소요시간 (분)
              </label>
              <input
                id="estimatedTime"
                type="number"
                bind:value={formData.estimatedTime}
                min="1"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label for="priority" class="block text-sm font-medium text-gray-700 mb-1">
                우선순위
              </label>
              <select
                id="priority"
                bind:value={formData.priority}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">낮음</option>
                <option value="medium">보통</option>
                <option value="high">높음</option>
              </select>
            </div>
          </div>
        </div>

        <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <button
            type="submit"
            class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
          >
            배치
          </button>
          <button
            type="button"
            onclick={closeModal}
            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
