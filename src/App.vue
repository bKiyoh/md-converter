<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import MarkdownEditor from './components/editor/MarkdownEditor.vue'
import OutputPanel from './components/output/OutputPanel.vue'
import { useMarkdownDraft } from './composables/useMarkdownDraft'
import { useThemePreference } from './composables/useThemePreference'
import { converterRegistry } from './converters/converterRegistry'
import { parseMarkdown } from './parser/parseMarkdown'
import type { ConversionResult, OutputFormat } from './types/conversion'
import { countCharacters } from './utils/countCharacters'

const { markdown } = useMarkdownDraft()
const { theme } = useThemePreference()
const selectedFormat = ref<OutputFormat>('slack')
const activePanel = ref<WorkspacePanel>('input')
const inputTab = ref<HTMLButtonElement | null>(null)
const outputTab = ref<HTMLButtonElement | null>(null)

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
          message: 'Markdownを変換できませんでした。入力内容を確認してください。',
        },
      ],
    }
  }
})

const inputCharacterCount = computed<number>(() => countCharacters(markdown.value))
const outputCharacterCount = computed<number>(() =>
  countCharacters(conversionResult.value.output),
)

function toggleTheme(): void {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
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
    <header class="app-header">
      <div>
        <p class="eyebrow">Markdown Converter</p>
        <h1>Markdown変換エディタ</h1>
        <p class="app-description">貼り付け先に合わせて、ブラウザ内でリアルタイムに変換します。</p>
      </div>
      <button
        class="theme-button"
        type="button"
        :aria-pressed="theme === 'dark'"
        @click="toggleTheme"
      >
        {{ theme === 'dark' ? 'ライトモード' : 'ダークモード' }}
      </button>
    </header>

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
      />
      <OutputPanel
        :markdown="markdown"
        :format="selectedFormat"
        :output="conversionResult.output"
        :character-count="outputCharacterCount"
        :warnings="conversionResult.warnings"
        @update:format="selectedFormat = $event"
      />
    </main>
  </div>
</template>
