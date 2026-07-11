<script setup lang="ts">
import { useMarkdownEditor } from '../../composables/useMarkdownEditor'

defineProps<{
  modelValue: string
  characterCount: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function updateValue(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}

function clearValue(): void {
  emit('update:modelValue', '')
}

const { handleKeydown } = useMarkdownEditor((value) => emit('update:modelValue', value))
</script>

<template>
  <section
    id="input-panel"
    class="editor-panel panel"
    role="tabpanel"
    aria-labelledby="input-tab"
    tabindex="0"
  >
    <div class="panel-header">
      <div>
        <p class="panel-kicker">Input</p>
        <h2 id="markdown-input-heading">Markdown入力</h2>
      </div>
      <button
        class="secondary-button"
        type="button"
        :disabled="modelValue.length === 0"
        @click="clearValue"
      >
        全削除
      </button>
    </div>

    <label class="visually-hidden" for="markdown-input">変換するMarkdown</label>
    <textarea
      id="markdown-input"
      class="text-area"
      :value="modelValue"
      aria-describedby="markdown-input-count"
      placeholder="Markdownを入力してください"
      spellcheck="true"
      @input="updateValue"
      @keydown="handleKeydown"
    />

    <p id="markdown-input-count" class="character-count" aria-live="polite">
      {{ characterCount.toLocaleString('ja-JP') }}文字
    </p>
  </section>
</template>
