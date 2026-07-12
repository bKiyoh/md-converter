<script setup lang="ts">
import { computed } from 'vue'
import { parseMarkdownForPreview } from '../../parser/parseMarkdown'
import { renderMarkdownPreview } from '../../utils/renderMarkdownPreview'

const props = defineProps<{
  markdown: string
  editorInternalScroll: boolean
}>()

const previewHtml = computed<string>(() => {
  try {
    return renderMarkdownPreview(parseMarkdownForPreview(props.markdown))
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
