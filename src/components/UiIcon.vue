<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'grid'"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></template>
    <template v-else-if="name === 'layers'"><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></template>
    <template v-else-if="name === 'chart'"><path d="M3 3v18h18" /><path d="m7 16 4-4 3 2 5-7" /><path d="M17 7h2v2" /></template>
    <template v-else-if="name === 'book'"><path d="M12 7c-2-1.5-5-2-9-1v14c4-1 7-.5 9 1 2-1.5 5-2 9-1V6c-4-1-7-.5-9 1Z" /><path d="M12 7v14" /></template>
    <template v-else-if="name === 'search'"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></template>
    <template v-else-if="name === 'sparkle'"><path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z" /><path d="m19 17 .7 1.3L21 19l-1.3.7L19 21l-.7-1.3L17 19l1.3-.7L19 17Z" /></template>
    <template v-else-if="name === 'clock'"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></template>
    <template v-else-if="name === 'check'"><path d="m5 12 4 4L19 6" /></template>
    <template v-else-if="name === 'chevron'"><path d="m9 6 6 6-6 6" /></template>
    <template v-else-if="name === 'arrow'"><path d="M4 12h16" /><path d="m14 6 6 6-6 6" /></template>
    <template v-else-if="name === 'left'"><path d="M20 12H4" /><path d="m10 6-6 6 6 6" /></template>
    <template v-else-if="name === 'menu'"><path d="M4 7h16M4 12h16M4 17h16" /></template>
    <template v-else-if="name === 'target'"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></template>
    <template v-else-if="name === 'play'"><path d="m8 5 11 7-11 7V5Z" /></template>
    <template v-else-if="name === 'info'"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></template>
    <template v-else-if="name === 'trophy'"><path d="M8 3h8v7a4 4 0 0 1-8 0V3Z" /><path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 14v4M8 21h8M9 18h6" /></template>
  </svg>
</template>
