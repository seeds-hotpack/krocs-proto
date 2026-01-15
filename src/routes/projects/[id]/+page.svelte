<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { activeProjects, projects } from '$lib/stores/projects';
  import { activeTasks } from '$lib/stores/tasks';
  import { activeEvents } from '$lib/stores/events';
  import { formatDuration } from '$lib/utils/helpers';
  import ScheduleModal from '$lib/components/ScheduleModal.svelte';
  import type { Project } from '$lib/types';

  const projectId = $derived($page.params.id);
  const project = $derived($activeProjects.find(item => item.id === projectId));
  const projectTasks = $derived(
    $activeTasks.filter(task => task.projectId === projectId)
  );
  const projectEvents = $derived(
    $activeEvents.filter(event => event.projectId === projectId)
  );
  const totalScheduledMinutes = $derived(
    projectEvents.reduce((sum, event) => {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      return sum + Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
    }, 0)
  );
  const completedTasks = $derived(
    projectTasks.filter(task => task.status === 'completed').length
  );
  const completionRate = $derived(
    projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0
  );
  const totalEstimatedMinutes = $derived(
    projectTasks.reduce((sum, task) => sum + (task.estimatedTime ?? 0), 0)
  );
  const totalActualMinutes = $derived(
    projectTasks.reduce((sum, task) => sum + (task.actualTime ?? 0), 0)
  );

  let formData = $state({
    name: '',
    description: '',
    successCriteria: '',
    priority: 'medium' as Project['priority'],
    weeklyBuffer: 0,
    bufferPolicy: 'warn' as Project['bufferPolicy'],
    startDate: '',
    endDate: ''
  });

  let showSchedule = $state(false);

  $effect(() => {
    if (project) {
      formData = {
        name: project.name,
        description: project.description || '',
        successCriteria: project.successCriteria || '',
        priority: project.priority || 'medium',
        weeklyBuffer: project.weeklyBuffer || 0,
        bufferPolicy: project.bufferPolicy || 'warn',
        startDate: project.startDate || '',
        endDate: project.endDate || ''
      };
    }
  });

  function handleSave() {
    if (!project || !formData.name.trim()) return;

    projects.update(project.id, {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      successCriteria: formData.successCriteria.trim() || undefined,
      priority: formData.priority,
      weeklyBuffer: Number(formData.weeklyBuffer) || 0,
      bufferPolicy: formData.bufferPolicy,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined
    });
  }

  function handleDelete() {
    if (!project) return;
    if ($activeProjects.length <= 1) {
      alert('마지막 프로젝트는 삭제할 수 없습니다. 최소 1개의 프로젝트가 필요합니다.');
      return;
    }
    if (confirm('이 프로젝트를 삭제하시겠습니까? (30일 후 영구 삭제됩니다)')) {
      projects.remove(project.id);
      goto('/projects');
    }
  }

  function formatDateTime(dateValue: string) {
    return new Date(dateValue).toLocaleString('ko-KR');
  }
</script>

<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  {#if !project}
    <div class="bg-white shadow rounded-lg">
      <div class="text-center py-12">
        <span class="text-5xl mb-4 block">🔍</span>
        <p class="text-gray-500 mb-6">프로젝트를 찾을 수 없습니다.</p>
        <a
          href="/projects"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          프로젝트 목록
        </a>
      </div>
    </div>
  {:else}
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">{project.name}</h1>
        <p class="mt-2 text-sm text-gray-600">프로젝트 상세</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          onclick={() => { showSchedule = true; }}
          class="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
        >
          일정 추가
        </button>
        <a
          href="/tasks"
          class="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
        >
          테스크 보기
        </a>
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
          <h2 class="text-lg font-semibold text-gray-900 mb-4">프로젝트 정보</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input
                type="text"
                bind:value={formData.name}
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
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">성공조건</label>
              <textarea
                bind:value={formData.successCriteria}
                rows="2"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="이 프로젝트의 성공 기준"
              ></textarea>
            </div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <label class="block text-sm font-medium text-gray-700 mb-1">버퍼 정책</label>
                <select
                  bind:value={formData.bufferPolicy}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="warn">경고</option>
                  <option value="block">차단</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">주간 버퍼 (분)</label>
                <input
                  type="number"
                  min="0"
                  bind:value={formData.weeklyBuffer}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                <input
                  type="date"
                  bind:value={formData.startDate}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                <input
                  type="date"
                  bind:value={formData.endDate}
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
          <h2 class="text-lg font-semibold text-gray-900 mb-4">테스크 목록</h2>
          {#if projectTasks.length === 0}
            <p class="text-sm text-gray-500">등록된 테스크가 없습니다.</p>
          {:else}
            <div class="space-y-3">
              {#each projectTasks as task}
                <div class="flex items-center justify-between text-sm">
                  <a href={`/tasks/${task.id}`} class="text-blue-600 hover:text-blue-700">
                    {task.title}
                  </a>
                  <span class="text-xs text-gray-500">
                    {task.status === 'completed' ? '완료' : task.status === 'in_progress' ? '진행중' : '대기'}
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="space-y-6">
        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">요약</h2>
          <div class="space-y-2 text-sm text-gray-500">
            <div>테스크: {projectTasks.length}개</div>
            <div>배치 일정: {projectEvents.length}개</div>
            <div>총 배치 시간: {formatDuration(totalScheduledMinutes)}</div>
            <div>예상 시간: {formatDuration(totalEstimatedMinutes)}</div>
            <div>실제 시간: {formatDuration(totalActualMinutes)}</div>
          </div>
          <div class="mt-4">
            <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
              <span>완료율</span>
              <span>{completionRate}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-blue-600 h-2 rounded-full transition-all"
                style="width: {completionRate}%"
              ></div>
            </div>
            <div class="text-xs text-gray-500 mt-2">{completedTasks} / {projectTasks.length} 완료</div>
          </div>
        </div>

        <div class="bg-white shadow rounded-lg p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">메타 정보</h2>
          <div class="space-y-2 text-sm text-gray-500">
            <div>생성: {formatDateTime(project.createdAt)}</div>
            <div>수정: {formatDateTime(project.updatedAt)}</div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

{#if showSchedule && project}
  <ScheduleModal
    projectId={project.id}
    onClose={() => { showSchedule = false; }}
  />
{/if}
