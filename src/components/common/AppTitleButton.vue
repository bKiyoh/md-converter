<script setup lang="ts">
import titleIconDark from '../../assets/title-icon-dark.png'
import titleIconLight from '../../assets/title-icon-light.png'
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
    title="このアプリについて"
    @click="emit('click', $event)"
  >
    <img
      class="brand-title-icon"
      :src="darkMode ? titleIconDark : titleIconLight"
      alt="Markdown Converter"
    />
  </IconButton>
</template>
