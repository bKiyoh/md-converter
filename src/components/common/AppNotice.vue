<script setup lang="ts">
defineProps<{
  notice: {
    kind: 'success' | 'error'
    message: string
  }
  actionLabel?: string
}>()

defineEmits<{
  action: []
}>()
</script>

<template>
  <div
    class="app-notice"
    :class="`app-notice--${notice.kind}`"
    :role="notice.kind === 'error' ? 'alert' : 'status'"
  >
    <span>{{ notice.message }}</span>
    <button
      v-if="actionLabel"
      class="app-notice-action"
      type="button"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
