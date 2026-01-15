<script lang="ts">
  import { page } from '$app/stores';
  import { activeProjects } from '$lib/stores/projects';
  import { activeTasks, tasks } from '$lib/stores/tasks';
  import { activeEvents, events } from '$lib/stores/events';
  import { get } from 'svelte/store';
  import type { Event, Task } from '$lib/types';
  import { settings } from '$lib/stores/settings';
  import PomodoroModal from '$lib/components/PomodoroModal.svelte';
  import {
    addDays,
    formatDate,
    getMonthEndDate,
    getMonthStartDate,
    getWeekEndDate,
    getWeekStartDate
  } from '$lib/utils/helpers';

  let selectedDate = $state(formatDate(new Date()));
  let calendarView = $state<'day' | 'week' | 'month'>($settings.defaultCalendarView ?? 'day');
  let showTaskModal = $state(false);
  let showEventEditModal = $state(false);
  let schedulingTaskId = $state<string | null>(null);
  let editingEvent = $state<Event | null>(null);
  let pomodoroTask = $state<Task | null>(null);
  let pomodoroProjectName = $state('');
  let handledQuery = $state(false);
  let lastQuery = $state('');
  let eventFormData = $state({
    date: selectedDate,
    startTime: '09:00',
    endTime: '10:00'
  });
  let formData = $state({
    projectId: '',
    title: '',
    estimatedTime: 60,
    priority: 'medium' as 'low' | 'medium' | 'high',
    deadline: '',
    startDate: selectedDate,
    startTime: '09:00'
  });

  const selectedProject = $derived(
    $activeProjects.find(project => project.id === formData.projectId)
  );

  const eventsOnSelectedDate = $derived(
    $activeEvents.filter(e => {
      const eventDate = formatDate(new Date(e.startTime));
      return eventDate === selectedDate;
    })
  );

  const eventsByDate = $derived.by(() => {
    const map = new Map<string, typeof $activeEvents>();
    $activeEvents.forEach(event => {
      const key = formatDate(new Date(event.startTime));
      const list = map.get(key) ?? [];
      map.set(key, [...list, event]);
    });
    return map;
  });

  const weekDates = $derived.by(() => {
    const start = getWeekStartDate(new Date(selectedDate));
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  });

  const weekItems = $derived.by(() =>
    weekDates.map(date => ({
      date,
      key: formatDate(date),
      events: eventsByDate.get(formatDate(date)) ?? []
    }))
  );

  const monthCells = $derived.by(() => {
    const current = new Date(selectedDate);
    const monthStart = getMonthStartDate(current);
    const monthEnd = getMonthEndDate(current);
    const startIndex = (monthStart.getDay() + 6) % 7;
    const totalDays = monthEnd.getDate();

    const cells: Array<Date | null> = [];
    for (let i = 0; i < startIndex; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= totalDays; day++) {
      cells.push(new Date(current.getFullYear(), current.getMonth(), day));
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  });

  const unscheduledTasks = $derived(
    $activeTasks.filter(
      t => !$activeEvents.some(e => e.taskId === t.id) && t.status === 'pending'
    )
  );

  function openTaskModal(taskId?: string, presetProjectId?: string) {
    schedulingTaskId = taskId ?? null;
    const existingTask = taskId ? $activeTasks.find(t => t.id === taskId) : null;
    formData = {
      projectId: existingTask?.projectId || presetProjectId || $activeProjects[0]?.id || '',
      title: existingTask?.title || '',
      estimatedTime: existingTask?.estimatedTime || 60,
      priority: existingTask?.priority || 'medium',
      deadline: existingTask?.deadline || selectedDate,
      startDate: selectedDate,
      startTime: '09:00'
    };
    showTaskModal = true;
  }

  function closeTaskModal() {
    showTaskModal = false;
    schedulingTaskId = null;
  }

  function openPomodoro(task: Task, projectName: string) {
    pomodoroTask = task;
    pomodoroProjectName = projectName;
  }

  function closePomodoro() {
    pomodoroTask = null;
    pomodoroProjectName = '';
  }

  function handleSubmit() {
    if (!formData.projectId) return;
    if (!schedulingTaskId && !formData.title.trim()) return;

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
    if (selectedProject?.endDate && effectiveDeadline) {
      if (new Date(effectiveDeadline) > new Date(selectedProject.endDate)) {
        alert('테스크 마감일은 프로젝트 종료일 이후일 수 없습니다.');
        return;
      }
    }
    let taskId = schedulingTaskId;
    if (taskId) {
      const taskUpdates: Partial<Task> = {
        estimatedTime: durationMinutes,
        priority: formData.priority,
        deadline: effectiveDeadline
      };

      if (formData.title.trim()) {
        taskUpdates.title = formData.title;
      }

      tasks.update(taskId, taskUpdates);
    } else {
      tasks.add({
        projectId: formData.projectId,
        title: formData.title,
        estimatedTime: durationMinutes,
        priority: formData.priority,
        deadline: effectiveDeadline,
        status: 'pending'
      });

      const createdTask = get(tasks).filter(t => !t.deletedAt).slice(-1)[0];
      taskId = createdTask?.id ?? null;
    }

    if (!taskId) {
      alert('테스크를 찾을 수 없습니다.');
      return;
    }

    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);
    events.add({
      taskId,
      projectId: formData.projectId,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      isRecurring: false
    });

    closeTaskModal();
  }

  function formatLocalDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatLocalTime(date: Date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  function openEventEditModal(event: Event) {
    editingEvent = event;
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    eventFormData = {
      date: formatLocalDate(start),
      startTime: formatLocalTime(start),
      endTime: formatLocalTime(end)
    };
    showEventEditModal = true;
  }

  function closeEventEditModal() {
    showEventEditModal = false;
    editingEvent = null;
  }

  function handleUpdateEvent() {
    if (!editingEvent) return;
    const { date, startTime, endTime } = eventFormData;

    if (!date || !startTime || !endTime) {
      alert('날짜와 시간을 입력해주세요.');
      return;
    }

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      alert('시간 형식을 확인해주세요.');
      return;
    }

    if (end <= start) {
      alert('종료 시간은 시작 시간 이후여야 합니다.');
      return;
    }

    events.update(editingEvent.id, {
      startTime: start.toISOString(),
      endTime: end.toISOString()
    });
    closeEventEditModal();
  }

  function changeDate(days: number) {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    selectedDate = formatDate(current);
  }

  function changePeriod(direction: number) {
    const current = new Date(selectedDate);
    if (calendarView === 'week') {
      current.setDate(current.getDate() + direction * 7);
    } else if (calendarView === 'month') {
      current.setMonth(current.getMonth() + direction);
    } else {
      current.setDate(current.getDate() + direction);
    }
    selectedDate = formatDate(current);
  }

  function setView(view: 'day' | 'week' | 'month') {
    calendarView = view;
    settings.update(s => ({
      ...s,
      defaultCalendarView: view
    }));
  }

  function formatHeaderLabel() {
    if (calendarView === 'week') {
      const start = weekDates[0];
      const end = weekDates[6];
      return `${formatDate(start)} ~ ${formatDate(end)}`;
    }
    if (calendarView === 'month') {
      const current = new Date(selectedDate);
      return `${current.getFullYear()}년 ${current.getMonth() + 1}월`;
    }
    return selectedDate;
  }

  const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일'];

  function getWeekdayLabel(date: Date) {
    const index = date.getDay() === 0 ? 6 : date.getDay() - 1;
    return weekdayLabels[index];
  }

  $effect(() => {
    if (lastQuery !== $page.url.search) {
      lastQuery = $page.url.search;
      handledQuery = false;
    }
  });

  $effect(() => {
    if (handledQuery) return;
    const taskId = $page.url.searchParams.get('taskId');
    const projectId = $page.url.searchParams.get('projectId');
    if (taskId || projectId) {
      openTaskModal(taskId ?? undefined, projectId ?? undefined);
      handledQuery = true;
    }
  });
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900">캘린더</h1>
    <p class="mt-2 text-sm text-gray-600">일정을 배치하고 관리하세요</p>
  </div>

  <!-- Date Navigator -->
  <div class="bg-white shadow rounded-lg mb-6 p-4">
    <div class="flex items-center justify-between">
      <button
        onclick={() => changePeriod(-1)}
        class="p-2 rounded-md hover:bg-gray-100"
      >
        ←
      </button>
      <div class="text-center">
        <h2 class="text-xl font-semibold">{formatHeaderLabel()}</h2>
        {#if calendarView === 'day'}
          <p class="text-sm text-gray-500">
            {new Date(selectedDate).toLocaleDateString('ko-KR', { weekday: 'long' })}
          </p>
        {/if}
      </div>
      <button
        onclick={() => changePeriod(1)}
        class="p-2 rounded-md hover:bg-gray-100"
      >
        →
      </button>
    </div>
    <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <button
        onclick={() => (selectedDate = formatDate(new Date()))}
        class="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md"
      >
        오늘
      </button>
      <div class="inline-flex rounded-md shadow-sm">
        <button
          onclick={() => setView('day')}
          class="px-3 py-2 text-sm font-medium border border-gray-200 rounded-l-md
            {calendarView === 'day' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}"
        >
          일
        </button>
        <button
          onclick={() => setView('week')}
          class="px-3 py-2 text-sm font-medium border-t border-b border-gray-200
            {calendarView === 'week' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}"
        >
          주
        </button>
        <button
          onclick={() => setView('month')}
          class="px-3 py-2 text-sm font-medium border border-gray-200 rounded-r-md
            {calendarView === 'month' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}"
        >
          월
        </button>
      </div>
    </div>
  </div>

  <!-- Events List -->
  {#if calendarView === 'day'}
    <div class="bg-white shadow rounded-lg mb-6">
      <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 class="text-lg font-medium text-gray-900">일정</h3>
        <button
          onclick={openTaskModal}
          class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
        >
          ➕ 테스크 추가
        </button>
      </div>
      <div class="px-6 py-4">
        {#if eventsOnSelectedDate.length === 0}
          <div class="text-center py-12">
            <span class="text-4xl mb-4 block">📅</span>
            <p class="text-gray-500 mb-4">이 날짜에 배치된 일정이 없습니다.</p>
            <button
              onclick={openTaskModal}
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              테스크 추가하기
            </button>
          </div>
        {:else}
          <div class="space-y-3">
            {#each eventsOnSelectedDate as event}
              {@const task = $activeTasks.find(t => t.id === event.taskId)}
              {@const project = $activeProjects.find(p => p.id === event.projectId)}
              {#if task && project}
                <div class="border-l-4 border-blue-500 pl-4 py-2 hover:bg-gray-50">
                  <div class="flex justify-between items-start gap-4">
                    <div>
                      <h4 class="text-sm font-medium text-gray-900">{task.title}</h4>
                      <p class="text-xs text-gray-500 mt-1">
                        {project.name} · {new Date(event.startTime).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })} - {new Date(event.endTime).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <span
                        class="inline-flex items-center px-2 py-1 rounded text-xs font-medium
                          {task.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : task.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'}"
                      >
                        {task.status === 'completed' ? '완료' : task.status === 'in_progress' ? '진행중' : '대기'}
                      </span>
                      <button
                        onclick={() => openEventEditModal(event)}
                        class="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        시간 수정
                      </button>
                      <button
                        onclick={() => events.remove(event.id)}
                        class="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        삭제
                      </button>
                      <button
                        onclick={() => openPomodoro(task, project.name)}
                        class="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
                      >
                        집중
                      </button>
                    </div>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {:else if calendarView === 'week'}
    <div class="bg-white shadow rounded-lg mb-6">
      <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 class="text-lg font-medium text-gray-900">주간 일정</h3>
        <button
          onclick={openTaskModal}
          class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
        >
          ➕ 테스크 추가
        </button>
      </div>
      <div class="divide-y divide-gray-200">
        {#each weekItems as item}
          <div class="px-6 py-4">
            <div class="flex items-center justify-between">
              <button
                onclick={() => { selectedDate = item.key; setView('day'); }}
                class="text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                {item.key} ({getWeekdayLabel(item.date)})
              </button>
              <span class="text-xs text-gray-500">{item.events.length}개 일정</span>
            </div>
            {#if item.events.length === 0}
              <p class="text-xs text-gray-400 mt-2">일정 없음</p>
            {:else}
              <div class="mt-3 space-y-2">
                {#each item.events as event}
                  {@const task = $activeTasks.find(t => t.id === event.taskId)}
                  {@const project = $activeProjects.find(p => p.id === event.projectId)}
                  {#if task && project}
                    <div class="flex items-center justify-between text-sm gap-3">
                      <span class="text-gray-900">{task.title}</span>
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-500">
                          {new Date(event.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onclick={() => openEventEditModal(event)}
                          class="text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          수정
                        </button>
                        <button
                          onclick={() => events.remove(event.id)}
                          class="text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="bg-white shadow rounded-lg mb-6">
      <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <h3 class="text-lg font-medium text-gray-900">월간 일정</h3>
        <button
          onclick={openTaskModal}
          class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
        >
          ➕ 테스크 추가
        </button>
      </div>
      <div class="grid grid-cols-7 gap-px bg-gray-200 text-xs">
        {#each weekdayLabels as label}
          <div class="bg-gray-50 text-gray-500 px-2 py-2 text-center font-medium">
            {label}
          </div>
        {/each}
        {#each monthCells as date}
          <div class="bg-white min-h-[90px] px-2 py-2">
            {#if date}
              {@const dateKey = formatDate(date)}
              {@const dayEvents = eventsByDate.get(dateKey) ?? []}
              <button
                onclick={() => { selectedDate = dateKey; setView('day'); }}
                class="text-xs font-semibold text-gray-700 hover:text-blue-600"
              >
                {date.getDate()}
              </button>
              {#if dayEvents.length > 0}
                <div class="mt-1 text-[10px] text-blue-600">{dayEvents.length}개 일정</div>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Unscheduled Tasks -->
  <div class="bg-white shadow rounded-lg">
    <div class="px-6 py-4 border-b border-gray-200">
      <h3 class="text-lg font-medium text-gray-900">미배치 테스크</h3>
    </div>
    <div class="px-6 py-4">
      {#if unscheduledTasks.length === 0}
        <p class="text-center text-gray-500 py-8">모든 테스크가 배치되었습니다! 🎉</p>
      {:else}
        <div class="space-y-2">
          {#each unscheduledTasks as task}
            {@const project = $activeProjects.find(p => p.id === task.projectId)}
            {#if project}
              <div class="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                <div>
                  <h4 class="text-sm font-medium text-gray-900">{task.title}</h4>
                  <p class="text-xs text-gray-500">{project.name}</p>
                </div>
                <button
                  onclick={() => openTaskModal(task.id)}
                  class="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded"
                >
                  배치하기
                </button>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

{#if pomodoroTask}
  <PomodoroModal task={pomodoroTask} projectName={pomodoroProjectName} onClose={closePomodoro} />
{/if}

{#if showEventEditModal && editingEvent}
  <div class="fixed z-50 inset-0 overflow-y-auto" style="background-color: rgba(0,0,0,0.5);">
    <div class="flex items-center justify-center min-h-screen p-4">
      <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full" style="z-index: 51;">
        <form
          onsubmit={(event) => {
            event.preventDefault();
            handleUpdateEvent();
          }}
        >
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="flex items-center justify-between">
              <h3 class="text-lg leading-6 font-medium text-gray-900">일정 시간 수정</h3>
              <button
                type="button"
                onclick={closeEventEditModal}
                class="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div class="mt-4 space-y-4">
              <div>
                <label for="calendarEventDate" class="block text-sm font-medium text-gray-700 mb-1">
                  날짜
                </label>
                <input
                  id="calendarEventDate"
                  type="date"
                  bind:value={eventFormData.date}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label for="calendarEventStartTime" class="block text-sm font-medium text-gray-700 mb-1">
                    시작 시간
                  </label>
                  <input
                    id="calendarEventStartTime"
                    type="time"
                    bind:value={eventFormData.startTime}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label for="calendarEventEndTime" class="block text-sm font-medium text-gray-700 mb-1">
                    종료 시간
                  </label>
                  <input
                    id="calendarEventEndTime"
                    type="time"
                    bind:value={eventFormData.endTime}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              저장
            </button>
            <button
              type="button"
              onclick={closeEventEditModal}
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Task Creation Modal -->
{#if showTaskModal}
  <div class="fixed z-50 inset-0 overflow-y-auto">
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <div
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-40"
        onclick={closeTaskModal}
      ></div>

      <span class="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

      <div
        class="relative z-50 inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
      >
        <form
          onsubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
              {schedulingTaskId ? '테스크 배치' : '새 테스크 추가'}
            </h3>

            {#if schedulingTaskId}
              <p class="text-sm text-gray-500 mb-4">선택된 테스크를 캘린더에 배치합니다.</p>
            {/if}

            <div class="space-y-4">
              <div>
                <label for="project" class="block text-sm font-medium text-gray-700 mb-1">
                  프로젝트 *
                </label>
                <select
                  id="project"
                  bind:value={formData.projectId}
                  required
                  disabled={!!schedulingTaskId}
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
                  required
                  disabled={!!schedulingTaskId}
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
              {schedulingTaskId ? '배치' : '생성'}
            </button>
            <button
              type="button"
              onclick={closeTaskModal}
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}
