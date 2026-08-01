<script setup lang="ts">
import titleIconDark from '../../assets/title-icon-dark.png'
import titleIconLight from '../../assets/title-icon-light.png'

defineProps<{
  alt: string
  darkMode: boolean
}>()
</script>

<template>
  <img
    :src="darkMode ? titleIconDark : titleIconLight"
    :alt="alt"
  />
</template>
