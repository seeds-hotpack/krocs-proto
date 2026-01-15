<script lang="ts">
  import { settings } from '$lib/stores/settings';
  import { activeProjects } from '$lib/stores/projects';
  import { activeTasks } from '$lib/stores/tasks';
  import { activeEvents } from '$lib/stores/events';
  import {
    formatDuration,
    getMonthEndDate,
    getMonthStartDate,
    getWeekEndDate,
    getWeekStartDate
  } from '$lib/utils/helpers';

  // 주간 배치 시간
  const weeklyScheduledMinutes = $derived.by(() => {
    const today = new Date();
    const weekStart = getWeekStartDate(today);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = getWeekEndDate(today);
    weekEnd.setHours(23, 59, 59, 999);

    return $activeEvents.reduce((sum, event) => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      const overlapStart = eventStart > weekStart ? eventStart : weekStart;
      const overlapEnd = eventEnd < weekEnd ? eventEnd : weekEnd;
      const diff = overlapEnd.getTime() - overlapStart.getTime();
      if (diff <= 0) return sum;
      return sum + diff / (1000 * 60);
    }, 0);
  });

  function buildProjectAllocations(rangeStart: Date, rangeEnd: Date) {
    const start = new Date(rangeStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(rangeEnd);
    end.setHours(23, 59, 59, 999);

    const activeProjectIds = new Set($activeProjects.map(project => project.id));
    const taskIdsWithEventsInRange = new Set(
      $activeEvents
        .filter(event => {
          const eventStart = new Date(event.startTime);
          const eventEnd = new Date(event.endTime);
          return eventStart <= end && eventEnd >= start;
        })
        .map(event => event.taskId)
    );

    const tasksInRange = $activeTasks.filter(
      task => activeProjectIds.has(task.projectId) && taskIdsWithEventsInRange.has(task.id)
    );
    const totalEstimatedMinutes = tasksInRange.reduce(
      (sum, task) => sum + (task.estimatedTime ?? 0),
      0
    );

    const allocations = $activeProjects.map(project => {
      const projectTasks = tasksInRange.filter(task => task.projectId === project.id);
      const totalMinutes = projectTasks.reduce(
        (sum, task) => sum + (task.estimatedTime ?? 0),
        0
      );
      const rawPercentage =
        totalEstimatedMinutes > 0 ? (totalMinutes / totalEstimatedMinutes) * 100 : 0;

      return {
        project,
        totalMinutes,
        taskCount: projectTasks.length,
        rawPercentage
      };
    });

    if (totalEstimatedMinutes <= 0) {
      return allocations.map(({ rawPercentage, ...allocation }) => ({
        ...allocation,
        percentage: 0
      }));
    }

    const rounded = allocations.map(allocation => Math.round(allocation.rawPercentage));
    const roundedTotal = rounded.reduce((sum, value) => sum + value, 0);
    const diff = 100 - roundedTotal;

    if (diff !== 0 && allocations.length > 0) {
      let maxIndex = 0;
      for (let index = 1; index < allocations.length; index += 1) {
        if (allocations[index].rawPercentage > allocations[maxIndex].rawPercentage) {
          maxIndex = index;
        }
      }
      rounded[maxIndex] = Math.max(0, rounded[maxIndex] + diff);
    }

    return allocations.map((allocation, index) => ({
      project: allocation.project,
      totalMinutes: allocation.totalMinutes,
      taskCount: allocation.taskCount,
      percentage: rounded[index] ?? 0
    }));
  }

  const weeklyProjectAllocations = $derived.by(() => {
    const today = new Date();
    return buildProjectAllocations(getWeekStartDate(today), getWeekEndDate(today));
  });

  const monthlyProjectAllocations = $derived.by(() => {
    const today = new Date();
    return buildProjectAllocations(getMonthStartDate(today), getMonthEndDate(today));
  });

  // 버퍼를 제외한 순수 가용시간
  const netAvailableTime = $derived(
    Math.max(0, $settings.weeklyAvailableTime - $settings.weeklyGlobalBuffer)
  );

  // 주간 남은 가용시간
  const remainingAvailableMinutes = $derived(
    Math.max(0, netAvailableTime - weeklyScheduledMinutes)
  );

  // 버퍼를 사용한 시간 (스케줄이 순수 가용시간을 초과한 양)
  const bufferUsedMinutes = $derived(Math.max(0, weeklyScheduledMinutes - netAvailableTime));

  // 버퍼 소진율
  const bufferUsedPercentage = $derived(
    $settings.weeklyGlobalBuffer > 0
      ? Math.round((bufferUsedMinutes / $settings.weeklyGlobalBuffer) * 100)
      : 0
  );

  const bufferRemainingMinutes = $derived(Math.max(
    0,
    $settings.weeklyGlobalBuffer - bufferUsedMinutes
  ));

  // 완료율
  const completedTasks = $derived($activeTasks.filter(t => t.status === 'completed').length);
  const completionRate = $derived(
    $activeTasks.length > 0 ? Math.round((completedTasks / $activeTasks.length) * 100) : 0
  );

  // 미배치 테스크
  const scheduledTaskIds = $derived(new Set($activeEvents.map(e => e.taskId)));
  const unscheduledTasks = $derived($activeTasks.filter(
    t => !scheduledTaskIds.has(t.id) && t.status === 'pending'
  ));

  const onboardingStepLabels: Record<string, string> = {
    step1: '가용시간',
    step2: '버퍼',
    step3: '프로젝트',
    step4: '첫 일정'
  };

  const skippedOnboardingSteps = $derived(
    Array.from(new Set($settings.skippedOnboardingSteps))
      .map(step => onboardingStepLabels[step] ?? step)
  );

  function getBufferColor(percentage: number): string {
    if (percentage >= 80) return 'text-red-600 bg-red-50';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  }
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900">대시보드</h1>
    <p class="mt-2 text-sm text-gray-600">
      주간 계획 현황을 한눈에 확인하세요
    </p>
  </div>

  {#if skippedOnboardingSteps.length > 0}
    <div class="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm font-medium text-yellow-800">온보딩에서 아직 완료하지 않은 항목이 있어요.</p>
        <p class="text-sm text-yellow-700 mt-1">
          미완료: {skippedOnboardingSteps.join(', ')}
        </p>
      </div>
      <a
        href="/onboarding"
        class="inline-flex items-center justify-center rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
      >
        설정 마치기
      </a>
    </div>
  {/if}

  <!-- Stats Cards -->
  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
    <!-- Available Time -->
    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <span class="text-3xl">⏰</span>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">주간 가용시간</dt>
              <dd class="text-2xl font-semibold text-gray-900">
                {formatDuration(remainingAvailableMinutes)}
              </dd>
              <dd class="text-xs text-gray-500 mt-1">
                기준: {formatDuration(netAvailableTime)} (버퍼 {formatDuration($settings.weeklyGlobalBuffer)})
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <!-- Buffer Usage -->
    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <span class="text-3xl">🛡️</span>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">버퍼 소진율</dt>
              <dd class="text-2xl font-semibold {getBufferColor(bufferUsedPercentage).split(' ')[0]}">
                {bufferUsedPercentage}%
              </dd>
              <dd class="text-xs text-gray-500 mt-1">
                남은 시간: {formatDuration(bufferRemainingMinutes)}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <!-- Completion Rate -->
    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <span class="text-3xl">✅</span>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">완료율</dt>
              <dd class="text-2xl font-semibold text-gray-900">{completionRate}%</dd>
              <dd class="text-xs text-gray-500 mt-1">
                {completedTasks} / {$activeTasks.length} 완료
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>

    <!-- Unscheduled Tasks -->
    <div class="bg-white overflow-hidden shadow rounded-lg">
      <div class="p-5">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <span class="text-3xl">📝</span>
          </div>
          <div class="ml-5 w-0 flex-1">
            <dl>
              <dt class="text-sm font-medium text-gray-500 truncate">미배치 테스크</dt>
              <dd class="text-2xl font-semibold text-gray-900">{unscheduledTasks.length}개</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Project Allocations -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
    <div class="bg-white shadow rounded-lg">
      <div class="px-6 py-5 border-b border-gray-200">
        <h3 class="text-lg leading-6 font-medium text-gray-900">주간 프로젝트별 투입률</h3>
        <p class="text-xs text-gray-500 mt-1">예상 시간 기준</p>
      </div>
      <div class="px-6 py-4">
        {#if weeklyProjectAllocations.length === 0}
          <div class="text-center py-12">
            <span class="text-4xl mb-4 block">📁</span>
            <p class="text-gray-500 mb-4">아직 프로젝트가 없습니다.</p>
            <a
              href="/projects"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              첫 프로젝트 만들기
            </a>
          </div>
        {:else}
          <div class="space-y-4">
            {#each weeklyProjectAllocations as allocation}
              <div class="border-l-4 border-blue-500 pl-4">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <h4 class="text-sm font-medium text-gray-900">{allocation.project.name}</h4>
                    <p class="text-xs text-gray-500 mt-1">
                      {allocation.taskCount}개 테스크 · {formatDuration(allocation.totalMinutes)}
                    </p>
                  </div>
                  <span class="text-lg font-semibold text-gray-900">{allocation.percentage}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-blue-600 h-2 rounded-full transition-all"
                    style="width: {Math.min(allocation.percentage, 100)}%"
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="bg-white shadow rounded-lg">
      <div class="px-6 py-5 border-b border-gray-200">
        <h3 class="text-lg leading-6 font-medium text-gray-900">월간 프로젝트별 투입률</h3>
        <p class="text-xs text-gray-500 mt-1">예상 시간 기준</p>
      </div>
      <div class="px-6 py-4">
        {#if monthlyProjectAllocations.length === 0}
          <div class="text-center py-12">
            <span class="text-4xl mb-4 block">📁</span>
            <p class="text-gray-500 mb-4">아직 프로젝트가 없습니다.</p>
            <a
              href="/projects"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              첫 프로젝트 만들기
            </a>
          </div>
        {:else}
          <div class="space-y-4">
            {#each monthlyProjectAllocations as allocation}
              <div class="border-l-4 border-blue-500 pl-4">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <h4 class="text-sm font-medium text-gray-900">{allocation.project.name}</h4>
                    <p class="text-xs text-gray-500 mt-1">
                      {allocation.taskCount}개 테스크 · {formatDuration(allocation.totalMinutes)}
                    </p>
                  </div>
                  <span class="text-lg font-semibold text-gray-900">{allocation.percentage}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-blue-600 h-2 rounded-full transition-all"
                    style="width: {Math.min(allocation.percentage, 100)}%"
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
    <a
      href="/calendar"
      class="block bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow p-6"
    >
      <div class="flex items-center">
        <span class="text-4xl mr-4">📅</span>
        <div>
          <h3 class="text-lg font-medium text-gray-900">캘린더</h3>
          <p class="text-sm text-gray-500 mt-1">일정 배치 및 관리</p>
        </div>
      </div>
    </a>

    <a
      href="/projects"
      class="block bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow p-6"
    >
      <div class="flex items-center">
        <span class="text-4xl mr-4">📁</span>
        <div>
          <h3 class="text-lg font-medium text-gray-900">프로젝트</h3>
          <p class="text-sm text-gray-500 mt-1">프로젝트 관리</p>
        </div>
      </div>
    </a>

    <a
      href="/timeline"
      class="block bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow p-6"
    >
      <div class="flex items-center">
        <span class="text-4xl mr-4">📈</span>
        <div>
          <h3 class="text-lg font-medium text-gray-900">타임라인</h3>
          <p class="text-sm text-gray-500 mt-1">작업 구조 확인</p>
        </div>
      </div>
    </a>
  </div>
</div>
