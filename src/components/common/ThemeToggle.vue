<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import IconButton from './IconButton.vue'

defineProps<{
  darkMode: boolean
}>()

const emit = defineEmits<{
  'update:darkMode': [value: boolean]
}>()
</script>

<template>
  <IconButton
    :accessible-label="darkMode ? 'ライトモードに切り替える' : 'ダークモードに切り替える'"
    :tooltip="darkMode ? 'ライトモードに切り替える' : 'ダークモードに切り替える'"
    :aria-pressed="darkMode"
    @click="emit('update:darkMode', !darkMode)"
  >
    <AppIcon :name="darkMode ? 'sun' : 'moon'" />
  </IconButton>
</template>
