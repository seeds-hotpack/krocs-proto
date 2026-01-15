<script lang="ts">
  import { activeProjects, projects } from '$lib/stores/projects';
  import { activeTasks } from '$lib/stores/tasks';
  import { getPriorityColor } from '$lib/utils/helpers';

  let showModal = $state(false);
  let editingProject = $state<string | null>(null);
  let formData = $state({
    name: '',
    description: '',
    successCriteria: '',
    startDate: '',
    endDate: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    weeklyBuffer: 0,
    bufferPolicy: 'warn' as 'warn' | 'block'
  });

  function openCreateModal() {
    editingProject = null;
    formData = {
      name: '',
      description: '',
      successCriteria: '',
      startDate: '',
      endDate: '',
      priority: 'medium',
      weeklyBuffer: 0,
      bufferPolicy: 'warn'
    };
    showModal = true;
  }

  function openEditModal(projectId: string) {
    const project = $activeProjects.find(p => p.id === projectId);
    if (project) {
      editingProject = projectId;
      formData = {
        name: project.name,
        description: project.description || '',
        successCriteria: project.successCriteria || '',
        startDate: project.startDate || '',
        endDate: project.endDate || '',
        priority: project.priority || 'medium',
        weeklyBuffer: project.weeklyBuffer || 0,
        bufferPolicy: project.bufferPolicy || 'warn'
      };
      showModal = true;
    }
  }

  function closeModal() {
    showModal = false;
    editingProject = null;
  }

  function handleSubmit() {
    if (!formData.name.trim()) return;

    if (editingProject) {
      projects.update(editingProject, {
        name: formData.name,
        description: formData.description,
        successCriteria: formData.successCriteria || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        priority: formData.priority,
        weeklyBuffer: formData.weeklyBuffer,
        bufferPolicy: formData.bufferPolicy
      });
    } else {
      projects.add({
        name: formData.name,
        description: formData.description,
        successCriteria: formData.successCriteria || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        priority: formData.priority,
        weeklyBuffer: formData.weeklyBuffer,
        bufferPolicy: formData.bufferPolicy
      });
    }

    closeModal();
  }

  function handleDelete(projectId: string) {
    if ($activeProjects.length <= 1) {
      alert('마지막 프로젝트는 삭제할 수 없습니다. 최소 1개의 프로젝트가 필요합니다.');
      return;
    }
    if (confirm('이 프로젝트를 삭제하시겠습니까? (30일 후 영구 삭제됩니다)')) {
      projects.remove(projectId);
    }
  }

  const projectStats = $derived(
    $activeProjects.map(project => {
      const projectTasks = $activeTasks.filter(t => t.projectId === project.id);
      const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
      const completionRate =
        projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0;

      return {
        ...project,
        taskCount: projectTasks.length,
        completedTasks,
        completionRate
      };
    })
  );
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-8 flex justify-between items-center">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">프로젝트 관리</h1>
      <p class="mt-2 text-sm text-gray-600">프로젝트를 생성하고 관리하세요</p>
    </div>
    <button
      onclick={openCreateModal}
      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
    >
      <span class="mr-2">➕</span>
      새 프로젝트
    </button>
  </div>

  {#if projectStats.length === 0}
    <div class="bg-white shadow rounded-lg">
      <div class="text-center py-12">
        <span class="text-6xl mb-4 block">📁</span>
        <h3 class="text-lg font-medium text-gray-900 mb-2">아직 프로젝트가 없습니다</h3>
        <p class="text-gray-500 mb-6">첫 프로젝트를 만들어 작업을 시작하세요!</p>
        <button
          onclick={openCreateModal}
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          프로젝트 만들기
        </button>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {#each projectStats as project}
        <div class="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow">
          <div class="p-6">
            <div class="flex justify-between items-start mb-4">
              <div class="flex-1">
                <a
                  href={`/projects/${project.id}`}
                  class="text-lg font-medium text-blue-600 hover:text-blue-700 mb-1 inline-block"
                >
                  {project.name}
                </a>
                {#if project.description}
                  <p class="text-sm text-gray-500 line-clamp-2">{project.description}</p>
                {/if}
              </div>
              {#if project.priority}
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getPriorityColor(
                    project.priority
                  )}"
                >
                  {project.priority === 'high' ? '높음' : project.priority === 'medium' ? '보통' : '낮음'}
                </span>
              {/if}
            </div>

            <div class="space-y-2 mb-4">
              <div class="flex justify-between text-sm">
                <span class="text-gray-500">테스크</span>
                <span class="font-medium text-gray-900">
                  {project.completedTasks} / {project.taskCount}
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div
                  class="bg-blue-600 h-2 rounded-full transition-all"
                  style="width: {project.completionRate}%"
                ></div>
              </div>
              <div class="text-xs text-gray-500 text-right">완료율: {project.completionRate}%</div>
            </div>

            {#if project.weeklyBuffer && project.weeklyBuffer > 0}
              <div class="mb-4 text-sm text-gray-600">
                <span class="font-medium">버퍼:</span> {project.weeklyBuffer}시간/주
              </div>
            {/if}

            <div class="flex space-x-2">
              <a
                href={`/projects/${project.id}`}
                class="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 text-center"
              >
                상세
              </a>
              <button
                onclick={() => openEditModal(project.id)}
                class="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                수정
              </button>
              <button
                onclick={() => handleDelete(project.id)}
                class="flex-1 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal -->
{#if showModal}
  <div class="fixed z-50 inset-0 overflow-y-auto" style="background-color: rgba(0,0,0,0.5);">
    <div class="flex items-center justify-center min-h-screen p-4">
      <div
        class="relative bg-white rounded-lg shadow-xl max-w-lg w-full"
        style="z-index: 51;"
      >
        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
              {editingProject ? '프로젝트 수정' : '새 프로젝트'}
            </h3>

            <div class="space-y-4">
              <div>
                <label for="name" class="block text-sm font-medium text-gray-700 mb-1">
                  프로젝트 이름 *
                </label>
                <input
                  id="name"
                  type="text"
                  bind:value={formData.name}
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 업무, 개인 성장"
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
                  placeholder="프로젝트에 대한 간단한 설명"
                ></textarea>
              </div>

              <div>
                <label for="successCriteria" class="block text-sm font-medium text-gray-700 mb-1">
                  성공조건
                </label>
                <textarea
                  id="successCriteria"
                  bind:value={formData.successCriteria}
                  rows="2"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="이 프로젝트의 성공 기준 (예: 월 매출 1000만원 달성, 앱 출시 완료)"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">
                    시작일
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    bind:value={formData.startDate}
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
                    bind:value={formData.endDate}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
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

              <div>
                <label for="weeklyBuffer" class="block text-sm font-medium text-gray-700 mb-1">
                  주간 버퍼 (시간, 선택사항)
                </label>
                <input
                  id="weeklyBuffer"
                  type="number"
                  bind:value={formData.weeklyBuffer}
                  min="0"
                  step="0.5"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 8"
                />
              </div>

              <div>
                <label for="bufferPolicy" class="block text-sm font-medium text-gray-700 mb-1">
                  버퍼 정책
                </label>
                <select
                  id="bufferPolicy"
                  bind:value={formData.bufferPolicy}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="warn">경고 (초과 시 경고)</option>
                  <option value="block">차단 (초과 시 배치 불가)</option>
                </select>
              </div>
            </div>
          </div>

          <div class="bg-gray-50 px-4 py-3 flex flex-row-reverse gap-2">
            <button
              type="submit"
              class="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {editingProject ? '수정' : '생성'}
            </button>
            <button
              type="button"
              onclick={closeModal}
              class="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}
