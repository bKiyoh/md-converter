<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import IconButton from './IconButton.vue'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

</script>

<template>
  <IconButton
    id="scroll-sync-setting"
    class="scroll-sync-toggle"
    :class="{ 'scroll-sync-toggle--active': modelValue }"
    accessible-label="スクロール同期"
    :tooltip="`スクロール同期：${modelValue ? 'ON' : 'OFF'}`"
    :aria-pressed="modelValue"
    @click="emit('update:modelValue', !modelValue)"
  >
    <AppIcon :name="modelValue ? 'scroll-sync' : 'scroll-sync-off'" />
  </IconButton>
</template>
