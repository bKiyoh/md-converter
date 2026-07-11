<script setup lang="ts">
import type { ConversionWarning } from '../../types/conversion'

defineProps<{
  warnings: ConversionWarning[]
}>()

function formatLocation(warning: ConversionWarning): string {
  if (!warning.location) {
    return ''
  }

  return `（${warning.location.line}:${warning.location.column}）`
}
</script>

<template>
  <section
    v-if="warnings.length > 0"
    class="warnings"
    aria-labelledby="warnings-heading"
    aria-live="polite"
  >
    <h3 id="warnings-heading">変換時の警告</h3>
    <ul>
      <li v-for="(warning, index) in warnings" :key="`${warning.code}-${index}`">
        {{ warning.message }}{{ formatLocation(warning) }}
      </li>
    </ul>
  </section>
</template>
