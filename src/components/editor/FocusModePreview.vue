<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import MarkdownPreview from '../output/MarkdownPreview.vue'
import type { MarkdownDocument } from '../../types/markdown'

defineProps<{
  document: MarkdownDocument
  conversionFailed: boolean
}>()
const emit = defineEmits<{
  'scroll-element': [element: HTMLElement | null]
}>()
const surface = ref<HTMLElement | null>(null)
watch(surface, (element) => emit('scroll-element', element), { flush: 'post' })
onBeforeUnmount(() => emit('scroll-element', null))
</script>

<template>
  <div
    id="focus-mode-preview"
    ref="surface"
    class="focus-mode-preview"
    role="region"
    aria-label="Markdownプレビュー"
    tabindex="0"
  >
    <p v-if="conversionFailed" role="alert">
      Markdownプレビューを表示できませんでした。編集に戻って本文を確認してください。入力内容は保持されています。
    </p>
    <MarkdownPreview
      v-else
      :document="document"
      :editor-internal-scroll="false"
      preview-id="focus-markdown-preview"
    />
  </div>
</template>
