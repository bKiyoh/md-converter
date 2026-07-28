<script setup lang="ts">
defineProps<{
  name:
    | 'sun'
    | 'moon'
    | 'copy'
    | 'check'
    | 'settings'
    | 'close'
    | 'trash'
    | 'rotate-ccw'
    | 'trash-x'
    | 'focus'
    | 'help'
    | 'file-output'
    | 'search'
    | 'chevron-up'
    | 'chevron-down'
    | 'replace'
}>()
</script>

<template>
  <svg
    class="app-icon"
    :data-icon="name"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </template>
    <path v-else-if="name === 'moon'" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    <template v-else-if="name === 'copy'">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </template>
    <path v-else-if="name === 'check'" d="m20 6-11 11-5-5" />
    <path v-else-if="name === 'close'" d="M18 6 6 18M6 6l12 12" />
    <template v-else-if="name === 'trash'">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6" />
    </template>
    <path
      v-else-if="name === 'rotate-ccw'"
      d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"
    />
    <template v-else-if="name === 'trash-x'">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11l4 4M14 11l-4 4" />
    </template>
    <template v-else-if="name === 'focus'">
      <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5" />
    </template>
    <template v-else-if="name === 'help'">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4M12 18h.01" />
    </template>
    <template v-else-if="name === 'file-output'">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8" />
      <path d="M14 2v6h6M8 13h4M8 17h2M13 17h8M18 14l3 3-3 3" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </template>
    <path v-else-if="name === 'chevron-up'" d="m18 15-6-6-6 6" />
    <path v-else-if="name === 'chevron-down'" d="m6 9 6 6 6-6" />
    <template v-else-if="name === 'replace'">
      <path d="M4 7h11l-3-3M20 17H9l3 3" />
      <path d="m12 4 3 3-3 3M12 14l-3 3 3 3" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3h4v.08a1.7 1.7 0 0 0 1.06 1.52 1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 21 10h.08v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </template>
  </svg>
</template>
