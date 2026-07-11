<script setup lang="ts">
import { computed } from 'vue'
import AppNotice from '../common/AppNotice.vue'
import { useClipboard } from '../../composables/useClipboard'
import { outputFormatOptions } from '../../converters/converterRegistry'
import type { ConversionWarning, OutputFormat } from '../../types/conversion'
import ConversionWarnings from './ConversionWarnings.vue'
import OutputFormatSelect from './OutputFormatSelect.vue'

const props = defineProps<{
  format: OutputFormat
  output: string
  characterCount: number
  warnings: ConversionWarning[]
}>()

const emit = defineEmits<{
  'update:format': [value: OutputFormat]
}>()

const { copy, notice } = useClipboard()
const formatLabel = computed<string>(
  () => outputFormatOptions.find((option) => option.value === props.format)?.label ?? '',
)

async function copyOutput(): Promise<void> {
  await copy(props.output, `${formatLabel.value}形式でコピーしました`)
}
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

    <div class="output-actions">
      <p id="conversion-output-count" class="character-count" aria-live="polite">
        {{ characterCount.toLocaleString('ja-JP') }}文字
      </p>
      <button
        class="copy-button"
        type="button"
        :disabled="output.length === 0"
        @click="copyOutput"
      >
        コピー
      </button>
    </div>

    <AppNotice v-if="notice" :notice="notice" />

    <ConversionWarnings :warnings="warnings" />
  </section>
</template>
