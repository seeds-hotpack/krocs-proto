<script lang="ts">
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { settings } from '$lib/stores/settings';
  import { projects } from '$lib/stores/projects';
  import { tasks } from '$lib/stores/tasks';
  import { events } from '$lib/stores/events';
  import { formatDate } from '$lib/utils/helpers';

  let currentStep = $state(1);
  let weeklyHours = $state(40);
  let bufferPercentage = $state(20);
  let projectName = $state('');
  let taskTitle = $state('');
  let taskDate = $state(formatDate(new Date()));
  let taskStartTime = $state('09:00');
  let taskDuration = $state(60);

  const totalSteps = 4;

  function nextStep() {
    if (currentStep < totalSteps) {
      currentStep++;
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
    }
  }

  function skip() {
    settings.update(s => ({
      ...s,
      skippedOnboardingSteps: Array.from(
        new Set([...s.skippedOnboardingSteps, `step${currentStep}`])
      )
    }));
    if (currentStep < totalSteps) {
      nextStep();
    } else {
      complete();
    }
  }

  function complete() {
    // 가용시간 설정
    const weeklyMinutes = weeklyHours * 60;
    const weeklyBuffer = Math.round(weeklyMinutes * (bufferPercentage / 100));

    settings.update(s => ({
      ...s,
      weeklyAvailableTime: weeklyMinutes,
      monthlyAvailableTime: weeklyMinutes * 4,
      weeklyGlobalBuffer: weeklyBuffer,
      monthlyGlobalBuffer: weeklyBuffer * 4,
      onboardingCompleted: true
    }));

    const existingProjects = get(projects).filter(p => !p.deletedAt);
    let projectId = existingProjects[0]?.id ?? '';

    if (!projectId) {
      const name = projectName.trim() || '첫 프로젝트';
      projects.add({
        name,
        priority: 'medium'
      });
      const updatedProjects = get(projects).filter(p => !p.deletedAt);
      projectId = updatedProjects[updatedProjects.length - 1]?.id ?? '';
    } else if (projectName.trim()) {
      projects.add({
        name: projectName,
        priority: 'medium'
      });
      const updatedProjects = get(projects).filter(p => !p.deletedAt);
      projectId = updatedProjects[updatedProjects.length - 1]?.id ?? projectId;
    }

    if (taskTitle.trim() && projectId) {
      tasks.add({
        projectId,
        title: taskTitle,
        estimatedTime: taskDuration,
        deadline: taskDate,
        status: 'pending'
      });

      const updatedTasks = get(tasks).filter(t => !t.deletedAt);
      const createdTask = updatedTasks[updatedTasks.length - 1];

      if (createdTask) {
        const startDateTime = new Date(`${taskDate}T${taskStartTime}`);
        const endDateTime = new Date(startDateTime.getTime() + taskDuration * 60 * 1000);

        events.add({
          taskId: createdTask.id,
          projectId,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          isRecurring: false
        });
      }
    }

    goto('/');
  }

  function getStepTitle(step: number): string {
    switch (step) {
      case 1:
        return '가용시간 설정';
      case 2:
        return '버퍼 설정';
      case 3:
        return '첫 프로젝트 생성';
      case 4:
        return '첫 일정 배치';
      default:
        return '';
    }
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
  <div class="max-w-2xl w-full">
    <!-- Progress bar -->
    <div class="mb-8">
      <div class="flex justify-between mb-2">
        {#each Array(totalSteps) as _, i}
          <div
            class="flex-1 mx-1 h-2 rounded-full transition-colors
              {i < currentStep ? 'bg-blue-600' : 'bg-gray-300'}"
          ></div>
        {/each}
      </div>
      <p class="text-center text-sm text-gray-600">
        {currentStep} / {totalSteps} 단계
      </p>
    </div>

    <!-- Card -->
    <div class="bg-white rounded-lg shadow-xl p-8">
      <h2 class="text-3xl font-bold text-gray-900 mb-2">{getStepTitle(currentStep)}</h2>

      {#if currentStep === 1}
        <p class="text-gray-600 mb-6">
          주당 계획 가능한 시간을 입력해주세요. 업무 시간을 제외한 실제로 계획할 수 있는 시간을 입력하세요.
        </p>
        <div class="space-y-4">
          <div>
            <label for="weeklyHours" class="block text-sm font-medium text-gray-700 mb-2">
              주당 가용시간 (시간)
            </label>
            <input
              id="weeklyHours"
              type="number"
              bind:value={weeklyHours}
              min="1"
              max="168"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p class="text-sm text-blue-800">
              💡 <strong>추천:</strong> 주 40시간 근무자는 20-30시간, 학생은 30-40시간 정도가 적당합니다.
            </p>
          </div>
        </div>
      {/if}

      {#if currentStep === 2}
        <p class="text-gray-600 mb-6">
          예상치 못한 일이나 계획 변경을 위한 여유 시간(버퍼)을 설정하세요.
        </p>
        <div class="space-y-4">
          <div>
            <label for="buffer" class="block text-sm font-medium text-gray-700 mb-2">
              버퍼 비율 ({bufferPercentage}%)
            </label>
            <input
              id="buffer"
              type="range"
              bind:value={bufferPercentage}
              min="0"
              max="50"
              step="5"
              class="w-full"
            />
            <div class="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>50%</span>
            </div>
          </div>
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <p class="text-sm text-green-800">
              주 {weeklyHours}시간 중 {Math.round((weeklyHours * bufferPercentage) / 100)}시간이 버퍼로
              예약됩니다.
            </p>
          </div>
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p class="text-sm text-blue-800">
              💡 <strong>추천:</strong> 일반적으로 20%가 적당합니다.
            </p>
          </div>
        </div>
      {/if}

      {#if currentStep === 3}
        <p class="text-gray-600 mb-6">첫 번째 프로젝트를 만들어보세요. 나중에 더 추가할 수 있습니다.</p>
        <div class="space-y-4">
          <div>
            <label for="projectName" class="block text-sm font-medium text-gray-700 mb-2">
              프로젝트 이름 *
            </label>
            <input
              id="projectName"
              type="text"
              bind:value={projectName}
              placeholder="예: 업무, 개인 성장, 사이드 프로젝트"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p class="text-sm text-blue-800">
              💡 <strong>팁:</strong> 프로젝트는 관련된 작업들을 그룹화하는 단위입니다.
            </p>
          </div>
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p class="text-sm text-yellow-800">
              ⚠️ 프로젝트는 필수입니다. 최소 1개의 프로젝트가 있어야 테스크를 관리할 수 있습니다.
            </p>
          </div>
        </div>
      {/if}

      {#if currentStep === 4}
        <p class="text-gray-600 mb-6">
          첫 테스크를 만들고 일정에 배치해보세요. 나중에 추가해도 괜찮습니다.
        </p>
        <div class="space-y-4">
          <div>
            <label for="taskTitle" class="block text-sm font-medium text-gray-700 mb-2">
              첫 테스크 제목
            </label>
            <input
              id="taskTitle"
              type="text"
              bind:value={taskTitle}
              placeholder="예: 기획서 작성"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label for="taskDate" class="block text-sm font-medium text-gray-700 mb-2">
                날짜
              </label>
              <input
                id="taskDate"
                type="date"
                bind:value={taskDate}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label for="taskStart" class="block text-sm font-medium text-gray-700 mb-2">
                시작 시간
              </label>
              <input
                id="taskStart"
                type="time"
                bind:value={taskStartTime}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label for="taskDuration" class="block text-sm font-medium text-gray-700 mb-2">
                소요시간 (분)
              </label>
              <input
                id="taskDuration"
                type="number"
                min="10"
                step="10"
                bind:value={taskDuration}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">🎉 준비 완료!</h3>
            <ul class="space-y-2 text-sm text-gray-700">
              <li>✅ 주당 가용시간: {weeklyHours}시간</li>
              <li>✅ 버퍼: {bufferPercentage}% ({Math.round((weeklyHours * bufferPercentage) / 100)}시간)</li>
              {#if projectName.trim()}
                <li>✅ 첫 프로젝트: {projectName}</li>
              {/if}
              {#if taskTitle.trim()}
                <li>✅ 첫 테스크: {taskTitle} ({taskDate} {taskStartTime})</li>
              {/if}
            </ul>
          </div>
        </div>
      {/if}

      <!-- Navigation -->
      <div class="flex justify-between mt-8">
        <button
          onclick={prevStep}
          disabled={currentStep === 1}
          class="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          이전
        </button>

        <button
          onclick={skip}
          disabled={currentStep === 3}
          class="px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          나중에 하기
        </button>

        {#if currentStep < totalSteps}
          <button
            onclick={nextStep}
            disabled={currentStep === 3 && !projectName.trim()}
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다음
          </button>
        {:else}
          <button
            onclick={complete}
            class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            시작하기
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
