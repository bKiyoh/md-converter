<script setup lang="ts">
defineProps<{
  notice: {
    kind: 'success' | 'error'
    message: string
  }
}>()
</script>

<template>
  <div
    class="app-notice"
    :class="`app-notice--${notice.kind}`"
    :role="notice.kind === 'error' ? 'alert' : 'status'"
  >
    <span>{{ notice.message }}</span>
  </div>
</template>
