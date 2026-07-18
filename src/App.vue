<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import AppIcon from './components/common/AppIcon.vue'
import AppNotice from './components/common/AppNotice.vue'
import IconButton from './components/common/IconButton.vue'
import SettingsPopover from './components/common/SettingsPopover.vue'
import EditorTabs from './components/editor/EditorTabs.vue'
import EditableTabName from './components/editor/EditableTabName.vue'
import FocusModeGuide from './components/editor/FocusModeGuide.vue'
import MarkdownEditor from './components/editor/MarkdownEditor.vue'
import OutputFormatSelect from './components/output/OutputFormatSelect.vue'
import OutputPanel from './components/output/OutputPanel.vue'
import { useClipboard } from './composables/useClipboard'
import { useAppSettings } from './composables/useAppSettings'
import { useEditorTabs } from './composables/useEditorTabs'
import { useFocusMode, type MarkdownEditorController } from './composables/useFocusMode'
import { useOutputFormatPreference } from './composables/useOutputFormatPreference'
import { useThemePreference } from './composables/useThemePreference'
import { useWorkspaceSplitter } from './composables/useWorkspaceSplitter'
import { converterRegistry, outputFormatOptions } from './converters/converterRegistry'
import { parseMarkdown } from './parser/parseMarkdown'
import type { ConversionResult } from './types/conversion'
import { countCharacters } from './utils/countCharacters'

const {
  tabs,
  deletedTabs,
  activeTabId,
  activeTab,
  markdown,
  canAddTab,
  canDeleteTab,
  addTab,
  selectTab,
  renameTab,
  deleteTab,
  restoreTab,
  permanentlyDeleteTab,
} = useEditorTabs()
const { theme } = useThemePreference()
const { selectedFormat } = useOutputFormatPreference()
const { editorInternalScroll, workspaceSplitRatio } = useAppSettings()
const {
  setWorkspaceElement,
  isResizing,
  splitRatioPercent,
  minimumSplitRatioPercent,
  maximumSplitRatioPercent,
  workspaceGridTemplateColumns,
  handlePointerDown: handleSplitterPointerDown,
  handlePointerMove: handleSplitterPointerMove,
  handlePointerEnd: handleSplitterPointerEnd,
  handleKeydown: handleSplitterKeydown,
  resetSplitRatio,
} = useWorkspaceSplitter(workspaceSplitRatio)
const { copy, notice } = useClipboard()
const activePanel = ref<WorkspacePanel>('input')
const markdownEditor = ref<MarkdownEditorController | null>(null)
const {
  isFocusMode,
  isFocusModeHelpOpen,
  enterFocusMode,
  exitFocusMode,
  toggleFocusModeHelp,
} = useFocusMode(markdownEditor, () => {
  activePanel.value = 'input'
})
const inputTab = ref<HTMLButtonElement | null>(null)
const outputTab = ref<HTMLButtonElement | null>(null)
const modalCloseButton = ref<HTMLButtonElement | null>(null)
const isInfoModalOpen = ref<boolean>(false)
let infoTrigger: HTMLElement | null = null
let tabNoticeTimer: ReturnType<typeof setTimeout> | undefined

const TAB_NOTICE_DURATION_MS = 5_000

type TabNotice = {
  kind: 'error'
  message: string
}

const tabNotice = ref<TabNotice | null>(null)

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
const effectiveEditorInternalScroll = computed<boolean>(
  () => isFocusMode.value || editorInternalScroll.value,
)

async function copyOutput(): Promise<void> {
  await copy(conversionResult.value.output, `${formatLabel.value}形式でコピーしました`)
}

function showTabNotice(nextNotice: TabNotice): void {
  tabNotice.value = nextNotice

  if (tabNoticeTimer !== undefined) {
    clearTimeout(tabNoticeTimer)
  }

  tabNoticeTimer = setTimeout(() => {
    tabNotice.value = null
    tabNoticeTimer = undefined
  }, TAB_NOTICE_DURATION_MS)
}

function handleDeleteTab(id: string): void {
  deleteTab(id)
}

function handleRestoreTab(id: string): void {
  const result = restoreTab(id)

  if (result === 'limit') {
    showTabNotice({
      kind: 'error',
      message: 'タブは最大7つまでです。復元するには、現在のタブを1つ削除してください。',
    })
  } else if (result === 'restored') {
    tabNotice.value = null
  }
}

