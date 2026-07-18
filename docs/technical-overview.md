# 正規表現だけに頼らないMarkdown変換アプリの設計

Markdownで書いた文章をSlackへ貼り付けると、見出しや表が期待どおりに表示されない。Backlogでも、Markdown記法を使うプロジェクトとBacklog記法を使うプロジェクトでは、同じ入力をそのまま再利用できない。

Markdown Converterは、こうした「文章の内容は同じなのに、貼り付け先ごとに記法が違う」という問題を解決するVue 3製のWebアプリである。Markdownを入力すると、Slack、Backlog Markdown、Backlog記法、プレーンテキストへリアルタイムに変換できる。

一見すると文字列置換で作れそうなアプリだが、実装の中心にあるのは置換処理ではない。本アプリではMarkdownを構文解析し、アプリ固有の中間表現へ正規化してから、出力先ごとのConverterで再構築する。本稿では、その設計を採用した理由と、変換時の情報損失、安全なプレビュー、ブラウザ内保存、テストをどのように扱っているかを解説する。

## アプリの要件

本アプリが扱う主なMarkdown要素は、見出し、段落、太字、斜体、打ち消し線、リスト、チェックリスト、引用、コード、リンク、テーブル、水平線、改行である。入力方言はCommonMarkを基礎としたGitHub Flavored Markdown（GFM）としている。

設計上、特に重要な要件は次の3点だった。

1. コードブロック内のMarkdown記号を誤変換しないこと
2. 出力先で表現できない情報を黙って捨てないこと
3. 入力、変換、保存をブラウザ内で完結させること

たとえば、次のコードブロックに含まれる`**`や`#`は、太字や見出しではなくコード本文である。

````md
```ts
const heading = "# 見出しではない"
const strong = "**太字ではない**"
```
````

Markdown全体へ正規表現を順番に適用すると、このような文脈を正しく判断するのが難しい。装飾の入れ子、ネストしたリスト、テーブル、参照形式リンクまで加わると、置換順序への依存も増えていく。そのため、本アプリでは構文を先に理解し、意味の単位ごとに変換する構成を採用した。

## 全体アーキテクチャ

変換処理の流れは次のとおりである。

```text
Markdown文字列
    │
    ▼
unified + remark-parse + remark-gfm
    │
    ▼
mdast
    │
    ▼
normalizeMarkdownAst
    │
    ▼
アプリ固有のMarkdownDocument
    │
    ├── Slack Converter
    ├── Backlog Markdown Converter
    ├── Backlog記法 Converter
    ├── Plain Text Converter
    └── Markdown Preview Renderer
```

Vueコンポーネントは変換規則を持たない。`App.vue`は入力文字列をパーサーへ渡し、選択されたConverterをレジストリから取得して結果を表示するだけである。

```ts
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
```

この分離により、変換規則の単体テストにVueを起動する必要がなく、UIを変更してもConverterへ影響しない。

## mdastをそのまま公開しない理由

Markdown解析には`unified`、`remark-parse`、`remark-gfm`を使用している。これらが生成するmdastは表現力が高く、GFMのテーブル、チェックリスト、打ち消し線も扱える。

ただし、Converterへmdastを直接渡してはいない。パーサー固有の型や細かな仕様がアプリ全体へ広がると、依存ライブラリの変更がすべてのConverterへ波及するためである。そこで、mdastと変換処理の間に`normalizeMarkdownAst`を置き、MVPで必要な情報だけを`MarkdownDocument`へ移す。

```ts
export type MarkdownDocument = {
  blocks: BlockNode[]
}

export type BlockNode =
  | HeadingNode
  | ParagraphNode
  | ListNode
  | QuoteNode
  | CodeBlockNode
  | TableNode
  | ThematicBreakNode

export type InlineNode =
  | TextNode
  | StrongNode
  | EmphasisNode
  | DeleteNode
  | InlineCodeNode
  | LinkNode
  | LineBreakNode
```

