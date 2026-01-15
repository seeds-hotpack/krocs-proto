<script lang="ts">
  import { activeProjects } from '$lib/stores/projects';
  import { activeTasks } from '$lib/stores/tasks';
  import { activeEvents } from '$lib/stores/events';
  import type { Event } from '$lib/types';
  import {
    formatDate,
    formatDuration,
    getPriorityColor,
    getStatusColor
  } from '$lib/utils/helpers';

  let showTimelineTable = $state(true);
  let timelineZoomLevel = $state(0);
  const minZoomLevel = -4;
  const maxZoomLevel = 6;
  let isTimelineDragging = $state(false);
  let dragStartX = $state(0);
  let dragStartScrollLeft = $state(0);
  let dragTarget: HTMLDivElement | null = null;

  function getGanttRange(events: Event[]) {
    if (events.length === 0) return null;
    let rangeStart = new Date(events[0].startTime);
    let rangeEnd = new Date(events[0].endTime);

    events.forEach(event => {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      if (start < rangeStart) rangeStart = start;
      if (end > rangeEnd) rangeEnd = end;
    });

    return { start: rangeStart, end: rangeEnd };
  }

  function getZoomedRange(range: { start: Date; end: Date }, zoomLevel: number) {
    const paddingDays = Math.max(0, Math.min(60, 2 - zoomLevel * 2));
    const start = new Date(range.start);
    start.setDate(start.getDate() - paddingDays);
    const end = new Date(range.end);
    end.setDate(end.getDate() + paddingDays);
    return { start, end };
  }

  function getTimelineWidth(rangeStart: Date, rangeEnd: Date, zoomLevel: number) {
    const totalDuration = rangeEnd.getTime() - rangeStart.getTime();
    if (totalDuration <= 0) return 720;
    const msPerDay = 24 * 60 * 60 * 1000;
    const daySpan = Math.max(1, Math.ceil(totalDuration / msPerDay));
    const dayWidth = Math.max(12, 24 * Math.pow(1.2, zoomLevel));
    return Math.max(720, Math.round(daySpan * dayWidth));
  }

  function formatTickLabel(date: Date) {
    return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  }

  function getTimelineTicks(rangeStart: Date, rangeEnd: Date) {
    const totalDuration = rangeEnd.getTime() - rangeStart.getTime();
    if (totalDuration <= 0) return [];

    const msPerDay = 24 * 60 * 60 * 1000;
    const daySpan = Math.max(1, Math.ceil(totalDuration / msPerDay));
    const useWeekly = daySpan > 14;
    const stepDays = useWeekly ? 7 : 1;

    const startDate = new Date(rangeStart);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(rangeEnd);
    endDate.setHours(0, 0, 0, 0);

    const ticks: Array<{ label: string; position: number; offset: string; date: Date }> = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const position = ((cursor.getTime() - rangeStart.getTime()) / totalDuration) * 100;
      ticks.push({
        label: formatTickLabel(cursor),
        position,
        offset: '-50%',
        date: new Date(cursor)
      });
      cursor.setDate(cursor.getDate() + stepDays);
    }

    if (ticks.length === 0) return [];

    const lastTick = ticks[ticks.length - 1];
    if (lastTick && lastTick.date.getTime() !== endDate.getTime()) {
      ticks.push({
        label: formatTickLabel(endDate),
        position: 100,
        offset: '-100%',
        date: new Date(endDate)
      });
    }

    ticks[0].position = 0;
    ticks[0].offset = '0';
    ticks[ticks.length - 1].position = 100;
    ticks[ticks.length - 1].offset = '-100%';

    return ticks;
  }

  function getGanttBarStyle(event: Event, rangeStart: Date, rangeEnd: Date) {
    const totalDuration = rangeEnd.getTime() - rangeStart.getTime();
    if (totalDuration <= 0) return 'left: 0%; width: 100%;';

    const startTime = new Date(event.startTime).getTime();
    const endTime = new Date(event.endTime).getTime();
    const startOffset = ((startTime - rangeStart.getTime()) / totalDuration) * 100;
    const endOffset = ((endTime - rangeStart.getTime()) / totalDuration) * 100;
    const left = Math.max(0, Math.min(startOffset, 100));
    const width = Math.max(1, Math.min(endOffset - startOffset, 100 - left));

    return `left: ${left}%; width: ${width}%;`;
  }

  function getTaskScheduledMinutes(events: Event[]) {
    return events.reduce((sum, event) => {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      return sum + Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
    }, 0);
  }

  function formatEventRange(event: Event) {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    return `${start.toLocaleString('ko-KR')} ~ ${end.toLocaleString('ko-KR')}`;
  }

  function handleTimelineWheel(event: WheelEvent) {
    event.preventDefault();
    event.stopPropagation();
    const direction = event.deltaY < 0 ? 1 : -1;
    timelineZoomLevel = Math.min(
      maxZoomLevel,
      Math.max(minZoomLevel, timelineZoomLevel + direction)
    );
  }

  function handleTimelineDragStart(event: MouseEvent) {
    if (event.button !== 0) return;
    const target = event.currentTarget as HTMLDivElement | null;
    if (!target) return;
    event.preventDefault();
    isTimelineDragging = true;
    dragTarget = target;
    dragStartX = event.clientX;
    dragStartScrollLeft = target.scrollLeft;
  }

  function handleTimelineDragMove(event: MouseEvent) {
    if (!isTimelineDragging || !dragTarget) return;
    event.preventDefault();
    const delta = event.clientX - dragStartX;
    dragTarget.scrollLeft = dragStartScrollLeft - delta;
  }

  function handleTimelineDragEnd() {
    isTimelineDragging = false;
    dragTarget = null;
  }
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900">타임라인 / WBS</h1>
    <p class="mt-2 text-sm text-gray-600">프로젝트별 작업 구조를 확인하세요</p>
  </div>

  {#if $activeProjects.length === 0}
    <div class="bg-white shadow rounded-lg">
      <div class="text-center py-12">
        <span class="text-6xl mb-4 block">📈</span>
        <h3 class="text-lg font-medium text-gray-900 mb-2">프로젝트가 없습니다</h3>
        <p class="text-gray-500 mb-6">프로젝트를 먼저 생성해주세요.</p>
        <a
          href="/projects"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          프로젝트 만들기
        </a>
      </div>
    </div>
  {:else}
    <div class="space-y-6">
      {#each $activeProjects as project}
        {@const projectTasks = $activeTasks.filter(t => t.projectId === project.id)}
        {@const projectEvents = $activeEvents.filter(e => e.projectId === project.id)}
        {@const scheduledTaskIds = new Set(projectEvents.map(e => e.taskId))}
        {@const scheduledTasks = projectTasks.filter(task => scheduledTaskIds.has(task.id))}
        {@const unscheduledTasks = projectTasks.filter(task => !scheduledTaskIds.has(task.id))}
        {@const ganttRange = getGanttRange(projectEvents)}
        {@const zoomedRange = ganttRange ? getZoomedRange(ganttRange, timelineZoomLevel) : null}
        {@const ganttTicks = zoomedRange ? getTimelineTicks(zoomedRange.start, zoomedRange.end) : []}
        {@const timelineWidth = zoomedRange ? getTimelineWidth(zoomedRange.start, zoomedRange.end, timelineZoomLevel) : 720}
        {@const pendingTasks = projectTasks.filter(task => task.status === 'pending')}
        {@const inProgressTasks = projectTasks.filter(task => task.status === 'in_progress')}
        {@const completedTasks = projectTasks.filter(task => task.status === 'completed')}
        <div class="bg-white shadow rounded-lg overflow-hidden">
          <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 class="text-lg font-medium text-gray-900">{project.name}</h3>
            {#if project.description}
              <p class="text-sm text-gray-500 mt-1">{project.description}</p>
            {/if}
          </div>
          <div class="px-6 py-6 space-y-10">
            <div>
              <div class="flex items-start justify-between">
                <div>
                  <h4 class="text-base font-semibold text-gray-900">타임라인</h4>
                  <p class="text-xs text-gray-500 mt-1">배치된 일정 기준</p>
                </div>
                <div class="flex items-center gap-3">
                  {#if zoomedRange}
                    <div class="text-xs text-gray-500">
                      {formatDate(zoomedRange.start)} ~ {formatDate(zoomedRange.end)}
                    </div>
                  {/if}
                  <button
                    class="text-xs font-medium text-gray-600 hover:text-gray-800"
                    onclick={() => { showTimelineTable = !showTimelineTable; }}
                  >
                    {showTimelineTable ? '테이블 숨기기' : '테이블 보기'}
                  </button>
                </div>
              </div>
              {#if projectEvents.length === 0}
                <p class="text-sm text-gray-500 mt-4">배치된 일정이 없습니다.</p>
              {:else}
                <div class="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                  <div class="grid grid-cols-[260px_1fr]">
                    <div class="bg-gray-50 border-r border-gray-200" class:hidden={!showTimelineTable}>
                      <div class="h-10 px-4 flex items-center text-xs font-semibold text-gray-500 border-b border-gray-200">
                        테스크
                      </div>
                      {#each scheduledTasks as task}
                        {@const taskEvents = projectEvents.filter(event => event.taskId === task.id)}
                        {@const taskMinutes = getTaskScheduledMinutes(taskEvents)}
                        <div class="h-12 px-4 flex flex-col justify-center border-b border-gray-200">
                          <span class="text-sm font-medium text-gray-900 truncate">{task.title}</span>
                          <span class="text-[11px] text-gray-500">
                            {taskEvents.length}개 일정 · {formatDuration(taskMinutes)}
                          </span>
                        </div>
                      {/each}
                    </div>
                    <div
                      class="overflow-x-auto select-none"
                      class:cursor-grab={!isTimelineDragging}
                      class:cursor-grabbing={isTimelineDragging}
                      class:col-span-2={!showTimelineTable}
                      onwheel={handleTimelineWheel}
                      onmousedown={handleTimelineDragStart}
                      onmousemove={handleTimelineDragMove}
                      onmouseup={handleTimelineDragEnd}
                      onmouseleave={handleTimelineDragEnd}
                    >
                      <div class="min-w-[720px]" style={`min-width: ${timelineWidth}px;`}>
                        <div class="relative h-10 border-b border-gray-200">
                          {#each ganttTicks as tick}
                            <div
                              class="absolute top-0 h-full border-l border-gray-200"
                              style={`left: ${tick.position}%;`}
                            >
                              <span
                                class="absolute top-1 text-[10px] text-gray-500 whitespace-nowrap"
                                style={`transform: translateX(${tick.offset});`}
                              >
                                {tick.label}
                              </span>
                            </div>
                          {/each}
                        </div>
                        {#each scheduledTasks as task}
                          {@const taskEvents = projectEvents.filter(event => event.taskId === task.id)}
                          <div class="relative h-12 border-b border-gray-100">
                            {#each ganttTicks as tick}
                              <div
                                class="absolute top-0 h-full border-l border-gray-100"
                                style={`left: ${tick.position}%;`}
                              ></div>
                            {/each}
                            {#each taskEvents as event}
                              <span
                                class="absolute top-3 h-6 rounded-md bg-blue-500/80"
                                style={zoomedRange ? getGanttBarStyle(event, zoomedRange.start, zoomedRange.end) : ''}
                                title={formatEventRange(event)}
                              ></span>
                            {/each}
                          </div>
                        {/each}
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
              {#if unscheduledTasks.length > 0}
                <div class="mt-6">
                  <h5 class="text-sm font-medium text-gray-900">미배치 테스크</h5>
                  <div class="mt-2 flex flex-wrap gap-2">
                    {#each unscheduledTasks as task}
                      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                        {task.title}
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>

            <div>
              <div class="flex items-center justify-between">
                <h4 class="text-base font-semibold text-gray-900">칸반 보드</h4>
                <span class="text-xs text-gray-500">{projectTasks.length}개 테스크</span>
              </div>
              <div class="mt-4 grid gap-4 xl:grid-cols-3">
                <div class="bg-gray-50 rounded-lg p-4">
                  <div class="flex items-center justify-between">
                    <h5 class="text-sm font-semibold text-gray-700">대기</h5>
                    <span class="text-xs text-gray-500">{pendingTasks.length}</span>
                  </div>
                  {#if pendingTasks.length === 0}
                    <p class="text-xs text-gray-400 mt-3">대기중인 테스크가 없습니다.</p>
                  {:else}
                    <div class="mt-3 space-y-2">
                      {#each pendingTasks as task}
                        {@const taskEvents = projectEvents.filter(event => event.taskId === task.id)}
                        {@const taskMinutes = getTaskScheduledMinutes(taskEvents)}
                        <div class="bg-white border border-gray-200 rounded-md p-3">
                          <div class="flex items-start justify-between gap-2">
                            <span class="text-sm font-medium text-gray-900">{task.title}</span>
                            {#if task.priority}
                              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium {getPriorityColor(task.priority)}">
                                {task.priority === 'high' ? '높음' : task.priority === 'medium' ? '보통' : '낮음'}
                              </span>
                            {/if}
                          </div>
                          <p class="text-xs text-gray-500 mt-2">
                            {taskEvents.length > 0
                              ? `${taskEvents.length}개 일정 · ${formatDuration(taskMinutes)}`
                              : '일정 없음'}
                          </p>
                          {#if task.deadline}
                            <p class="text-xs text-gray-400 mt-1">마감: {task.deadline}</p>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>

                <div class="bg-gray-50 rounded-lg p-4">
                  <div class="flex items-center justify-between">
                    <h5 class="text-sm font-semibold text-gray-700">진행중</h5>
                    <span class="text-xs text-gray-500">{inProgressTasks.length}</span>
                  </div>
                  {#if inProgressTasks.length === 0}
                    <p class="text-xs text-gray-400 mt-3">진행중인 테스크가 없습니다.</p>
                  {:else}
                    <div class="mt-3 space-y-2">
                      {#each inProgressTasks as task}
                        {@const taskEvents = projectEvents.filter(event => event.taskId === task.id)}
                        {@const taskMinutes = getTaskScheduledMinutes(taskEvents)}
                        <div class="bg-white border border-gray-200 rounded-md p-3">
                          <div class="flex items-start justify-between gap-2">
                            <span class="text-sm font-medium text-gray-900">{task.title}</span>
                            {#if task.priority}
                              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium {getPriorityColor(task.priority)}">
                                {task.priority === 'high' ? '높음' : task.priority === 'medium' ? '보통' : '낮음'}
                              </span>
                            {/if}
                          </div>
                          <p class="text-xs text-gray-500 mt-2">
                            {taskEvents.length > 0
                              ? `${taskEvents.length}개 일정 · ${formatDuration(taskMinutes)}`
                              : '일정 없음'}
                          </p>
                          {#if task.deadline}
                            <p class="text-xs text-gray-400 mt-1">마감: {task.deadline}</p>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>

                <div class="bg-gray-50 rounded-lg p-4">
                  <div class="flex items-center justify-between">
                    <h5 class="text-sm font-semibold text-gray-700">완료</h5>
                    <span class="text-xs text-gray-500">{completedTasks.length}</span>
                  </div>
                  {#if completedTasks.length === 0}
                    <p class="text-xs text-gray-400 mt-3">완료된 테스크가 없습니다.</p>
                  {:else}
                    <div class="mt-3 space-y-2">
                      {#each completedTasks as task}
                        {@const taskEvents = projectEvents.filter(event => event.taskId === task.id)}
                        {@const taskMinutes = getTaskScheduledMinutes(taskEvents)}
                        <div class="bg-white border border-gray-200 rounded-md p-3">
                          <div class="flex items-start justify-between gap-2">
                            <span class="text-sm font-medium text-gray-900">{task.title}</span>
                            {#if task.priority}
                              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium {getPriorityColor(task.priority)}">
                                {task.priority === 'high' ? '높음' : task.priority === 'medium' ? '보통' : '낮음'}
                              </span>
                            {/if}
                          </div>
                          <p class="text-xs text-gray-500 mt-2">
                            {taskEvents.length > 0
                              ? `${taskEvents.length}개 일정 · ${formatDuration(taskMinutes)}`
                              : '일정 없음'}
                          </p>
                          {#if task.deadline}
                            <p class="text-xs text-gray-400 mt-1">마감: {task.deadline}</p>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
