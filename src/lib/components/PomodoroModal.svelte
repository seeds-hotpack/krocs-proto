<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Task } from '$lib/types';
  import { pomodoroSessions } from '$lib/stores/pomodoro';
  import { tasks } from '$lib/stores/tasks';

  type Props = {
    task: Task;
    projectName?: string;
    onClose?: () => void;
  };

  let { task, projectName, onClose }: Props = $props();

  let duration = $state(25);
  let remainingSeconds = $state(duration * 60);
  let isRunning = $state(false);
  let hasStarted = $state(false);
  let startTime: Date | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    if (!hasStarted) {
      remainingSeconds = duration * 60;
    }
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  function startTimer() {
    if (isRunning) return;
    if (!hasStarted) {
      hasStarted = true;
      startTime = new Date();
    }
    isRunning = true;
    intervalId = setInterval(() => {
      remainingSeconds = Math.max(0, remainingSeconds - 1);
      if (remainingSeconds === 0) {
        finishSession(true);
      }
    }, 1000);
  }

  function pauseTimer() {
    if (!isRunning) return;
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function resetTimer() {
    pauseTimer();
    hasStarted = false;
    remainingSeconds = duration * 60;
    startTime = null;
  }

  function finishSession(completed: boolean) {
    pauseTimer();

    const endTime = new Date();
    const elapsedSeconds = duration * 60 - remainingSeconds;
    const elapsedMinutes = Math.max(0, Math.round(elapsedSeconds / 60));
    const sessionMinutes = elapsedMinutes;

    if (startTime && sessionMinutes > 0) {
      pomodoroSessions.add({
        taskId: task.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: sessionMinutes,
        completed
      });
      tasks.updateActualTime(task.id, sessionMinutes);
    }

    hasStarted = false;
    remainingSeconds = duration * 60;
    startTime = null;
  }

  function handleClose() {
    if (isRunning) {
      const shouldClose = confirm('타이머가 실행 중입니다. 종료할까요?');
      if (!shouldClose) return;
      finishSession(false);
    } else if (hasStarted) {
      const shouldClose = confirm('진행 중인 세션을 저장하지 않고 닫을까요?');
      if (!shouldClose) return;
      resetTimer();
    }
    onClose?.();
  }

  function formatRemaining() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
</script>

<div class="fixed z-50 inset-0 overflow-y-auto">
  <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
    <div
      class="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity z-40"
      onclick={handleClose}
    ></div>

    <span class="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

    <div
      class="relative z-50 inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full"
    >
      <div class="bg-white px-6 pt-6 pb-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg leading-6 font-medium text-gray-900">포모도로 타이머</h3>
          <button
            onclick={handleClose}
            class="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div class="mt-4">
          <p class="text-sm text-gray-500">{projectName ?? '프로젝트 없음'}</p>
          <p class="text-base font-semibold text-gray-900">{task.title}</p>
        </div>

        <div class="mt-6 flex flex-col items-center">
          <div class="text-5xl font-bold text-gray-900 tracking-wide">
            {formatRemaining()}
          </div>
          <p class="mt-2 text-sm text-gray-500">목표 {duration}분</p>
        </div>

        <div class="mt-6">
          <label for="duration" class="block text-sm font-medium text-gray-700 mb-2">
            세션 길이 (분)
          </label>
          <div class="flex items-center gap-3">
            <input
              id="duration"
              type="number"
              min="5"
              step="5"
              bind:value={duration}
              disabled={hasStarted}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div class="flex gap-2">
              <button
                onclick={() => { if (!hasStarted) duration = 25; }}
                class="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={hasStarted}
              >
                25
              </button>
              <button
                onclick={() => { if (!hasStarted) duration = 50; }}
                class="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={hasStarted}
              >
                50
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-gray-50 px-6 py-4 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <div class="flex gap-2">
          {#if isRunning}
            <button
              onclick={pauseTimer}
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100"
            >
              일시정지
            </button>
          {:else}
            <button
              onclick={startTimer}
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              {hasStarted ? '재개' : '시작'}
            </button>
          {/if}
          <button
            onclick={resetTimer}
            disabled={!hasStarted}
            class="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
            초기화
          </button>
        </div>
        <button
          onclick={() => finishSession(true)}
          disabled={!hasStarted}
          class="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 disabled:opacity-50"
        >
          완료 기록
        </button>
      </div>
    </div>
  </div>
</div>