中間表現には、単に表示文字列だけでなく、変換時に必要になる構造も保持する。

- 見出しレベル
- リストの順序種別、開始番号、ネスト、チェック状態
- コードブロックの言語名とメタ情報
- テーブルのヘッダー、行、列配置
- ソフト改行と明示的な改行の違い
- 元のMarkdownにおける開始行と列

ここで情報を落としすぎると、後段のConverterは正しい出力を作れない。たとえば、番号付きリストの開始番号を保持しなければ、`3.`から始まるリストを再構築できない。ソフト改行と明示改行を同一視すれば、Backlog Markdownで行末2スペースを再現できない。

一方で、HTML、画像、脚注などMVP対象外の要素までは先回りして抽象化していない。中間表現を「何でも入る汎用AST」にせず、現在必要な意味だけを型で表すことで、各Converterの分岐を網羅的に保てる。

## 正規化層が吸収する差分

正規化層には、mdastを型変換する以上の役割がある。

### 参照形式リンクの解決

次の2つはMarkdown上の書き方は違うが、変換先から見れば同じリンクである。

```md
[公式サイト](https://example.com)

[公式サイト][site]
[site]: https://example.com
```

正規化時に文書内の定義を収集し、どちらも`LinkNode`へ変換する。Converterは参照形式かインライン形式かを意識せず、表示名、URL、タイトルだけを扱える。

### 改行の明示化

mdastでは段落内のソフト改行がテキストノード中の改行として現れる。本アプリはテキストを行ごとに分割し、`kind: 'soft' | 'hard'`を持つ`LineBreakNode`へ正規化する。

この処理により、Converter側で文字列を再解析せず、出力先の規則に合わせて改行を描画できる。

### ソース位置の保持

各ノードは、取得できる場合に元入力の`line`と`column`を保持する。これは構文解析のためではなく、変換警告をユーザーが修正可能な情報にするためである。

## 出力先ごとにConverterを分離する

すべてのConverterは共通のインターフェースを実装する。

```ts
export interface Converter {
  readonly format: OutputFormat
  convert(document: MarkdownDocument): ConversionResult
}

export type ConversionResult = {
  output: string
  warnings: ConversionWarning[]
}
```

利用側は`converterRegistry`から出力形式に対応する実装を取り出す。

```ts
export const converterRegistry: Readonly<Record<OutputFormat, Converter>> = {
  slack: slackConverter,
  'backlog-markdown': backlogMarkdownConverter,
  'backlog-notation': backlogNotationConverter,
  'plain-text': plainTextConverter,
}
```

4形式には似た処理もあるが、記法上の制約は異なる。共通レンダラーへ条件分岐を集めるのではなく、Converterを分けることで、各サービスの仕様を実装とテストの単位にしている。

### ノードを再帰的に描画する

Converterはブロック要素とインライン要素を、それぞれ判別可能なUnion型として再帰的に描画する。Slack Converterのインライン描画を簡略化すると、次のような形になる。

```ts
function renderInlineNode(node: InlineNode): string {
  switch (node.type) {
    case 'text':
      return node.value
    case 'strong':
      return `*${renderInlineNodes(node.children)}*`
    case 'emphasis':
      return `_${renderInlineNodes(node.children)}_`
    case 'delete':
      return `~${renderInlineNodes(node.children)}~`
    case 'inlineCode':
      return `\`${node.value}\``
    case 'link':
      return `[${renderInlineNodes(node.children)}](${node.url})`
    case 'lineBreak':
      return '\n'
  }
}
```

コードブロックは`CodeBlockNode`として独立しているため、本文に含まれるMarkdown記号へインライン描画が適用されることはない。これが、正規表現による一括変換との大きな違いである。

### 同じ要素でも出力は異なる

たとえば見出し`# リリース情報`は、各形式で次のように変わる。

