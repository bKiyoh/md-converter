<script setup lang="ts">
defineProps<{
  titleId: string
}>()
</script>

<template>
  <div class="editor-input-guide">
    <h2 :id="titleId">入力支援</h2>

    <section>
      <h3>フォーカスモード</h3>
      <dl>
        <div>
          <dt>編集／プレビュー切り替え</dt>
          <dd>Ctrl / Command + Enter</dd>
        </div>
      </dl>
      <p>フォーカスモード中のみ使用できます。</p>
    </section>

    <section>
      <h3>装飾ショートカット</h3>
      <dl>
        <div>
          <dt>太字</dt>
          <dd>Ctrl / Command + B</dd>
        </div>
        <div>
          <dt>斜体</dt>
          <dd>Ctrl / Command + I</dd>
        </div>
        <div>
          <dt>インラインコード</dt>
          <dd>Ctrl / Command + E</dd>
        </div>
        <div>
          <dt>リンク</dt>
          <dd>Ctrl / Command + K</dd>
        </div>
        <div>
          <dt>打ち消し線</dt>
          <dd>Ctrl / Command + Shift + X</dd>
        </div>
      </dl>
    </section>

    <section>
      <h3>行の加工</h3>
      <dl>
        <div>
          <dt>番号付きリスト</dt>
          <dd>Ctrl / Command + Shift + 7</dd>
        </div>
        <div>
          <dt>箇条書き</dt>
          <dd>Ctrl / Command + Shift + 8</dd>
        </div>
        <div>
          <dt>引用</dt>
          <dd>Ctrl / Command + Shift + 9</dd>
        </div>
        <div>
          <dt>見出し1</dt>
          <dd>Ctrl + Alt / Command + Option + 1</dd>
        </div>
      </dl>
    </section>
  </div>
</template>
