<script setup lang="ts">
withDefaults(
  defineProps<{
    accessibleLabel: string
    title: string
    disabled?: boolean
  }>(),
  { disabled: false },
)
</script>

<template>
  <button
    class="icon-button"
    type="button"
    :aria-label="accessibleLabel"
    :title="title"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
