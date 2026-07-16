<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import AppIcon from './components/common/AppIcon.vue'
import AppNotice from './components/common/AppNotice.vue'
import IconButton from './components/common/IconButton.vue'
import SettingsPopover from './components/common/SettingsPopover.vue'
import MarkdownEditor from './components/editor/MarkdownEditor.vue'
import OutputFormatSelect from './components/output/OutputFormatSelect.vue'
import OutputPanel from './components/output/OutputPanel.vue'
import { useClipboard } from './composables/useClipboard'
import { useAppSettings } from './composables/useAppSettings'
import { useMarkdownDraft } from './composables/useMarkdownDraft'
import { useOutputFormatPreference } from './composables/useOutputFormatPreference'
import { useThemePreference } from './composables/useThemePreference'
import { converterRegistry, outputFormatOptions } from './converters/converterRegistry'
import { parseMarkdown } from './parser/parseMarkdown'
import type { ConversionResult } from './types/conversion'
import { countCharacters } from './utils/countCharacters'

const { markdown } = useMarkdownDraft()
const { theme } = useThemePreference()
const { selectedFormat } = useOutputFormatPreference()
const { editorInternalScroll } = useAppSettings()
const { copy, notice } = useClipboard()
const activePanel = ref<WorkspacePanel>('input')
const inputTab = ref<HTMLButtonElement | null>(null)
const outputTab = ref<HTMLButtonElement | null>(null)
const modalCloseButton = ref<HTMLButtonElement | null>(null)
const isInfoModalOpen = ref<boolean>(false)
let infoTrigger: HTMLElement | null = null

type WorkspacePanel = 'input' | 'output'

const conversionResult = computed<ConversionResult>(() => {
  try {
    const document = parseMarkdown(markdown.value)
    return converterRegistry[selectedFormat.value].convert(document)
  } catch {
    return {
      output: '',
      warnings: [
        {
          code: 'invalid-structure',
          message:
            '予期しないエラーが発生し、変換を完了できませんでした。入力内容は保持されています。',
        },
      ],
    }
  }
})

const inputCharacterCount = computed<number>(() => countCharacters(markdown.value))
const outputCharacterCount = computed<number>(() =>
  countCharacters(conversionResult.value.output),
)
const formatLabel = computed<string>(
  () => outputFormatOptions.find((option) => option.value === selectedFormat.value)?.label ?? '',
)
const copySucceeded = computed<boolean>(() => notice.value?.kind === 'success')

async function copyOutput(): Promise<void> {
  await copy(conversionResult.value.output, `${formatLabel.value}形式でコピーしました`)
}

async function openInfoModal(event: MouseEvent): Promise<void> {
  infoTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  isInfoModalOpen.value = true
  await nextTick()
  modalCloseButton.value?.focus()
}

async function closeInfoModal(): Promise<void> {
  isInfoModalOpen.value = false
  await nextTick()
  infoTrigger?.focus()
}

function handleInfoModalKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    void closeInfoModal()
  } else if (event.key === 'Tab') {
    event.preventDefault()
    modalCloseButton.value?.focus()
  }
}

function selectPanel(panel: WorkspacePanel): void {
  activePanel.value = panel
}

async function selectPanelAndFocus(panel: WorkspacePanel): Promise<void> {
  selectPanel(panel)
  await nextTick()
  const target = panel === 'input' ? inputTab.value : outputTab.value
  target?.focus()
}

function handleTabKeydown(event: KeyboardEvent, currentPanel: WorkspacePanel): void {
  let nextPanel: WorkspacePanel | null = null

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    nextPanel = currentPanel === 'input' ? 'output' : 'input'
  } else if (event.key === 'Home') {
    nextPanel = 'input'
  } else if (event.key === 'End') {
    nextPanel = 'output'
  }

  if (nextPanel) {
    event.preventDefault()
    void selectPanelAndFocus(nextPanel)
  }
}
</script>

