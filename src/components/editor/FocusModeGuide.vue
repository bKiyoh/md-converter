<script setup lang="ts">
import AppIcon from '../common/AppIcon.vue'
import IconButton from '../common/IconButton.vue'
import EditorInputGuideContent from './EditorInputGuideContent.vue'

defineProps<{
  helpOpen: boolean
}>()

defineEmits<{
  exit: []
  search: []
  toggleHelp: []
}>()
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
        class="focus-mode-search-button"
        accessible-label="文章検索を開く"
        tooltip="文章検索（Ctrl / Command + F）"
        @click="$emit('search')"
      >
        <AppIcon name="search" />
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
</template>
