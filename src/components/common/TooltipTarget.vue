<script setup lang="ts">
import { tooltipDirective as vTooltip } from '../../directives/tooltip'

defineProps<{
  text: string
}>()
</script>

<template>
  <span v-tooltip="text" class="tooltip-target">
    <slot />
  </span>
</template>
