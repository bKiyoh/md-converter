<script setup lang="ts">
import AppTitleIcon from './AppTitleIcon.vue'
import IconButton from './IconButton.vue'

defineProps<{
  darkMode: boolean
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <IconButton
    class="brand-title-button"
    accessible-label="このアプリについて"
    tooltip="このアプリについて"
    @click="emit('click', $event)"
  >
    <AppTitleIcon
      class="brand-title-icon"
      :dark-mode="darkMode"
      alt="Md Converter"
    />
  </IconButton>
</template>