| 出力形式 | 出力例 | 補足 |
| --- | --- | --- |
| Slack | `*リリース情報*` | 見出しレベルは失われる |
| Backlog Markdown | `# リリース情報` | レベル1〜6を保持する |
| Backlog記法 | `* リリース情報` | 公式に確認できるのはレベル1〜3 |
| プレーンテキスト | `【リリース情報】` | レベル情報は失われる |

SlackではMarkdownテーブルを直接表現できないため、パイプ区切りのコードブロックへ変換する。Backlog Markdownでは列配置を含むGFMテーブルを再構築し、Backlog記法ではヘッダー行末に`h`を付ける。プレーンテキストではセル内容をタブ区切りで残す。

このように、変換は記号の対応表を適用するだけではない。「変換先で意味をどのように残すか」を形式ごとに決める処理である。

## 情報損失を警告として返す

異なる記法間の変換では、完全な対応が存在しないことがある。本アプリは無理に同じ見た目を作るのではなく、次の優先順位で扱う。

1. 意味を維持できる代替表現へ変換する
2. プレーンテキストとして内容を残す
3. 失われた情報を警告する

警告は例外やログではなく、`ConversionResult`の一部である。

```ts
export type ConversionWarning = {
  code: 'unsupported-node' | 'lossy-conversion' | 'invalid-structure'
  message: string
  location?: SourceLocation
}
```

たとえばSlackの見出しは太字へ変換できるが、見出しレベルという構造は失われる。そのため、出力自体は生成しつつ「Slackでは見出しレベルを表現できないため、太字に変換しました」という警告を返す。

この設計には二つの利点がある。第一に、変換可能な本文をユーザーから奪わない。第二に、UIが警告件数、内容、発生位置を表示できる。現在の画面では同じ文言をまとめつつ、発生件数と取得できた位置を一覧表示する。

警告を乱発しないことも重要である。たとえばプレーンテキスト変換で太字記号を除去するのは、その形式として期待された通常動作なので警告しない。リンクタイトルや見出しレベルなど、実際に情報が失われるときだけ警告する。

## 安全なMarkdownプレビュー

プレビューは変換結果とは別の利用者だが、同じ`MarkdownDocument`を再利用している。ただし、プレビュー用の解析では生HTMLノードを破棄する。

```ts
export function parseMarkdownForPreview(markdown: string): MarkdownDocument {
  const tree = markdownParser.parse(markdown) as Root
  return normalizeMarkdownAst(tree, { ignoreHtml: true })
}
```

HTML生成には汎用のMarkdown-to-HTML変換結果をそのまま使わず、許可した中間表現だけを専用レンダラーで描画する。テキスト、コード、属性値はHTMLエスケープし、リンクURLは次の種類だけを許可する。

- 相対URLとフラグメント
- `http`
- `https`
- `mailto`
- `tel`

`javascript:`など許可していないスキームでは、リンク要素を作らず表示テキストだけを残す。このため、Vue側でHTMLを表示する箇所があっても、入力された生HTMLや危険なURLを実行可能なDOMとして出力しない。

## Vue側は状態の組み合わせに集中する

UIにはVue 3のComposition APIを使用しているが、MVPではPiniaを導入していない。状態の共有範囲がアプリ全体のストアを必要とするほど大きくなく、入力、テーマ、設定、コピーなどをComposable単位で分ければ責務を保てるためである。

主な分担は次のようになっている。

| Composable / Utility | 責務 |
| --- | --- |
| `useEditorTabs` | Markdownタブの追加、選択、名称変更、削除、復元 |
| `useEditorStorage` | タブ状態の検証、移行、復元、即時・デバウンス保存 |
| `useThemePreference` | ライト・ダーク設定の復元と保存 |
| `useOutputFormatPreference` | 選択中の変換形式の検証、復元、保存 |
| `useAppSettings` | エディター表示設定と左右ペイン比率の復元・保存 |
| `useWorkspaceSplitter` | PC表示の区切りバー操作、最小幅、比率計算 |
| `useClipboard` | コピー処理と成功・失敗通知 |
| `useMarkdownEditor` | textareaのキー操作と選択範囲の復元 |
| `markdownEditor.ts` | ショートカットやリスト編集の純粋な文字列操作 |

