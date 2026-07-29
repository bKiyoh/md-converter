<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import { useMarkdownEditor } from '../../composables/useMarkdownEditor'
import {
  useTextSearch,
  type TextSearchEdit,
} from '../../composables/useTextSearch'
import { tooltipDirective as vTooltip } from '../../directives/tooltip'
import type { MarkdownEditorViewState } from '../../types/editorView'
import type { InputReplacementRule } from '../../types/inputReplacement'
import type { TextEditResult } from '../../utils/markdownEditor'
import type { TextMatch } from '../../utils/textSearch'
import EditorInputGuideContent from './EditorInputGuideContent.vue'
import SearchReplacePanel from './SearchReplacePanel.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    characterCount: number
    editorInternalScroll: boolean
    focusMode?: boolean
    activeTabId?: string
    shortcutsEnabled?: boolean
    inputReplacementEnabled?: boolean
    inputReplacementRules?: readonly InputReplacementRule[]
    normalizeFullWidthMarkdown?: boolean
  }>(),
  {
    focusMode: false,
    activeTabId: 'default',
    shortcutsEnabled: true,
    inputReplacementEnabled: true,
    inputReplacementRules: () => [],
    normalizeFullWidthMarkdown: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'request-search': [showReplace: boolean]
}>()

type SearchHighlightSegment = {
  text: string
  kind: 'plain' | 'match' | 'current'
}

const textarea = ref<HTMLTextAreaElement | null>(null)
const searchHighlightLayer = ref<HTMLDivElement | null>(null)
const inputGuideButton = ref<HTMLButtonElement | null>(null)
const searchPanel = ref<InstanceType<typeof SearchReplacePanel> | null>(null)
const isInputGuideOpen = ref<boolean>(false)
const isSearchOpen = ref<boolean>(false)
const isReplaceExpanded = ref<boolean>(false)
const source = computed<string>(() => props.modelValue)
const documentKey = computed<string>(() => props.activeTabId)

function getMinimalTextEdit(
  currentValue: string,
  nextValue: string,
): { start: number; end: number; replacement: string } {
  let start = 0
  const maximumPrefix = Math.min(currentValue.length, nextValue.length)

  while (
    start < maximumPrefix &&
    currentValue[start] === nextValue[start]
  ) {
    start += 1
  }

  let currentEnd = currentValue.length
  let nextEnd = nextValue.length
  while (
    currentEnd > start &&
    nextEnd > start &&
    currentValue[currentEnd - 1] === nextValue[nextEnd - 1]
  ) {
    currentEnd -= 1
    nextEnd -= 1
  }

  return {
    start,
    end: currentEnd,
    replacement: nextValue.slice(start, nextEnd),
  }
}

async function applyEditorTextEdit(
  element: HTMLTextAreaElement,
  result: TextEditResult,
): Promise<void> {
  const currentValue = element.value
  const edit = getMinimalTextEdit(currentValue, result.value)
  element.focus({ preventScroll: true })
  element.setSelectionRange(edit.start, edit.end)

  let inputEventReceived = false
  const observeInput = (): void => {
    inputEventReceived = true
  }
  element.addEventListener('input', observeInput, { once: true })

  let insertedWithNativeHistory = false
  try {
    insertedWithNativeHistory =
      typeof document.execCommand === 'function' &&
      document.execCommand('insertText', false, edit.replacement)
  } catch {
    insertedWithNativeHistory = false
  }

  element.removeEventListener('input', observeInput)

  if (!insertedWithNativeHistory || element.value !== result.value) {
    element.value = currentValue
    element.setRangeText(edit.replacement, edit.start, edit.end, 'end')
    emit('update:modelValue', element.value)
  } else if (!inputEventReceived) {
    emit('update:modelValue', element.value)
  }

  await nextTick()
  element.focus({ preventScroll: true })
  element.setSelectionRange(result.selectionStart, result.selectionEnd)
  resizeTextarea()
}

function closeInputGuide(): void {
  isInputGuideOpen.value = false
}

function toggleInputGuide(): void {
  isInputGuideOpen.value = !isInputGuideOpen.value
}

