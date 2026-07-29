<script setup lang="ts">
defineProps<{
  titleId: string
}>()
</script>

<template>
  <div class="editor-input-guide">
    <h2 :id="titleId">入力支援</h2>

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

    <section>
      <h3>リスト編集</h3>
      <p>Enterで同じ階層の項目を続け、空の項目ではリストを終了します。</p>
      <p>Tabで2スペース分インデントし、Shift + Tabで階層を戻します。</p>
    </section>

    <section>
      <h3>全角Markdown補正</h3>
      <p>
        設定をONにすると、全角で入力したMarkdown記号を、入力直後に半角へ補正します。
      </p>
      <p>コード内の文字と貼り付けた文章には適用しません。</p>
    </section>

    <section>
      <h3>入力置換</h3>
      <p>
        設定で登録した入力文字は、IME確定時またはSpace・全角Space・Enterの入力時に完全一致すると置き換わります。
      </p>
      <p>インラインコードとコードブロック、貼り付けた文章には適用しません。</p>
    </section>

    <section>
      <h3>補足</h3>
      <p>
        IME変換中は独自のキー操作を実行しません。リスト用のEnterとTab操作はコードフェンス内では実行しません。
      </p>
    </section>
  </div>
</template>
