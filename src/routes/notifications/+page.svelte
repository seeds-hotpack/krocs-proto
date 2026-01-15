<script lang="ts">
  import { onMount } from 'svelte';
  import { notifications, unreadNotifications } from '$lib/stores/notifications';
  import { syncNotifications } from '$lib/utils/notifications';

  const typeLabels: Record<string, string> = {
    deadline: '마감 알림',
    buffer: '버퍼 경고',
    unscheduled: '미배치 알림',
    weekly_review: '주간 리마인더'
  };

  const unreadCount = $derived($unreadNotifications.length);

  onMount(() => {
    syncNotifications();
  });

  function markAsRead(id: string) {
    notifications.markAsRead(id);
  }

  function markAllAsRead() {
    notifications.markAllAsRead();
  }

  function clearAll() {
    if (confirm('모든 알림을 삭제하시겠습니까?')) {
      notifications.clear();
    }
  }

  function refreshNotifications() {
    syncNotifications();
  }

  function formatCreatedAt(dateValue: string) {
    return new Date(dateValue).toLocaleString('ko-KR');
  }
</script>

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">알림</h1>
      <p class="mt-2 text-sm text-gray-600">중요한 상태 변화를 확인하세요</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button
        onclick={refreshNotifications}
        class="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
      >
        새로고침
      </button>
      <button
        onclick={markAllAsRead}
        class="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        disabled={unreadCount === 0}
      >
        모두 읽음
      </button>
      <button
        onclick={clearAll}
        class="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100"
        disabled={$notifications.length === 0}
      >
        전체 삭제
      </button>
    </div>
  </div>

  <div class="mb-6 flex items-center gap-3">
    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      읽지 않은 알림 {unreadCount}개
    </span>
    <span class="text-sm text-gray-500">총 {$notifications.length}개</span>
  </div>

  {#if $notifications.length === 0}
    <div class="bg-white shadow rounded-lg">
      <div class="text-center py-12">
        <span class="text-5xl mb-4 block">🔔</span>
        <p class="text-gray-500">새로운 알림이 없습니다.</p>
      </div>
    </div>
  {:else}
    <div class="space-y-3">
      {#each $notifications as notification}
        <div
          class="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between
            {notification.read ? 'border-gray-200 bg-white' : 'border-blue-200 bg-blue-50'}"
        >
          <div>
            <p class="text-xs font-semibold text-blue-600">
              {typeLabels[notification.type] ?? notification.type}
            </p>
            <p class="text-sm font-medium text-gray-900 mt-1">{notification.message}</p>
            <p class="text-xs text-gray-500 mt-2">{formatCreatedAt(notification.createdAt)}</p>
          </div>
          <div class="flex items-center gap-2">
            {#if !notification.read}
              <button
                onclick={() => markAsRead(notification.id)}
                class="px-3 py-1.5 text-xs font-medium text-blue-600 bg-white border border-blue-200 rounded-md hover:bg-blue-50"
              >
                읽음
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
