<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  FOCUS_EDITOR_FONT_SIZE_OPTIONS,
  isFocusEditorFontSize,
  type FocusEditorFontSize,
} from '../../utils/focusEditorFontSize'
import AppIcon from '../common/AppIcon.vue'
import IconButton from '../common/IconButton.vue'
import EditorInputGuideContent from './EditorInputGuideContent.vue'

const props = defineProps<{
  helpOpen: boolean
  fontSize: FocusEditorFontSize
}>()

const emit = defineEmits<{
  exit: []
  toggleHelp: []
  'update:fontSize': [value: FocusEditorFontSize]
}>()

const sizeOpen = ref<boolean>(false)
const sizeRoot = ref<HTMLElement | null>(null)
const sizeSelect = ref<HTMLSelectElement | null>(null)

async function toggleSize(): Promise<void> {
  sizeOpen.value = !sizeOpen.value
  if (sizeOpen.value) {
    if (props.helpOpen) emit('toggleHelp')
    await nextTick()
    sizeSelect.value?.focus({ preventScroll: true })
  }
}

function closeSize(restoreFocus = false): void {
  sizeOpen.value = false
  if (restoreFocus) {
    sizeRoot.value?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  }
}

function handleOutsideClick(event: MouseEvent): void {
  if (event.target instanceof Node && !sizeRoot.value?.contains(event.target)) closeSize()
}

function handleFocusOut(event: FocusEvent): void {
  if (!(event.relatedTarget instanceof Node) || !sizeRoot.value?.contains(event.relatedTarget)) {
    closeSize()
  }
}

function handleSizeKeydown(event: KeyboardEvent): void {
  if (!sizeOpen.value || event.defaultPrevented || event.isComposing || event.keyCode === 229) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeSize(true)
  } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    // サイズを選ぶ操作から背面の編集／プレビューを切り替えない。
    event.stopPropagation()
  }
}

function updateSize(event: Event): void {
  const value = Number((event.target as HTMLSelectElement).value)
  if (isFocusEditorFontSize(value)) emit('update:fontSize', value)
}

watch(() => props.helpOpen, (open) => { if (open) closeSize() })
onMounted(() => document.addEventListener('click', handleOutsideClick))
onBeforeUnmount(() => document.removeEventListener('click', handleOutsideClick))
</script>

<template>
  <aside class="focus-mode-controls" aria-label="フォーカスモード操作">
    <div class="focus-mode-control-buttons">
      <IconButton
        class="focus-mode-exit-button"
        accessible-label="フォーカスモードを終了"
        tooltip="フォーカスモードを終了（Esc）"
        @click="$emit('exit')"
      >
        <AppIcon name="close" />
      </IconButton>
      <IconButton
        class="focus-mode-help-button"
        :accessible-label="helpOpen ? '入力支援の解説を閉じる' : '入力支援の解説を開く'"
        :tooltip="helpOpen ? '入力支援の解説を閉じる' : '入力支援の解説を開く'"
        :aria-expanded="helpOpen"
        aria-controls="focus-mode-help"
        @click="$emit('toggleHelp')"
      >
        <AppIcon name="help" />
      </IconButton>
    </div>

    <section
      v-if="helpOpen"
      id="focus-mode-help"
      class="focus-mode-help"
      aria-labelledby="focus-mode-help-title"
    >
      <EditorInputGuideContent title-id="focus-mode-help-title" />
    </section>
  </aside>

  <aside class="focus-mode-font-controls" aria-label="文字サイズ設定">
    <div ref="sizeRoot" class="focus-font-size-root" @focusout="handleFocusOut" @keydown="handleSizeKeydown">
      <IconButton
        class="focus-font-size-button"
        accessible-label="文字サイズ"
        :tooltip="sizeOpen ? undefined : '文字サイズ'"
        :aria-expanded="sizeOpen"
        aria-controls="focus-font-size-panel"
        @click="toggleSize"
      >
        <span aria-hidden="true">Aa</span>
      </IconButton>
      <section
        v-if="sizeOpen"
        id="focus-font-size-panel"
        class="focus-font-size-panel"
        aria-labelledby="focus-font-size-label"
      >
        <label id="focus-font-size-label" for="focus-font-size-select">文字サイズ</label>
        <select
          id="focus-font-size-select"
          ref="sizeSelect"
          :value="fontSize"
          @change="updateSize"
        >
          <option v-for="option in FOCUS_EDITOR_FONT_SIZE_OPTIONS" :key="option.value" :value="option.value">
            {{ option.value }}px
          </option>
        </select>
      </section>
    </div>
  </aside>
</template>
