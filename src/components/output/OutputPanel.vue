<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { ConversionWarning } from '../../types/conversion'
import ConversionWarnings from './ConversionWarnings.vue'
import MarkdownPreview from './MarkdownPreview.vue'

defineProps<{
  markdown: string
  output: string
  characterCount: number
  warnings: ConversionWarning[]
  editorInternalScroll: boolean
}>()

type OutputView = 'preview' | 'conversion'

const activeView = ref<OutputView>('conversion')
const previewTab = ref<HTMLButtonElement | null>(null)
const conversionTab = ref<HTMLButtonElement | null>(null)

function selectView(view: OutputView): void {
  activeView.value = view
}

async function selectViewAndFocus(view: OutputView): Promise<void> {
  selectView(view)
  await nextTick()
  const target = view === 'preview' ? previewTab.value : conversionTab.value
  target?.focus()
}

function handleViewTabKeydown(event: KeyboardEvent, currentView: OutputView): void {
  let nextView: OutputView | null = null

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    nextView = currentView === 'preview' ? 'conversion' : 'preview'
  } else if (event.key === 'Home') {
    nextView = 'preview'
  } else if (event.key === 'End') {
    nextView = 'conversion'
  }

  if (nextView) {
    event.preventDefault()
    void selectViewAndFocus(nextView)
  }
}
</script>

<template>
  <section
    id="output-panel"
    class="output-panel panel"
    role="tabpanel"
    aria-labelledby="output-tab"
    tabindex="0"
  >
    <div class="output-view-tablist" role="tablist" aria-label="右ペインの表示">
      <button
        id="preview-view-tab"
        ref="previewTab"
        class="output-view-tab"
        :class="{ 'output-view-tab--active': activeView === 'preview' }"
        type="button"
        role="tab"
        aria-controls="preview-view-panel"
        :aria-selected="activeView === 'preview'"
        :tabindex="activeView === 'preview' ? 0 : -1"
        @click="selectView('preview')"
        @keydown="handleViewTabKeydown($event, 'preview')"
      >
        Markdownプレビュー
      </button>
      <button
        id="conversion-view-tab"
        ref="conversionTab"
        class="output-view-tab"
        :class="{ 'output-view-tab--active': activeView === 'conversion' }"
        type="button"
        role="tab"
        aria-controls="conversion-view-panel"
        :aria-selected="activeView === 'conversion'"
        :tabindex="activeView === 'conversion' ? 0 : -1"
        @click="selectView('conversion')"
        @keydown="handleViewTabKeydown($event, 'conversion')"
      >
        変換結果
      </button>
    </div>

    <div
      v-if="activeView === 'preview'"
      id="preview-view-panel"
      class="output-view-panel"
      role="tabpanel"
      aria-labelledby="preview-view-tab"
    >
      <MarkdownPreview
        :markdown="markdown"
        :editor-internal-scroll="editorInternalScroll"
      />
    </div>

    <div
      v-else
      id="conversion-view-panel"
      class="output-view-panel"
      role="tabpanel"
      aria-labelledby="conversion-view-tab"
    >
      <label class="visually-hidden" for="conversion-output">変換結果</label>
      <textarea
        id="conversion-output"
        class="text-area output-area"
        :value="output"
        aria-describedby="conversion-output-count"
        readonly
        placeholder="変換結果がここに表示されます"
      />

      <div class="panel-footer">
        <ConversionWarnings :warnings="warnings" />
        <p id="conversion-output-count" class="character-count" aria-live="polite">
          {{ characterCount.toLocaleString('ja-JP') }}文字
        </p>
      </div>
    </div>
  </section>
</template>
