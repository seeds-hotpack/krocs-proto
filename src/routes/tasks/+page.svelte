<script lang="ts">
  import { activeTasks, tasks } from '$lib/stores/tasks';
  import { activeProjects } from '$lib/stores/projects';
  import { formatDuration } from '$lib/utils/helpers';
  import PomodoroModal from '$lib/components/PomodoroModal.svelte';
  import type { Task } from '$lib/types';

  let showModal = $state(false);
  let editingTaskId = $state<string | null>(null);
  let pomodoroTask = $state<(Task & { projectName: string }) | null>(null);
  let formData = $state({
    projectId: '',
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    deadline: '',
    estimatedTime: 60,
    actualTime: 0,
    status: 'pending' as Task['status']
  });

  const tasksWithProject = $derived(
    $activeTasks.map(task => ({
      ...task,
      projectName: $activeProjects.find(project => project.id === task.projectId)?.name ?? '삭제된 프로젝트'
    }))
  );

  const selectedProject = $derived(
    $activeProjects.find(project => project.id === formData.projectId)
  );

  function isDeadlineAfterProjectEndDate(deadline: string, projectId: string) {
    if (!deadline) return false;
    const project = $activeProjects.find(item => item.id === projectId);
    if (!project?.endDate) return false;
    return new Date(deadline) > new Date(project.endDate);
  }

  function openCreateModal() {
    editingTaskId = null;
    formData = {
      projectId: $activeProjects[0]?.id || '',
      title: '',
      description: '',
      priority: 'medium',
      deadline: '',
      estimatedTime: 60,
      actualTime: 0,
      status: 'pending'
    };
    showModal = true;
  }

  function openEditModal(taskId: string) {
    const task = $activeTasks.find(item => item.id === taskId);
    if (!task) return;

    editingTaskId = taskId;
    formData = {
      projectId: task.projectId,
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'medium',
      deadline: task.deadline || '',
      estimatedTime: task.estimatedTime ?? 60,
      actualTime: task.actualTime ?? 0,
      status: task.status
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingTaskId = null;
  }

  function handleSubmit() {
    if (!formData.title.trim() || !formData.projectId) return;
    if (isDeadlineAfterProjectEndDate(formData.deadline, formData.projectId)) {
      alert('테스크 마감일은 프로젝트 종료일 이후일 수 없습니다.');
      return;
    }

    const payload: Partial<Task> = {
      projectId: formData.projectId,
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      priority: formData.priority,
      deadline: formData.deadline || undefined,
      estimatedTime: Number(formData.estimatedTime) || 0,
      actualTime: Number(formData.actualTime) || 0,
      status: formData.status
    };

    if (editingTaskId) {
      tasks.update(editingTaskId, payload);
    } else {
      tasks.add({
        projectId: payload.projectId as string,
        title: payload.title as string,
        description: payload.description,
        priority: payload.priority,
        deadline: payload.deadline,
        estimatedTime: payload.estimatedTime,
        actualTime: payload.actualTime,
        status: payload.status || 'pending'
      });
    }

    closeModal();
  }

  function handleDelete(taskId: string) {
    if (confirm('이 테스크를 삭제하시겠습니까? (30일 후 영구 삭제됩니다)')) {
      tasks.remove(taskId);
    }
  }

  function updateStatus(taskId: string, status: Task['status']) {
    tasks.update(taskId, { status });
  }

  function openPomodoro(task: Task & { projectName: string }) {
    pomodoroTask = task;
  }

  function closePomodoro() {
    pomodoroTask = null;
  }
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">테스크 관리</h1>
      <p class="mt-2 text-sm text-gray-600">프로젝트별 테스크를 생성하고 관리하세요</p>
    </div>
    <button
      onclick={openCreateModal}
      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
      disabled={$activeProjects.length === 0}
    >
      <span class="mr-2">➕</span>
      새 테스크
    </button>
  </div>

  {#if $activeProjects.length === 0}
    <div class="bg-white shadow rounded-lg">
      <div class="text-center py-12">
        <span class="text-6xl mb-4 block">📌</span>
        <h3 class="text-lg font-medium text-gray-900 mb-2">프로젝트가 필요합니다</h3>
        <p class="text-gray-500 mb-6">테스크를 만들기 전에 프로젝트를 생성해주세요.</p>
        <a
          href="/projects"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          프로젝트 만들기
        </a>
      </div>
    </div>
  {:else if tasksWithProject.length === 0}
    <div class="bg-white shadow rounded-lg">
      <div class="text-center py-12">
        <span class="text-6xl mb-4 block">📝</span>
        <h3 class="text-lg font-medium text-gray-900 mb-2">테스크가 없습니다</h3>
        <p class="text-gray-500 mb-6">첫 테스크를 만들어보세요.</p>
        <button
          onclick={openCreateModal}
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          테스크 만들기
        </button>
      </div>
    </div>
  {:else}
    <div class="space-y-4">
      {#each tasksWithProject as task}
        <div class="bg-white shadow rounded-lg p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <a
                href={`/tasks/${task.id}`}
                class="text-base font-semibold text-blue-600 hover:text-blue-700"
              >
                {task.title}
              </a>
              <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                {task.projectName}
              </span>
            </div>
            {#if task.description}
              <p class="text-sm text-gray-500 mt-1">{task.description}</p>
            {/if}
            <div class="flex flex-wrap items-center gap-4 text-xs text-gray-500 mt-2">
              <span>상태: {task.status === 'completed' ? '완료' : task.status === 'in_progress' ? '진행중' : '대기'}</span>
              <span>예상: {formatDuration(task.estimatedTime ?? 0)}</span>
              <span>실제: {formatDuration(task.actualTime ?? 0)}</span>
              {#if task.deadline}
                <span>마감: {task.deadline}</span>
              {/if}
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <select
              class="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={task.status}
              onchange={(event) => {
                const target = event.target as HTMLSelectElement;
                updateStatus(task.id, target.value as Task['status']);
              }}
            >
              <option value="pending">대기</option>
              <option value="in_progress">진행중</option>
              <option value="completed">완료</option>
            </select>
            <button
              onclick={() => openEditModal(task.id)}
              class="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              수정
            </button>
            <button
              onclick={() => openPomodoro(task)}
              class="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
            >
              집중 시작
            </button>
            <button
              onclick={() => handleDelete(task.id)}
              class="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
            >
              삭제
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showModal}
  <div class="fixed z-50 inset-0 overflow-y-auto" style="background-color: rgba(0,0,0,0.5);">
    <div class="flex items-center justify-center min-h-screen p-4">
      <div
        class="relative bg-white rounded-lg shadow-xl max-w-lg w-full"
        style="z-index: 51;"
      >
        <form onsubmit={(event) => { event.preventDefault(); handleSubmit(); }}>
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
              {editingTaskId ? '테스크 수정' : '새 테스크'}
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
                  테스크 제목 *
                </label>
                <input
                  id="title"
                  type="text"
                  bind:value={formData.title}
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  id="description"
                  bind:value={formData.description}
                  rows="3"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                ></textarea>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label for="status" class="block text-sm font-medium text-gray-700 mb-1">
                    상태
                  </label>
                  <select
                    id="status"
                    bind:value={formData.status}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pending">대기</option>
                    <option value="in_progress">진행중</option>
                    <option value="completed">완료</option>
                  </select>
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

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label for="estimatedTime" class="block text-sm font-medium text-gray-700 mb-1">
                    예상 (분)
                  </label>
                  <input
                    id="estimatedTime"
                    type="number"
                    min="0"
                    bind:value={formData.estimatedTime}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label for="actualTime" class="block text-sm font-medium text-gray-700 mb-1">
                    실제 (분)
                  </label>
                  <input
                    id="actualTime"
                    type="number"
                    min="0"
                    bind:value={formData.actualTime}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label for="deadline" class="block text-sm font-medium text-gray-700 mb-1">
                    마감일
                  </label>
                <input
                  id="deadline"
                  type="date"
                  bind:value={formData.deadline}
                  max={selectedProject?.endDate}
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
              {editingTaskId ? '저장' : '생성'}
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
{/if}

{#if pomodoroTask}
  <PomodoroModal
    task={pomodoroTask}
    projectName={pomodoroTask.projectName}
    onClose={closePomodoro}
  />
{/if}
