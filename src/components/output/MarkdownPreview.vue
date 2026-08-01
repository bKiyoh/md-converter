<script setup lang="ts">
import { computed } from 'vue'
import type { MarkdownDocument } from '../../types/markdown'
import { renderMarkdownPreview } from '../../utils/renderMarkdownPreview'

const props = defineProps<{
  document: MarkdownDocument
  editorInternalScroll: boolean
}>()

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
    id="markdown-preview"
    class="markdown-preview"
    :class="
      editorInternalScroll ? 'preview-surface--internal-scroll' : 'preview-surface--expand'
    "
    aria-live="polite"
    v-html="previewHtml"
  />
  <p
    v-else
    id="markdown-preview"
    class="preview-placeholder"
    :class="
      editorInternalScroll ? 'preview-surface--internal-scroll' : 'preview-surface--expand'
    "
  >
    Markdownプレビューがここに表示されます
  </p>
</template>