function handlePermanentlyDeleteTab(id: string): void {
  permanentlyDeleteTab(id)
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

onBeforeUnmount(() => {
  if (tabNoticeTimer !== undefined) {
    clearTimeout(tabNoticeTimer)
  }
})
</script>

<template>
  <div
    class="app"
    :class="{
      'app--internal-scroll': effectiveEditorInternalScroll,
      'app--focus-mode': isFocusMode,
    }"
    :data-theme="theme"
  >
    <div
      class="app-content"
      :aria-hidden="isInfoModalOpen ? 'true' : undefined"
      :inert="isInfoModalOpen ? true : undefined"
    >
      <FocusModeGuide
        v-if="isFocusMode"
        :help-open="isFocusModeHelpOpen"
        @exit="exitFocusMode"
        @toggle-help="toggleFocusModeHelp"
      />
      <div v-if="isFocusMode" class="focus-mode-spacer" aria-hidden="true" />

      <header v-show="!isFocusMode" class="app-header">
        <div class="brand-heading">
          <IconButton
            class="focus-mode-button"
            accessible-label="フォーカスモードを開始"
            title="フォーカスモードを開始（Esc）"
            @click="enterFocusMode"
          >
            <AppIcon name="focus" />
          </IconButton>
          <p class="eyebrow brand-title" aria-label="Markdown Converter">
            <span>Markdown</span>
            <span>Converter</span>
          </p>
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
        <AppNotice
          v-if="!isFocusMode && tabNotice"
          class="toast-notice"
          :notice="tabNotice"
        />
        <AppNotice
          v-else-if="!isFocusMode && notice"
          class="toast-notice"
          :notice="notice"
        />
      </Transition>

      <nav v-show="!isFocusMode" class="workspace-tabs" aria-label="編集エリア">
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

      <main
        :ref="setWorkspaceElement"
        class="workspace"
        :class="{
          'workspace--resizing': isResizing,
          'workspace--focus-mode': isFocusMode,
        }"
        :data-active-panel="activePanel"
        :style="isFocusMode ? {} : { gridTemplateColumns: workspaceGridTemplateColumns }"
      >
        <MarkdownEditor
          ref="markdownEditor"
          v-model="markdown"
          :character-count="inputCharacterCount"
          :editor-internal-scroll="effectiveEditorInternalScroll"
          :focus-mode="isFocusMode"
        >
          <template #document-tabs>
            <EditorTabs
              v-if="!isFocusMode"
              :tabs="tabs"
              :deleted-tabs="deletedTabs"
              :active-tab-id="activeTabId"
              :can-add-tab="canAddTab"
              :can-delete-tab="canDeleteTab"
              @add="addTab"
              @select="selectTab"
              @rename="renameTab"
              @delete="handleDeleteTab"
              @restore="handleRestoreTab"
              @permanently-delete="handlePermanentlyDeleteTab"
            />
            <div v-else class="focus-tab-name">
              <EditableTabName
                :tab="activeTab"
                variant="focus"
                @rename="renameTab"
              />
            </div>
          </template>
        </MarkdownEditor>
        <div
          v-show="!isFocusMode"
          class="workspace-splitter"
          role="separator"
          aria-label="左右ペインの幅を調整"
          aria-orientation="vertical"
          :aria-valuemin="minimumSplitRatioPercent"
          :aria-valuemax="maximumSplitRatioPercent"
          :aria-valuenow="splitRatioPercent"
          :aria-valuetext="`左ペイン${splitRatioPercent}%、右ペイン${100 - splitRatioPercent}%`"
          tabindex="0"
          title="ドラッグまたは左右キーで幅を調整（ダブルクリックで均等）"
          @pointerdown="handleSplitterPointerDown"
          @pointermove="handleSplitterPointerMove"
          @pointerup="handleSplitterPointerEnd"
          @pointercancel="handleSplitterPointerEnd"
          @keydown="handleSplitterKeydown"
          @dblclick="resetSplitRatio"
        >
          <span class="workspace-splitter-handle" aria-hidden="true" />
        </div>
        <OutputPanel
          v-show="!isFocusMode"
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