`App.vue`はこれらを組み合わせ、入力と選択形式から変換結果を`computed`で導出する。変換結果そのものを別の状態として保存しないため、入力と出力の不整合が起きにくい。

## LocalStorage障害を通常系から切り離す

Markdown入力とテーマは変更から500ミリ秒後に保存する。入力のたびに同期的なStorage書き込みを行わず、最後の変更をまとめるためである。タブ追加・切り替え・名称変更・削除・復元・完全削除、変換形式、アプリ設定は、変更直後の再読み込みでも状態を失わないよう即時保存している。

テーマ、変換形式、アプリ設定の保存は汎用の`useDebouncedLocalStorage`へ集約した。複数タブの版付きJSON、旧単一文書からの移行、削除済みタブの期限処理は`useEditorStorage`へ分離した。

```ts
try {
  storage.setItem(options.key, options.serialize(value.value))
} catch {
  // Storageが利用できなくても、画面上の状態と操作は継続させる。
}
```

LocalStorageはブラウザ設定、容量制限、プライベートブラウジングなどの影響で例外を投げる可能性がある。本アプリでは保存失敗を編集失敗にしない。読み込みに失敗した場合は初期値へ戻り、書き込みに失敗した場合もVue上の状態は維持する。

保存キーには`v1`を付けている。

| 保存対象 | キー |
| --- | --- |
| Markdownタブ、選択中のタブ、削除済みタブ | `markdown-editor-state-v1` |
| テーマ | `md-converter:theme:v1` |
| 変換形式 | `md-converter:output-format:v1` |
| アプリ設定 | `md-converter:settings:v1` |

アプリ設定にはエディター内部スクロールのON/OFFと、PC表示の左右ペイン比率を保存する。旧保存値に比率がない場合や、保存比率が20〜80%の範囲外の場合は50:50へフォールバックする。区切りバーの操作時はworkspaceの実幅から各ペイン280px以上となる可動範囲を求め、ポインター操作とキーボード操作で同じ比率更新経路を利用する。767px以下では既存の入力・右ペイン切り替えを優先し、区切りバーを表示しない。

将来データ構造を変更したとき、旧形式を誤って読むのを避け、移行の境界を明確にするためである。タブ状態は必須項目、件数、一意のID、選択中IDを検証し、破損時は初期状態へ戻す。`md-converter:draft:v1` だけがある場合は内容を「Untitled」へ移行し、削除後30日以上のタブは起動時に除去する。変換形式は共通の形式ID一覧に含まれる値だけを復元し、未保存または不正な値はSlackへフォールバックする。変換結果は選択中タブの入力と変換形式から再計算できるため保存しない。

## エディター支援は純粋関数とDOM操作に分ける

入力欄は通常の`textarea`だが、太字・斜体・リンクのショートカット、リストの自動継続、Tabによる階層変更を実装している。

ここでも、文字列の編集規則をVueコンポーネントへ直接書いていない。`src/utils/markdownEditor.ts`の純粋関数は、入力値と選択範囲から次の値と次の選択範囲を返す。`useMarkdownEditor`は、その結果をtextareaへ反映し、`nextTick`後にフォーカスと選択範囲を戻す。

この分離により、DOMイベントを大量に組み立てなくても、文字列変換の境界ケースを高速にテストできる。また、日本語入力で重要なIME変換中は独自ショートカットを実行しない。コードフェンス内のEnterやTabも編集支援の対象外とし、コード本文を意図せず変更しないようにしている。

## テストは入力・出力・警告を見る

テストにはVitestを使用し、実装内部の関数呼び出しよりも公開された振る舞いを確認している。

