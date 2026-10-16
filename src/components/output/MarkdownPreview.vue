<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { MarkdownDocument } from '../../types/markdown'
import { renderMarkdownPreview } from '../../utils/renderMarkdownPreview'

const props = withDefaults(defineProps<{
  document: MarkdownDocument
  editorInternalScroll: boolean
  previewId?: string
}>(), { previewId: 'markdown-preview' })

const emit = defineEmits<{
  'scroll-element': [element: HTMLElement | null]
}>()
const surface = ref<HTMLElement | null>(null)
watch(surface, (element) => emit('scroll-element', element), { flush: 'post' })
onBeforeUnmount(() => emit('scroll-element', null))

const previewHtml = computed<string>(() => {
  try {
    return renderMarkdownPreview(props.document)
  } catch {
    return ''
  }
})
</script>

<template>
  <div
    v-if="previewHtml"
    ref="surface"
    :id="previewId"
    class="markdown-preview"
    :class="
      editorInternalScroll ? 'preview-surface--internal-scroll' : 'preview-surface--expand'
    "
    aria-live="polite"
    v-html="previewHtml"
  />
  <p
    v-else
    ref="surface"
    :id="previewId"
    class="preview-placeholder"
    :class="
      editorInternalScroll ? 'preview-surface--internal-scroll' : 'preview-surface--expand'
    "
  >
    Markdownプレビューがここに表示されます
  </p>
</template>
