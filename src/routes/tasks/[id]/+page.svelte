<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { activeTasks, tasks } from '$lib/stores/tasks';
  import { activeProjects } from '$lib/stores/projects';
  import { activeEvents, events } from '$lib/stores/events';
  import { pomodoroSessions } from '$lib/stores/pomodoro';
  import PomodoroModal from '$lib/components/PomodoroModal.svelte';
  import ScheduleModal from '$lib/components/ScheduleModal.svelte';
  import { formatDuration } from '$lib/utils/helpers';
  import type { Event, Task } from '$lib/types';

  const taskId = $derived($page.params.id);
  const task = $derived($activeTasks.find(item => item.id === taskId));
  const project = $derived(
    $activeProjects.find(item => item.id === task?.projectId)
  );
  const taskEvents = $derived(
    $activeEvents
      .filter(event => event.taskId === taskId)
      .slice()
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  );
  const scheduledMinutes = $derived(
    taskEvents.reduce((sum, event) => {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      return sum + Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
    }, 0)
  );
  const taskSessions = $derived(
    $pomodoroSessions.filter(session => session.taskId === taskId)
  );
  const totalSessionMinutes = $derived(
    taskSessions.reduce((sum, session) => sum + session.duration, 0)
  );
  const estimatedMinutes = $derived(task?.estimatedTime ?? 0);
  const actualMinutes = $derived(task?.actualTime ?? 0);
  const progressPercentage = $derived(
    estimatedMinutes > 0 ? Math.round((actualMinutes / estimatedMinutes) * 100) : 0
  );

  let formData = $state({
    projectId: '',
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    deadline: '',
    estimatedTime: 0,
    actualTime: 0,
    status: 'pending' as Task['status']
  });

  const selectedProject = $derived(
    $activeProjects.find(item => item.id === formData.projectId)
  );

  let showPomodoro = $state(false);
  let showSchedule = $state(false);
  let showSplitModal = $state(false);
  let showEventEditModal = $state(false);
  let editingEvent = $state<Event | null>(null);
  let splitFormData = $state({
    totalMinutes: 0,
    startDate: '',
    endDate: '',
    dailyStartTime: '09:00',
    sessionsPerDay: 1
  });
  let eventFormData = $state({
    date: '',
    startTime: '09:00',
    endTime: '10:00'
  });

  $effect(() => {
    if (task) {
      formData = {
        projectId: task.projectId,
        title: task.title,
        description: task.description || '',
        priority: task.priority || 'medium',
        deadline: task.deadline || '',
        estimatedTime: task.estimatedTime ?? 0,
        actualTime: task.actualTime ?? 0,
        status: task.status
      };
    }
  });

  function handleSave() {
    if (!task || !formData.title.trim() || !formData.projectId) return;
    if (formData.deadline && selectedProject?.endDate) {
      if (new Date(formData.deadline) > new Date(selectedProject.endDate)) {
        alert('테스크 마감일은 프로젝트 종료일 이후일 수 없습니다.');
        return;
      }
    }

    tasks.update(task.id, {
      projectId: formData.projectId,
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      priority: formData.priority,
      deadline: formData.deadline || undefined,
      estimatedTime: Number(formData.estimatedTime) || 0,
      actualTime: Number(formData.actualTime) || 0,
      status: formData.status
    });
  }

  function handleDelete() {
    if (!task) return;
    if (confirm('이 테스크를 삭제하시겠습니까? (30일 후 영구 삭제됩니다)')) {
      tasks.remove(task.id);
      goto('/tasks');
    }
  }

  function formatDateTime(dateValue: string) {
    return new Date(dateValue).toLocaleString('ko-KR');
  }

  function openSplitModal() {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    splitFormData = {
      totalMinutes: task?.estimatedTime ?? 0,
      startDate: today.toISOString().split('T')[0],
      endDate: nextWeek.toISOString().split('T')[0],
      dailyStartTime: '09:00',
      sessionsPerDay: 1
    };
    showSplitModal = true;
  }

  function closeSplitModal() {
    showSplitModal = false;
  }

  function handleSplitTask() {
    if (!task) return;

    const { totalMinutes, startDate, endDate, dailyStartTime, sessionsPerDay } = splitFormData;

    if (totalMinutes <= 0 || !startDate || !endDate) {
      alert('총 시간과 날짜 범위를 입력해주세요.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      alert('종료일은 시작일보다 이후여야 합니다.');
      return;
    }

    // 날짜 범위 내의 날짜들 계산
    const dates: Date[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    if (dates.length === 0) {
      alert('유효한 날짜 범위가 없습니다.');
      return;
    }

    // 총 시간을 날짜 수와 하루 세션 수로 나눔
    const totalSessions = dates.length * sessionsPerDay;
    const minutesPerSession = Math.floor(totalMinutes / totalSessions);

    if (minutesPerSession < 10) {
      alert('세션당 시간이 너무 짧습니다. (최소 10분)');
      return;
    }

    // 각 날짜마다 세션 생성
    dates.forEach((date, dayIndex) => {
      for (let sessionIndex = 0; sessionIndex < sessionsPerDay; sessionIndex++) {
        const [hours, minutes] = dailyStartTime.split(':').map(Number);
        const startTime = new Date(date);
        startTime.setHours(hours + (sessionIndex * 2), minutes, 0, 0); // 세션간 2시간 간격

        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + minutesPerSession);

        events.add({
          taskId: task.id,
          projectId: task.projectId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          isRecurring: false
        });
      }
    });

    alert(`${totalSessions}개의 일정이 생성되었습니다.`);
    closeSplitModal();
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
</script>

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  {#if !task}
    <div class="bg-white shadow rounded-lg">
      <div class="text-center py-12">
        <span class="text-5xl mb-4 block">🔍</span>
        <p class="text-gray-500 mb-6">테스크를 찾을 수 없습니다.</p>
        <a
          href="/tasks"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          테스크 목록
        </a>
      </div>
    </div>
  {:else}
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">{task.title}</h1>
        <p class="mt-2 text-sm text-gray-600">{project?.name ?? '프로젝트 없음'}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          onclick={openSplitModal}
          class="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100"
        >
          테스크 분할
        </button>
        <button
          onclick={() => { showSchedule = true; }}
          class="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
        >
          일정 추가
        </button>
        <button
          onclick={() => { showPomodoro = true; }}
          class="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
        >
          집중 시작
        </button>
        <button
          onclick={handleDelete}
          class="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
        >
          삭제
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">테스크 정보</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">프로젝트</label>
              <select
                bind:value={formData.projectId}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {#each $activeProjects as proj}
                  <option value={proj.id}>{proj.name}</option>
                {/each}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">제목</label>
              <input
                type="text"
                bind:value={formData.title}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">설명</label>
              <textarea
                bind:value={formData.description}
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              ></textarea>
            </div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">상태</label>
                <select
                  bind:value={formData.status}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="pending">대기</option>
                  <option value="in_progress">진행중</option>
                  <option value="completed">완료</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
                <select
                  bind:value={formData.priority}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">낮음</option>
                  <option value="medium">보통</option>
                  <option value="high">높음</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">마감일</label>
                <input
                  type="date"
                  bind:value={formData.deadline}
                  max={selectedProject?.endDate}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">예상 시간 (분)</label>
                <input
                  type="number"
                  min="0"
                  bind:value={formData.estimatedTime}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">실제 시간 (분)</label>
                <input
                  type="number"
                  min="0"
                  bind:value={formData.actualTime}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              onclick={handleSave}
              class="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              저장
            </button>
          </div>
        </div>

        <div class="bg-white shadow rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">배치된 일정</h2>
            <button
              onclick={() => { showSchedule = true; }}
              class="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              일정 추가
            </button>
          </div>
          {#if taskEvents.length === 0}
            <p class="text-sm text-gray-500">아직 배치된 일정이 없습니다.</p>
          {:else}
            <div class="space-y-3">
              {#each taskEvents as event}
                <div class="flex items-center justify-between text-sm text-gray-700 gap-3">
                  <span>{formatDateTime(event.startTime)} ~ {formatDateTime(event.endTime)}</span>
                  <div class="flex items-center gap-2">
                    <button
                      onclick={() => openEventEditModal(event)}
                      class="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      시간 수정
                    </button>
                    <button
                      onclick={() => events.remove(event.id)}
                      class="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="space-y-6">
        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">통계</h2>
          <div class="space-y-3 text-sm text-gray-600">
            <div class="flex items-center justify-between">
              <span>예상 시간</span>
              <span class="font-medium text-gray-900">{formatDuration(estimatedMinutes)}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>실제 시간</span>
              <span class="font-medium text-gray-900">{formatDuration(actualMinutes)}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-blue-600 h-2 rounded-full transition-all"
                style="width: {Math.min(progressPercentage, 100)}%"
              ></div>
            </div>
            <div class="text-xs text-gray-500">실제/예상 {progressPercentage}%</div>
            <div class="flex items-center justify-between">
              <span>배치 시간</span>
              <span class="font-medium text-gray-900">{formatDuration(scheduledMinutes)}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>포모도로 누적</span>
              <span class="font-medium text-gray-900">{formatDuration(totalSessionMinutes)}</span>
            </div>
          </div>
        </div>

        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">집중 기록</h2>
          <p class="text-sm text-gray-500">누적 {formatDuration(totalSessionMinutes)}</p>
          {#if taskSessions.length === 0}
            <p class="text-sm text-gray-400 mt-3">아직 기록이 없습니다.</p>
          {:else}
            <div class="mt-3 space-y-2">
              {#each taskSessions as session}
                <div class="text-xs text-gray-500">
                  {formatDateTime(session.startTime)} · {session.duration}분
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">메타 정보</h2>
          <div class="space-y-2 text-sm text-gray-500">
            <div>생성: {formatDateTime(task.createdAt)}</div>
            <div>수정: {formatDateTime(task.updatedAt)}</div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

{#if showPomodoro && task}
  <PomodoroModal
    task={task}
    projectName={project?.name}
    onClose={() => { showPomodoro = false; }}
  />
{/if}

{#if showSchedule && task}
  <ScheduleModal
    taskId={task.id}
    projectId={task.projectId}
    onClose={() => { showSchedule = false; }}
  />
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
                <label for="eventDate" class="block text-sm font-medium text-gray-700 mb-1">
                  날짜
                </label>
                <input
                  id="eventDate"
                  type="date"
                  bind:value={eventFormData.date}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label for="eventStartTime" class="block text-sm font-medium text-gray-700 mb-1">
                    시작 시간
                  </label>
                  <input
                    id="eventStartTime"
                    type="time"
                    bind:value={eventFormData.startTime}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label for="eventEndTime" class="block text-sm font-medium text-gray-700 mb-1">
                    종료 시간
                  </label>
                  <input
                    id="eventEndTime"
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

{#if showSplitModal && task}
  <div class="fixed z-50 inset-0 overflow-y-auto" style="background-color: rgba(0,0,0,0.5);">
    <div class="flex items-center justify-center min-h-screen p-4">
      <div class="relative bg-white rounded-lg shadow-xl max-w-lg w-full" style="z-index: 51;">
        <form
          onsubmit={(event) => {
            event.preventDefault();
            handleSplitTask();
          }}
        >
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="flex items-center justify-between">
              <h3 class="text-lg leading-6 font-medium text-gray-900">테스크 분할</h3>
              <button
                type="button"
                onclick={closeSplitModal}
                class="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div class="mt-4 space-y-4">
              <div>
                <label for="totalMinutes" class="block text-sm font-medium text-gray-700 mb-1">
                  총 소요 시간 (분)
                </label>
                <input
                  id="totalMinutes"
                  type="number"
                  min="0"
                  bind:value={splitFormData.totalMinutes}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">
                    시작일
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    bind:value={splitFormData.startDate}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label for="endDate" class="block text-sm font-medium text-gray-700 mb-1">
                    종료일
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    bind:value={splitFormData.endDate}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label for="dailyStartTime" class="block text-sm font-medium text-gray-700 mb-1">
                    시작 시간
                  </label>
                  <input
                    id="dailyStartTime"
                    type="time"
                    bind:value={splitFormData.dailyStartTime}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label for="sessionsPerDay" class="block text-sm font-medium text-gray-700 mb-1">
                    하루 세션 수
                  </label>
                  <input
                    id="sessionsPerDay"
                    type="number"
                    min="1"
                    bind:value={splitFormData.sessionsPerDay}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              일정 생성
            </button>
            <button
              type="button"
              onclick={closeSplitModal}
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
