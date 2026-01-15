<script lang="ts">
  import { settings } from '$lib/stores/settings';
  import { storage } from '$lib/utils/storage';
  import { formatDuration } from '$lib/utils/helpers';

  let weeklyHours = $state($settings.weeklyAvailableTime / 60);
  let bufferPercentage = $state(
    Math.round(($settings.weeklyGlobalBuffer / $settings.weeklyAvailableTime) * 100)
  );

  function saveSettings() {
    const weeklyMinutes = weeklyHours * 60;
    const weeklyBuffer = Math.round((weeklyMinutes * bufferPercentage) / 100);

    settings.update(s => ({
      ...s,
      weeklyAvailableTime: weeklyMinutes,
      monthlyAvailableTime: weeklyMinutes * 4,
      weeklyGlobalBuffer: weeklyBuffer,
      monthlyGlobalBuffer: weeklyBuffer * 4
    }));

    alert('설정이 저장되었습니다.');
  }

  function exportData() {
    const data = storage.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `krocs-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (storage.importData(content)) {
            alert('데이터를 성공적으로 가져왔습니다. 페이지를 새로고침합니다.');
            location.reload();
          } else {
            alert('데이터 가져오기에 실패했습니다.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  function clearAllData() {
    if (
      confirm(
        '모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.\n\n계속하려면 "삭제"를 입력하세요.'
      )
    ) {
      const confirmation = prompt('확인을 위해 "삭제"를 입력하세요:');
      if (confirmation === '삭제') {
        storage.clear();
        alert('모든 데이터가 삭제되었습니다. 페이지를 새로고침합니다.');
        location.href = '/onboarding';
      }
    }
  }
</script>

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-gray-900">설정</h1>
    <p class="mt-2 text-sm text-gray-600">시스템 설정을 관리하세요</p>
  </div>

  <!-- Time Settings -->
  <div class="bg-white shadow rounded-lg mb-6">
    <div class="px-6 py-4 border-b border-gray-200">
      <h3 class="text-lg font-medium text-gray-900">가용시간 및 버퍼 설정</h3>
    </div>
    <div class="px-6 py-4 space-y-6">
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
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p class="mt-1 text-sm text-gray-500">
          현재: {formatDuration(weeklyHours * 60)}
        </p>
      </div>

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
        <p class="mt-2 text-sm text-gray-500">
          주 {weeklyHours}시간 중 {Math.round((weeklyHours * bufferPercentage) / 100)}시간이 버퍼로 예약됩니다.
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">버퍼 정책</label>
        <div class="space-y-2">
          <label class="flex items-center">
            <input
              type="radio"
              bind:group={$settings.globalBufferPolicy}
              value="warn"
              class="mr-2"
            />
            <span class="text-sm">경고 (초과 시 경고만 표시)</span>
          </label>
          <label class="flex items-center">
            <input
              type="radio"
              bind:group={$settings.globalBufferPolicy}
              value="block"
              class="mr-2"
            />
            <span class="text-sm">차단 (초과 시 일정 배치 불가)</span>
          </label>
        </div>
      </div>

      <div class="pt-4">
        <button
          onclick={saveSettings}
          class="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          설정 저장
        </button>
      </div>
    </div>
  </div>

  <!-- Data Management -->
  <div class="bg-white shadow rounded-lg mb-6">
    <div class="px-6 py-4 border-b border-gray-200">
      <h3 class="text-lg font-medium text-gray-900">데이터 관리</h3>
    </div>
    <div class="px-6 py-4 space-y-4">
      <div class="flex items-center justify-between py-3 border-b border-gray-200">
        <div>
          <h4 class="text-sm font-medium text-gray-900">데이터 내보내기</h4>
          <p class="text-xs text-gray-500 mt-1">모든 데이터를 JSON 파일로 다운로드합니다.</p>
        </div>
        <button
          onclick={exportData}
          class="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
        >
          내보내기
        </button>
      </div>

      <div class="flex items-center justify-between py-3 border-b border-gray-200">
        <div>
          <h4 class="text-sm font-medium text-gray-900">데이터 가져오기</h4>
          <p class="text-xs text-gray-500 mt-1">
            백업 파일에서 데이터를 복원합니다. 현재 데이터를 덮어씁니다.
          </p>
        </div>
        <button
          onclick={importData}
          class="px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100"
        >
          가져오기
        </button>
      </div>

      <div class="flex items-center justify-between py-3">
        <div>
          <h4 class="text-sm font-medium text-gray-900">모든 데이터 삭제</h4>
          <p class="text-xs text-gray-500 mt-1">
            ⚠️ 모든 프로젝트, 테스크, 일정을 영구적으로 삭제합니다.
          </p>
        </div>
        <button
          onclick={clearAllData}
          class="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100"
        >
          삭제
        </button>
      </div>
    </div>
  </div>

  <!-- About -->
  <div class="bg-white shadow rounded-lg">
    <div class="px-6 py-4">
      <h3 class="text-lg font-medium text-gray-900 mb-2">Krocs</h3>
      <p class="text-sm text-gray-600">
        시간 관리 프로토타입 v1.0.0<br />
        모든 데이터는 브라우저의 LocalStorage에 저장됩니다.
      </p>
    </div>
  </div>
</div>