async function applySearchEdit(edit: TextSearchEdit): Promise<void> {
  const element = textarea.value

  if (!element) {
    emit('update:modelValue', edit.value)
    await nextTick()
    return
  }

  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  await applyEditorTextEdit(element, {
    value: edit.value,
    selectionStart: edit.start + edit.replacement.length,
    selectionEnd: edit.start + edit.replacement.length,
  })

  if (previouslyFocused && previouslyFocused !== element && previouslyFocused.isConnected) {
    previouslyFocused.focus({ preventScroll: true })
  }
}

const {
  query,
  replacement,
  matches,
  currentMatch,
  resultStatus,
  replacementNotice,
  moveNext,
  movePrevious,
  replaceCurrent,
  replaceAll,
} = useTextSearch({
  source,
  documentKey,
  applyEdit: applySearchEdit,
})

const searchHighlightSegments = computed<SearchHighlightSegment[]>(() => {
  const segments: SearchHighlightSegment[] = []
  const activeMatch = currentMatch.value
  let offset = 0

  for (const match of matches.value) {
    if (match.start > offset) {
      segments.push({
        text: props.modelValue.slice(offset, match.start),
        kind: 'plain',
      })
    }

    segments.push({
      text: props.modelValue.slice(match.start, match.end),
      kind:
        activeMatch?.start === match.start && activeMatch.end === match.end
          ? 'current'
          : 'match',
    })
    offset = match.end
  }

  if (offset < props.modelValue.length) {
    segments.push({
      text: props.modelValue.slice(offset),
      kind: 'plain',
    })
  }

  return segments
})

function syncSearchHighlightScroll(): void {
  const element = textarea.value
  const highlightLayer = searchHighlightLayer.value

  if (!element || !highlightLayer) {
    return
  }

  highlightLayer.scrollTop = element.scrollTop
  highlightLayer.scrollLeft = element.scrollLeft
}

function scrollCurrentMatchIntoView(): void {
  const element = textarea.value
  const highlightLayer = searchHighlightLayer.value
  const currentHighlight =
    highlightLayer?.querySelector<HTMLElement>('.search-highlight--current')

  if (!element || !highlightLayer || !currentHighlight) {
    return
  }

  const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight)
  const matchHeight = Math.max(
    currentHighlight.offsetHeight,
    Number.isFinite(lineHeight) ? lineHeight : 0,
    1,
  )
  const matchTop = currentHighlight.offsetTop
  const matchBottom = matchTop + matchHeight
  const visibleTop = element.scrollTop
  const visibleBottom = visibleTop + element.clientHeight

  if (
    element.clientHeight > 0 &&
    (matchTop < visibleTop || matchBottom > visibleBottom)
  ) {
    const centeredOffset = Math.max(
      0,
      (element.clientHeight - Math.min(matchHeight, element.clientHeight)) / 2,
    )
    element.scrollTop = Math.max(0, matchTop - centeredOffset)
    syncSearchHighlightScroll()
  }

  if (props.editorInternalScroll) {
    return
  }

  const matchRect = currentHighlight.getBoundingClientRect()
  const viewportHeight =
    document.documentElement.clientHeight || window.innerHeight

  if (
    viewportHeight > 0 &&
    (matchRect.top < 0 || matchRect.bottom > viewportHeight)
  ) {
    window.scrollBy({
      top: matchRect.top - (viewportHeight - matchRect.height) / 2,
      behavior: 'auto',
    })
  }
}

async function selectTextMatch(match: TextMatch): Promise<void> {
  await nextTick()
  const element = textarea.value

  if (!element || !isSearchOpen.value) {
    return
  }

  element.setSelectionRange(match.start, match.end)
  scrollCurrentMatchIntoView()
}

async function openSearch(showReplace = false): Promise<void> {
  closeInputGuide()
  isSearchOpen.value = true
  isReplaceExpanded.value = showReplace

  await nextTick()

  if (currentMatch.value) {
    await selectTextMatch(currentMatch.value)
  }

  if (showReplace) {
    await searchPanel.value?.focusReplacement()
  } else {
    await searchPanel.value?.focusSearch()
  }
}

async function closeSearch(): Promise<void> {
  if (!isSearchOpen.value) {
    return
  }

  isSearchOpen.value = false
  await nextTick()
  textarea.value?.focus({ preventScroll: true })
}

async function toggleReplace(): Promise<void> {
  isReplaceExpanded.value = !isReplaceExpanded.value
  await nextTick()

  if (isReplaceExpanded.value) {
    await searchPanel.value?.focusReplacement()
  } else {
    await searchPanel.value?.focusSearch()
  }
}

function isSearchShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === 'f' &&
    !event.altKey &&
    !event.shiftKey &&
    (event.ctrlKey || event.metaKey)
  )
}

function isReplaceShortcut(event: KeyboardEvent): boolean {
  return (
    (event.key.toLowerCase() === 'h' &&
      event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey) ||
    (event.key.toLowerCase() === 'f' &&
      event.metaKey &&
      event.altKey &&
      !event.ctrlKey &&
      !event.shiftKey)
  )
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    !textarea.value?.isConnected
  ) {
    return
  }

  if (props.shortcutsEnabled && isReplaceShortcut(event)) {
    event.preventDefault()
    emit('request-search', true)
    return
  }

  if (props.shortcutsEnabled && isSearchShortcut(event)) {
    event.preventDefault()
    emit('request-search', false)
    return
  }

  if (event.key !== 'Escape') {
    return
  }

  if (isSearchOpen.value) {
    event.preventDefault()
    void closeSearch()
    return
  }

  if (isInputGuideOpen.value) {
    event.preventDefault()
    closeInputGuide()
    void nextTick(() => inputGuideButton.value?.focus())
  }
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
    syncSearchHighlightScroll()
    return
  }

  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
  syncSearchHighlightScroll()
}

async function updateValue(event: Event): Promise<void> {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  await nextTick()
  resizeTextarea()
}

const {
  handleKeydown,
  handleBeforeInput,
  handleCompositionStart,
  handleCompositionEnd,
} = useMarkdownEditor({
  getInputReplacement: () => ({
    enabled: props.inputReplacementEnabled,
    rules: props.inputReplacementRules,
  }),
  getFullWidthMarkdownNormalizationEnabled: () =>
    props.normalizeFullWidthMarkdown,
  applyTextEdit: applyEditorTextEdit,
})

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

watch(currentMatch, (match) => {
  if (match) {
    void selectTextMatch(match)
  }
})

watch(
  [matches, isSearchOpen],
  () => {
    void nextTick(syncSearchHighlightScroll)
  },
  { flush: 'post' },
)

onMounted(() => {
  resizeTextarea()
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleDocumentKeydown)
})

defineExpose({ captureViewState, restoreViewState, isConnected, openSearch })
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

    <SearchReplacePanel
      v-if="isSearchOpen"
      ref="searchPanel"
      :query="query"
      :replacement="replacement"
      :replace-expanded="isReplaceExpanded"
      :result-status="resultStatus"
      :replacement-notice="replacementNotice"
      :has-matches="matches.length > 0"
      @update:query="query = $event"
      @update:replacement="replacement = $event"
      @previous="movePrevious"
      @next="moveNext"
      @toggle-replace="toggleReplace"
      @replace-current="replaceCurrent"
      @replace-all="replaceAll"
      @close="closeSearch"
    />

    <label class="visually-hidden" for="markdown-input">変換するMarkdown</label>
    <div
      class="text-area-shell"
      :class="
        [
          editorInternalScroll
            ? 'text-area-shell--internal-scroll'
            : 'text-area-shell--expand',
          {
            'text-area-shell--highlighting':
              isSearchOpen && matches.length > 0,
          },
        ]
      "
    >
      <div
        v-if="isSearchOpen && matches.length > 0"
        ref="searchHighlightLayer"
        class="search-highlight-layer"
        aria-hidden="true"
      >
        <template
          v-for="(segment, index) in searchHighlightSegments"
          :key="index"
        >
          <mark
            v-if="segment.kind !== 'plain'"
            class="search-highlight"
            :class="`search-highlight--${segment.kind}`"
            v-text="segment.text"
          />
          <span v-else v-text="segment.text" />
        </template>
        <span v-if="modelValue.endsWith('\n')">&#8203;</span>
      </div>

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
        @beforeinput="handleBeforeInput"
        @compositionstart="handleCompositionStart"
        @compositionend="handleCompositionEnd"
        @keydown="handleKeydown"
        @scroll="syncSearchHighlightScroll"
      />
    </div>

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
          v-tooltip="'文章検索（Ctrl / Command + F）'"
          class="editor-search-button"
          type="button"
          aria-label="文章検索を開く"
          @click="openSearch(false)"
        >
          <AppIcon name="search" />
        </button>
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
