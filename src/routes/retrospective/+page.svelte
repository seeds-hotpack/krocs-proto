<script lang="ts">
  let period = $state<'week' | 'month'>('week');
  let content = $state('');

  function handleSubmit() {
    if (!content.trim()) return;
    alert('회고가 저장되었습니다! (프로토타입에서는 실제로 저장되지 않습니다)');
    content = '';
  }
</script>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900">회고</h1>
    <p class="mt-2 text-sm text-gray-600">계획 대비 실제 수행을 돌아보고 다음 계획에 반영하세요</p>
  </div>

  <div class="bg-white shadow rounded-lg p-6">
    <div class="mb-6">
      <label class="block text-sm font-medium text-gray-700 mb-2">회고 기간</label>
      <div class="flex space-x-4">
        <label class="flex items-center">
          <input type="radio" bind:group={period} value="week" class="mr-2" />
          <span class="text-sm">주간</span>
        </label>
        <label class="flex items-center">
          <input type="radio" bind:group={period} value="month" class="mr-2" />
          <span class="text-sm">월간</span>
        </label>
      </div>
    </div>

    <div class="mb-6">
      <label for="content" class="block text-sm font-medium text-gray-700 mb-2">
        회고 내용
      </label>
      <textarea
        id="content"
        bind:value={content}
        rows="10"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="이번 주/월의 계획과 실제 수행을 돌아보세요...

- 잘한 점
- 개선할 점
- 다음 계획에 반영할 사항"
      ></textarea>
    </div>

    <div class="flex justify-end">
      <button
        onclick={handleSubmit}
        class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        회고 저장
      </button>
    </div>
  </div>

  <div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
    <h3 class="text-sm font-medium text-blue-900 mb-2">💡 회고 팁</h3>
    <ul class="text-sm text-blue-800 space-y-1 list-disc list-inside">
      <li>계획했던 시간과 실제 소요 시간을 비교해보세요</li>
      <li>버퍼를 얼마나 사용했는지 확인하세요</li>
      <li>완료하지 못한 작업의 원인을 분석하세요</li>
      <li>다음 주/월의 가용시간과 버퍼를 조정하세요</li>
    </ul>
  </div>
</div>
