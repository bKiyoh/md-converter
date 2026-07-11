<script setup lang="ts">
import type { ConversionWarning, OutputFormat } from '../../types/conversion'
import ConversionWarnings from './ConversionWarnings.vue'
import OutputFormatSelect from './OutputFormatSelect.vue'

defineProps<{
  format: OutputFormat
  output: string
  characterCount: number
  warnings: ConversionWarning[]
}>()

const emit = defineEmits<{
  'update:format': [value: OutputFormat]
}>()
</script>

<template>
  <section class="output-panel panel" aria-labelledby="conversion-output-heading">
    <div class="panel-header output-header">
      <div>
        <p class="panel-kicker">Output</p>
        <h2 id="conversion-output-heading">変換結果</h2>
      </div>
      <OutputFormatSelect
        :model-value="format"
        @update:model-value="emit('update:format', $event)"
      />
    </div>

    <label class="visually-hidden" for="conversion-output">変換結果</label>
    <textarea
      id="conversion-output"
      class="text-area output-area"
      :value="output"
      aria-describedby="conversion-output-count"
      readonly
      placeholder="変換結果がここに表示されます"
    />

    <p id="conversion-output-count" class="character-count" aria-live="polite">
      {{ characterCount.toLocaleString('ja-JP') }}文字
    </p>

    <ConversionWarnings :warnings="warnings" />
  </section>
</template>