<template>
  <div class="app" :data-theme="theme">
    <div
      class="app-content"
      :aria-hidden="isInfoModalOpen ? 'true' : undefined"
      :inert="isInfoModalOpen ? true : undefined"
    >
      <header class="app-header">
        <div class="brand-heading">
          <p class="eyebrow">Markdown Converter</p>
          <IconButton
            class="info-button"
            accessible-label="このアプリについて"
            title="このアプリについて"
            @click="openInfoModal"
          >
            <AppIcon name="info" />
          </IconButton>
          <SettingsPopover
            :dark-mode="theme === 'dark'"
            :editor-internal-scroll="editorInternalScroll"
            @update:dark-mode="theme = $event ? 'dark' : 'light'"
            @update:editor-internal-scroll="editorInternalScroll = $event"
          />
        </div>
        <div class="app-header-actions">
          <div class="header-output-actions">
            <OutputFormatSelect v-model="selectedFormat" />
            <IconButton
              class="copy-button"
              accessible-label="変換結果をコピー"
              :title="copySucceeded ? 'コピーしました' : 'コピー'"
              :disabled="conversionResult.output.length === 0"
              @click="copyOutput"
            >
              <AppIcon :name="copySucceeded ? 'check' : 'copy'" />
            </IconButton>
          </div>
        </div>
      </header>

      <Transition name="toast">
        <AppNotice v-if="notice" class="toast-notice" :notice="notice" />
      </Transition>

      <nav class="workspace-tabs" aria-label="編集エリア">
        <div
          class="workspace-tablist"
          role="tablist"
          aria-label="表示する編集エリア"
          aria-orientation="horizontal"
        >
          <button
            id="input-tab"
            ref="inputTab"
            class="workspace-tab"
            :class="{ 'workspace-tab--active': activePanel === 'input' }"
            type="button"
            role="tab"
            aria-controls="input-panel"
            :aria-selected="activePanel === 'input'"
            :tabindex="activePanel === 'input' ? 0 : -1"
            @click="selectPanel('input')"
            @keydown="handleTabKeydown($event, 'input')"
          >
            入力
          </button>
          <button
            id="output-tab"
            ref="outputTab"
            class="workspace-tab"
            :class="{ 'workspace-tab--active': activePanel === 'output' }"
            type="button"
            role="tab"
            aria-controls="output-panel"
            :aria-selected="activePanel === 'output'"
            :tabindex="activePanel === 'output' ? 0 : -1"
            @click="selectPanel('output')"
            @keydown="handleTabKeydown($event, 'output')"
          >
            変換結果
          </button>
        </div>
      </nav>

      <main class="workspace" :data-active-panel="activePanel">
        <MarkdownEditor
          v-model="markdown"
          :character-count="inputCharacterCount"
          :editor-internal-scroll="editorInternalScroll"
        />
        <OutputPanel
          :markdown="markdown"
          :output="conversionResult.output"
          :character-count="outputCharacterCount"
          :warnings="conversionResult.warnings"
          :editor-internal-scroll="editorInternalScroll"
        />
      </main>
    </div>

    <div
      v-if="isInfoModalOpen"
      class="modal-backdrop"
      @click.self="closeInfoModal"
    >
      <section
        class="info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-modal-title"
        aria-describedby="info-modal-description info-modal-privacy"
        @keydown="handleInfoModalKeydown"
      >
        <h2 id="info-modal-title">Markdown変換エディタ</h2>
        <p id="info-modal-description">
          貼り付け先に合わせて、ブラウザ内でリアルタイムに変換します。
        </p>
        <p id="info-modal-privacy">
          入力内容と設定はこのブラウザのLocalStorageに保存され、外部サーバーには送信されません。ブラウザのサイトデータを削除すると、保存内容も削除されます。
        </p>
        <button
          ref="modalCloseButton"
          class="modal-close-button"
          type="button"
          @click="closeInfoModal"
        >
          閉じる
        </button>
      </section>
    </div>
  </div>
</template>
