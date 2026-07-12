<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useMarkdownEditor } from '../../composables/useMarkdownEditor'

const props = defineProps<{
  modelValue: string
  characterCount: number
  editorInternalScroll: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textarea = ref<HTMLTextAreaElement | null>(null)

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
    </div>

    <label class="visually-hidden" for="markdown-input">変換するMarkdown</label>
    <textarea
      id="markdown-input"
      ref="textarea"
      class="text-area"
      :class="
        editorInternalScroll ? 'text-area--internal-scroll' : 'text-area--expand'
      "
      :value="modelValue"
      aria-describedby="markdown-input-count"
      placeholder="Markdownを入力してください"
      spellcheck="true"
      @input="updateValue"
      @keydown="handleKeydown"
    />

    <div class="panel-footer">
      <p id="markdown-input-count" class="character-count" aria-live="polite">
        {{ characterCount.toLocaleString('ja-JP') }}文字
      </p>
    </div>
  </section>
</template>
