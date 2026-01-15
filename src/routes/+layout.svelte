<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import Nav from '$lib/components/Nav.svelte';
	import { page } from '$app/stores';
	import { syncNotifications } from '$lib/utils/notifications';

	let { children } = $props();

	const isOnboarding = $derived($page.url.pathname === '/onboarding');

	onMount(() => {
		syncNotifications();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Krocs - 시간 관리 플래너</title>
</svelte:head>

{#if !isOnboarding}
	<Nav />
{/if}

<main class="min-h-screen bg-gray-50">
	{@render children()}
</main>
