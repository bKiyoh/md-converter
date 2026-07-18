<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import { useMarkdownEditor } from '../../composables/useMarkdownEditor'
import { tooltipDirective as vTooltip } from '../../directives/tooltip'
import type { MarkdownEditorViewState } from '../../types/editorView'
import EditorInputGuideContent from './EditorInputGuideContent.vue'

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
const inputGuideButton = ref<HTMLButtonElement | null>(null)
const isInputGuideOpen = ref<boolean>(false)

function closeInputGuide(): void {
  isInputGuideOpen.value = false
}

function toggleInputGuide(): void {
  isInputGuideOpen.value = !isInputGuideOpen.value
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || !isInputGuideOpen.value || event.key !== 'Escape') {
    return
  }

  event.preventDefault()
  closeInputGuide()
  void nextTick(() => inputGuideButton.value?.focus())
}

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

watch(
  () => props.focusMode,
  (focusMode) => {
    if (focusMode) {
      closeInputGuide()
    }
  },
)

onMounted(() => {
  resizeTextarea()
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleDocumentKeydown)
})

defineExpose({ captureViewState, restoreViewState, isConnected })
</script>

<template>
  <section
    id="input-panel"
    class="editor-panel panel"
    :class="{ 'editor-panel--guide-open': isInputGuideOpen && !focusMode }"
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

    <section
      v-if="isInputGuideOpen && !focusMode"
      id="markdown-input-guide"
      class="input-guide-panel"
      role="region"
      aria-labelledby="markdown-input-guide-title"
    >
      <EditorInputGuideContent title-id="markdown-input-guide-title" />
    </section>

    <div v-show="!focusMode" class="panel-footer">
      <div class="input-guide-root">
        <button
          v-tooltip="isInputGuideOpen ? '入力支援を閉じる' : '入力支援を表示'"
          ref="inputGuideButton"
          class="input-guide-button"
          type="button"
          :aria-expanded="isInputGuideOpen"
          :aria-label="isInputGuideOpen ? '入力支援を閉じる' : '入力支援を表示'"
          aria-controls="markdown-input-guide"
          @click="toggleInputGuide"
        >
          <AppIcon name="help" />
        </button>
      </div>
      <p id="markdown-input-count" class="character-count" aria-live="polite">
        {{ characterCount.toLocaleString('ja-JP') }}文字
      </p>
    </div>
  </section>
</template>
