<script lang="ts">
  import { page } from '$app/stores';
  import { unreadCount } from '$lib/stores/notifications';

  const navItems = [
    { path: '/', label: '대시보드', icon: '📊' },
    { path: '/calendar', label: '캘린더', icon: '📅' },
    { path: '/tasks', label: '테스크', icon: '✅' },
    { path: '/projects', label: '프로젝트', icon: '📁' },
    { path: '/timeline', label: '타임라인', icon: '📈' },
    { path: '/retrospective', label: '회고', icon: '✍️' },
    { path: '/settings', label: '설정', icon: '⚙️' }
  ];

  const currentPath = $derived($page.url.pathname);
</script>

<nav class="bg-white border-b border-gray-200 sticky top-0 z-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-16">
      <div class="flex">
        <div class="flex-shrink-0 flex items-center">
          <a href="/" class="text-2xl font-bold text-blue-600">Krocs</a>
        </div>
        <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
          {#each navItems as item}
            <a
              href={item.path}
              class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors
                {currentPath === item.path
                  ? 'border-blue-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
            >
              <span class="mr-1">{item.icon}</span>
              {item.label}
            </a>
          {/each}
        </div>
      </div>
      <div class="flex items-center">
        <a
          href="/notifications"
          class="relative p-2 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <span class="sr-only">알림 보기</span>
          <span class="text-2xl">🔔</span>
          {#if $unreadCount > 0}
            <span
              class="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full"
            >
              {$unreadCount}
            </span>
          {/if}
        </a>
      </div>
    </div>
  </div>

  <!-- Mobile menu -->
  <div class="sm:hidden border-t border-gray-200">
    <div class="pt-2 pb-3 space-y-1">
      {#each navItems as item}
        <a
          href={item.path}
          class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium
            {currentPath === item.path
              ? 'bg-blue-50 border-blue-500 text-blue-700'
              : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'}"
        >
          <span class="mr-2">{item.icon}</span>
          {item.label}
        </a>
      {/each}
    </div>
  </div>
</nav>
