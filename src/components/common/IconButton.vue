<script setup lang="ts">
import { tooltipDirective as vTooltip } from '../../directives/tooltip'

withDefaults(
  defineProps<{
    accessibleLabel: string
    tooltip?: string
    disabled?: boolean
  }>(),
  { tooltip: undefined, disabled: false },
)
</script>

<template>
  <button
    v-tooltip="tooltip"
    class="icon-button"
    type="button"
    :aria-label="accessibleLabel"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
