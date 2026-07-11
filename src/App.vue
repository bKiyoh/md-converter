<script setup lang="ts">
import { computed, ref } from 'vue'
import MarkdownEditor from './components/editor/MarkdownEditor.vue'
import OutputPanel from './components/output/OutputPanel.vue'
import { converterRegistry } from './converters/converterRegistry'
import { parseMarkdown } from './parser/parseMarkdown'
import type { ConversionResult, OutputFormat } from './types/conversion'
import { countCharacters } from './utils/countCharacters'

const markdown = ref('')
const selectedFormat = ref<OutputFormat>('slack')
const isDarkTheme = ref(false)

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
  isDarkTheme.value = !isDarkTheme.value
}
</script>

<template>
  <div class="app" :data-theme="isDarkTheme ? 'dark' : 'light'">
    <header class="app-header">
      <div>
        <p class="eyebrow">Markdown Converter</p>
        <h1>Markdown変換エディタ</h1>
        <p class="app-description">貼り付け先に合わせて、ブラウザ内でリアルタイムに変換します。</p>
      </div>
      <button
        class="theme-button"
        type="button"
        :aria-pressed="isDarkTheme"
        @click="toggleTheme"
      >
        {{ isDarkTheme ? 'ライトモード' : 'ダークモード' }}
      </button>
    </header>

    <main class="workspace">
      <MarkdownEditor
        v-model="markdown"
        :character-count="inputCharacterCount"
      />
      <OutputPanel
        :format="selectedFormat"
        :output="conversionResult.output"
        :character-count="outputCharacterCount"
        :warnings="conversionResult.warnings"
        @update:format="selectedFormat = $event"
      />
    </main>
  </div>
</template>