### パーサーテスト

パーサーでは、MVP要素が期待した中間表現になることを確認する。特に重要なのは次のケースである。

- 空文字
- ネストしたリストとチェック状態
- コードブロック内のMarkdown記号
- 日本語を含むGFMテーブルと列配置
- ソフト改行と明示改行
- 参照形式リンク
- 不完全なMarkdown
- 警告に使う開始位置

不完全なMarkdownがCommonMark/GFM上で通常テキストとして有効なら、推測でエラーにせず文字を保持する。

### Converterテスト

各Converterのテストでは、Markdown文字列をパースし、最終的な`output`と`warnings`を確認する。これにより、パーサーとConverterをつないだ利用時の振る舞いを検証できる。

とくに、同じMarkdown要素でも形式ごとに期待値を分けている。たとえばテーブルは、Slackではコードブロック、Backlog MarkdownではGFMテーブル、Backlog記法ではヘッダー付き独自記法、プレーンテキストではタブ区切りになる。それぞれについて日本語のセル内容が欠落しないことと、必要な警告だけが返ることを確認する。

### UIと障害系のテスト

Vue Test Utilsとjsdomを使い、リアルタイム変換、形式切り替え、警告一覧、プレビュー、レスポンシブ用タブ、テーマ、設定、コピーを検証している。

正常系だけでなく、Clipboard APIやLocalStorageが利用できない場合も対象にする。ブラウザAPIの失敗で入力や変換結果が消えず、手動操作を継続できることが、このアプリでは重要な完了条件だからである。

## 依存関係を増やさない判断

本アプリは、Vue Router、Pinia、UIコンポーネントライブラリ、高機能エディターを使用していない。単一画面のMVPに対し、ルーティングやグローバルストアは現時点で必要ない。入力支援も通常の`textarea`で満たせる範囲に限定している。

一方、Markdownパーサーは自作せず、CommonMark/GFMの解析実績があるunified/remarkを採用した。アプリ固有ではない複雑な構文解析を依存ライブラリへ任せ、プロダクト固有の価値である「貼り付け先ごとの意味のある変換」に実装を集中させる判断である。

## 新しい出力形式を追加する場合

現在の設計で新しい出力形式を追加する場合、主な作業は次の流れになる。

1. 対象サービスの公式仕様を確認し、表現できる要素とできない要素を整理する
2. `OutputFormat`へ形式を追加する
3. `Converter`を実装し、各ノードの出力と警告方針を定義する
4. `converterRegistry`と選択肢へ登録する
5. 空文字、複合要素、ネスト、コード、テーブル、改行、不完全なMarkdownをテストする

パーサーと中間表現が必要な情報をすでに持っていれば、新形式の追加で既存Converterを変更する必要はない。逆に、新形式だけが必要とする意味情報を中間表現が保持していない場合は、先にパーサー設計と既存形式への影響を確認する。出力側で元文字列を再解析して補うと、アーキテクチャの境界が崩れるためである。

## まとめ

Markdown Converterの設計で最も重要なのは、Markdownを「置換対象の文字列」ではなく「意味を持つ構造」として扱うことだ。

- unified/remarkでCommonMark/GFMを解析する
- mdastをアプリ固有の小さな中間表現へ正規化する
- 出力先ごとに独立したConverterで再構築する
- 表現できない情報は代替表現と警告で扱う
- 同じ中間表現を安全なプレビューにも再利用する
- UI状態、ブラウザAPI、文字列編集をComposableと純粋関数へ分離する
- 実際の入力、出力、警告、障害時の継続性をテストする

この構成は、単なる記法変換を超えて「意味をなるべく保ちながら、異なる表現体系へ移す」という問題に向き合うためのものだ。対象サービスが増えても、構文解析とUIを巻き込まず、変換仕様を独立して追加・検証できることが、本アプリの保守性を支えている。
