<script setup lang="ts">
import type { ClipboardNotice } from '../../composables/useClipboard'

defineProps<{
  notice: ClipboardNotice
}>()
</script>

<template>
  <p
    class="app-notice"
    :class="`app-notice--${notice.kind}`"
    :role="notice.kind === 'error' ? 'alert' : 'status'"
  >
    {{ notice.message }}
  </p>
</template>
