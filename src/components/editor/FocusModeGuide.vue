<script setup lang="ts">
import AppIcon from '../common/AppIcon.vue'
import IconButton from '../common/IconButton.vue'

defineProps<{
  helpOpen: boolean
}>()

defineEmits<{
  exit: []
  toggleHelp: []
}>()
</script>

<template>
  <aside class="focus-mode-controls" aria-label="フォーカスモード操作">
    <div class="focus-mode-control-buttons">
      <IconButton
        class="focus-mode-exit-button"
        accessible-label="フォーカスモードを終了"
        title="フォーカスモードを終了（Esc）"
        @click="$emit('exit')"
      >
        <AppIcon name="close" />
      </IconButton>
      <IconButton
        class="focus-mode-help-button"
        :accessible-label="helpOpen ? '入力支援の解説を閉じる' : '入力支援の解説を開く'"
        :title="helpOpen ? '入力支援の解説を閉じる' : '入力支援の解説を開く'"
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
      <h2 id="focus-mode-help-title">入力支援</h2>

      <section>
        <h3>装飾ショートカット</h3>
        <dl>
          <div><dt>太字</dt><dd>Ctrl / Command + B</dd></div>
          <div><dt>斜体</dt><dd>Ctrl / Command + I</dd></div>
          <div><dt>インラインコード</dt><dd>Ctrl / Command + E</dd></div>
          <div><dt>リンク</dt><dd>Ctrl / Command + K</dd></div>
          <div><dt>打ち消し線</dt><dd>Ctrl / Command + Shift + X</dd></div>
        </dl>
      </section>

      <section>
        <h3>行の加工</h3>
        <dl>
          <div><dt>番号付きリスト</dt><dd>Ctrl / Command + Shift + 7</dd></div>
          <div><dt>箇条書き</dt><dd>Ctrl / Command + Shift + 8</dd></div>
          <div><dt>引用</dt><dd>Ctrl / Command + Shift + 9</dd></div>
          <div><dt>見出し1</dt><dd>Ctrl + Alt / Command + Option + 1</dd></div>
        </dl>
      </section>

      <section>
        <h3>リスト編集</h3>
        <p>Enterで同じ階層の項目を続け、空の項目ではリストを終了します。</p>
        <p>Tabで2スペース分インデントし、Shift + Tabで階層を戻します。</p>
      </section>

      <section>
        <h3>補足</h3>
        <p>IME変換中は独自のキー操作を実行しません。リスト用のEnterとTab操作はコードフェンス内では実行しません。</p>
      </section>
    </section>
  </aside>
</template>
