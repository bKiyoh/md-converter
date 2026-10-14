<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import { tooltipDirective as vTooltip } from '../../directives/tooltip'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

function updateChecked(event: Event): void {
  if (event.target instanceof HTMLInputElement) {
    emit('update:modelValue', event.target.checked)
  }
}
</script>

<template>
  <label
    v-tooltip="`スクロール同期：${modelValue ? 'ON' : 'OFF'}`"
    class="scroll-sync-toggle"
    :class="{ 'scroll-sync-toggle--checked': modelValue }"
  >
    <AppIcon name="scroll-sync" />
    <input
      id="scroll-sync-setting"
      type="checkbox"
      :checked="modelValue"
      aria-label="スクロール同期"
      @change="updateChecked"
    />
  </label>
</template>
