<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import IconButton from '../common/IconButton.vue'

defineProps<{
  query: string
  replacement: string
  replaceExpanded: boolean
  resultStatus: string
  replacementNotice: string
  hasMatches: boolean
}>()

const emit = defineEmits<{
  'update:query': [value: string]
  'update:replacement': [value: string]
  previous: []
  next: []
  toggleReplace: []
  replaceCurrent: []
  replaceAll: []
  close: []
}>()

const searchInput = ref<HTMLInputElement | null>(null)
const replacementInput = ref<HTMLInputElement | null>(null)

function readInputValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function moveFromField(event: KeyboardEvent): void {
  if (event.isComposing) {
    return
  }

  event.preventDefault()

  if (event.shiftKey) {
    emit('previous')
  } else {
    emit('next')
  }
}

function focusSearch(): void {
  searchInput.value?.focus()
  searchInput.value?.select()
}

function focusReplacement(): void {
  replacementInput.value?.focus()
  replacementInput.value?.select()
}

defineExpose({ focusSearch, focusReplacement })
</script>

<template>
  <section class="search-replace-panel" role="search" aria-label="文章検索と置換">
    <div class="search-replace-row search-replace-row--search">
      <AppIcon class="search-replace-leading-icon" name="search" />
      <label class="visually-hidden" for="markdown-search-input">検索文字列</label>
      <input
        id="markdown-search-input"
        ref="searchInput"
        class="search-replace-input"
        type="search"
        autocomplete="off"
        spellcheck="false"
        placeholder="検索"
        :value="query"
        @input="emit('update:query', readInputValue($event))"
        @keydown.enter="moveFromField"
      />
      <span class="search-result-status" aria-live="polite">{{ resultStatus }}</span>
      <IconButton
        class="search-navigation-button"
        accessible-label="前の一致へ移動"
        tooltip="前へ（Shift + Enter）"
        :disabled="!hasMatches"
        @click="emit('previous')"
      >
        <AppIcon name="chevron-up" />
      </IconButton>
      <IconButton
        class="search-navigation-button"
        accessible-label="次の一致へ移動"
        tooltip="次へ（Enter）"
        :disabled="!hasMatches"
        @click="emit('next')"
      >
        <AppIcon name="chevron-down" />
      </IconButton>
      <IconButton
        class="search-replace-toggle"
        :accessible-label="replaceExpanded ? '置換欄を閉じる' : '置換欄を表示'"
        :tooltip="replaceExpanded ? '置換欄を閉じる' : '置換欄を表示'"
        :aria-expanded="replaceExpanded"
        aria-controls="markdown-replace-row"
        @click="emit('toggleReplace')"
      >
        <AppIcon name="replace" />
      </IconButton>
      <IconButton
        class="search-close-button"
        accessible-label="検索と置換を閉じる"
        tooltip="閉じる（Esc）"
        @click="emit('close')"
      >
        <AppIcon name="close" />
      </IconButton>
    </div>

    <div
      v-if="replaceExpanded"
      id="markdown-replace-row"
      class="search-replace-row search-replace-row--replace"
    >
      <AppIcon class="search-replace-leading-icon" name="replace" />
      <label class="visually-hidden" for="markdown-replacement-input">置換後の文字列</label>
      <input
        id="markdown-replacement-input"
        ref="replacementInput"
        class="search-replace-input"
        type="text"
        autocomplete="off"
        spellcheck="false"
        placeholder="置換後"
        :value="replacement"
        @input="emit('update:replacement', readInputValue($event))"
        @keydown.enter="moveFromField"
      />
      <div class="search-replace-actions">
        <button
          class="search-action-button"
          type="button"
          :disabled="!hasMatches"
          @click="emit('replaceCurrent')"
        >
          置換
        </button>
        <button
          class="search-action-button"
          type="button"
          :disabled="!hasMatches"
          @click="emit('replaceAll')"
        >
          すべて置換
        </button>
      </div>
      <span class="replacement-notice" aria-live="polite">
        {{ replacementNotice }}
      </span>
    </div>
  </section>
</template>
