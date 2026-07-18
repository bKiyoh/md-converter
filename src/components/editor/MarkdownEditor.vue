<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useMarkdownEditor } from '../../composables/useMarkdownEditor'
import type { MarkdownEditorViewState } from '../../types/editorView'

const props = withDefaults(
  defineProps<{
    modelValue: string
    characterCount: number
    editorInternalScroll: boolean
    focusMode?: boolean
  }>(),
  { focusMode: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textarea = ref<HTMLTextAreaElement | null>(null)

function captureViewState(): MarkdownEditorViewState | null {
  const element = textarea.value

  if (!element) {
    return null
  }

  return {
    selectionStart: element.selectionStart,
    selectionEnd: element.selectionEnd,
    scrollTop: element.scrollTop,
    scrollLeft: element.scrollLeft,
  }
}

function restoreViewState(state: MarkdownEditorViewState): void {
  const element = textarea.value

  if (!element) {
    return
  }

  const maximumSelection = element.value.length
  element.focus({ preventScroll: true })
  element.setSelectionRange(
    Math.min(state.selectionStart, maximumSelection),
    Math.min(state.selectionEnd, maximumSelection),
  )
  element.scrollTop = state.scrollTop
  element.scrollLeft = state.scrollLeft
}

function isConnected(): boolean {
  return textarea.value?.isConnected ?? false
}

function resizeTextarea(): void {
  const element = textarea.value

  if (!element) {
    return
  }

  if (props.editorInternalScroll) {
    element.style.height = ''
    return
  }

  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

async function updateValue(event: Event): Promise<void> {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  await nextTick()
  resizeTextarea()
}

const { handleKeydown } = useMarkdownEditor((value) => emit('update:modelValue', value))

watch(
  () => [props.modelValue, props.editorInternalScroll],
  resizeTextarea,
  { flush: 'post' },
)

onMounted(resizeTextarea)

defineExpose({ captureViewState, restoreViewState, isConnected })
</script>

<template>
  <section
    id="input-panel"
    class="editor-panel panel"
    :role="focusMode ? 'region' : 'tabpanel'"
    :aria-labelledby="focusMode ? undefined : 'input-tab'"
    :aria-label="focusMode ? 'Markdown編集' : undefined"
    :tabindex="focusMode ? undefined : 0"
  >
    <slot name="document-tabs" />

    <label class="visually-hidden" for="markdown-input">変換するMarkdown</label>
    <textarea
      id="markdown-input"
      ref="textarea"
      class="text-area"
      :class="
        editorInternalScroll ? 'text-area--internal-scroll' : 'text-area--expand'
      "
      :value="modelValue"
      :aria-describedby="focusMode ? undefined : 'markdown-input-count'"
      placeholder="Markdownを入力してください"
      spellcheck="true"
      @input="updateValue"
      @keydown="handleKeydown"
    />

    <div v-show="!focusMode" class="panel-footer">
      <p id="markdown-input-count" class="character-count" aria-live="polite">
        {{ characterCount.toLocaleString('ja-JP') }}文字
      </p>
    </div>
  </section>
</template>
