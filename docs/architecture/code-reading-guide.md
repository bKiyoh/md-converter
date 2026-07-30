# コードベースガイド

> 文書区分：現行実装の技術解説。製品仕様の正本ではない。

## この文書の目的

この文書は、Markdown Converterを変更・レビューする開発者に向けて、コードベースの
構成、主要な処理の流れ、責務の境界、状態管理、テストの保証範囲を説明する。

すべてのコードを自力で再実装できることは目的としない。現在の構成を図にして説明でき、
変更案について次の点を判断できる状態を目標とする。

- 変更を置くべき層とファイル
- 既存の責務や依存方向との整合性
- 状態の所有者と永続化への影響
- Parser、中間表現、Converter、プレビューへの波及
- 追加または更新すべきテスト

画面や機能の動作は
[`product-spec.md`](../specs/product-spec.md) と各機能仕様、変換規則は
[`conversion-rules.md`](../specs/conversion-rules.md) を正本とする。Parserの設計判断は
[`parser-design.md`](parser-design.md)、作業範囲と開発ルールは
[`implementation-plan.md`](../plans/implementation-plan.md) と
[`AGENTS.md`](../../AGENTS.md) を参照する。

## 1. プロダクトとシステム境界

Markdown Converterは、Markdown文書をSlack、Backlog Markdown、Backlog記法、
プレーンテキスト向けに変換するVue 3のシングルページアプリケーションである。

| 項目 | 現在の構成 |
| --- | --- |
| 実行環境 | ブラウザ |
| UI | Vue 3、Composition API |
| 実装言語 | TypeScript |
| ビルド | Vite |
| Markdown解析 | unified、remark-parse、remark-gfm |
| テスト | Vitest、Vue Test Utils、jsdom |
| 永続化 | ブラウザのLocalStorage |

バックエンド、データベース、ユーザー認証、外部API連携はない。Markdown本文、設定、
変換処理はブラウザ内に閉じており、入力内容を外部サーバーへ送信しない。

アプリケーションの主要な境界は次のとおりである。

```text
ユーザー
  │ 入力・画面操作
  ▼
Vueコンポーネント
  ├─ Composable ──→ ブラウザAPI
  │                  ├─ LocalStorage
  │                  └─ Clipboard
  ├─ Parser ──→ MarkdownDocument ──→ Converter
  └─ Parser ──→ MarkdownDocument ──→ プレビューレンダラー
```

外部ライブラリが返すmdastをアプリ全体の共通モデルにはしない。
[`normalizeMarkdownAst.ts`](../../src/parser/normalizeMarkdownAst.ts) でアプリ固有の
`MarkdownDocument` へ正規化し、Converterとプレビューはその中間表現に依存する。

## 2. データと処理の流れ

### 2.1 起動と画面の構成

[`main.ts`](../../src/main.ts) がVueアプリを生成し、
[`App.vue`](../../src/App.vue) をマウントする。`App.vue` は画面全体の合成点であり、
Composableから取得した状態と操作を各コンポーネントへ接続する。

```text
main.ts
  └─ App.vue
      ├─ common/   ヘッダー、設定、通知、共通UI
      ├─ editor/   文書タブ、Markdown入力、検索・入力支援
      └─ output/   プレビュー、変換結果、警告
```

`App.vue` は変換規則やLocalStorageの直列化を実装しない。これらはParser、Converter、
Composableへ委譲し、`App.vue` には画面全体を成立させる接続と画面横断状態を置く。

### 2.2 Markdown入力から変換結果まで

選択中タブの本文は `useEditorTabs` が公開する書き込み可能な `computed` であり、
`MarkdownEditor` の `v-model` と接続される。

```text
MarkdownEditor
  │ update:modelValue
  ▼
App.vue の markdown
  │
  ├─→ useEditorTabs
  │     ├─ 選択中タブのcontentを更新
  │     └─ useEditorStorageへ保存を予約
  │
  └─→ App.vue の conversionResult（computed）
        ├─ parseMarkdown(markdown)
        │    ├─ remarkでmdastを生成
        │    └─ MarkdownDocumentへ正規化
        └─ converterRegistry[selectedFormat].convert(document)
             └─ ConversionResult
                  ├─ output
                  └─ warnings
```

入力本文または選択中の変換形式が変わると、Vueの依存追跡によって
`conversionResult` が再計算される。変換中に予期しない例外が発生した場合、
`App.vue` は入力を保持したまま空の出力と `invalid-structure` 警告を返す。

出力形式とConverterの対応は
[`converterRegistry.ts`](../../src/converters/converterRegistry.ts) に集約される。
すべてのConverterは同じ `MarkdownDocument` を受け取り、共通の
`ConversionResult` を返す。

### 2.3 Markdownプレビュー

プレビューは変換結果とは別の出力経路を持つ。

```text
OutputPanel
  └─ MarkdownPreview
       ├─ parseMarkdownForPreview(markdown)
       │    └─ 生HTMLノードを中間表現へ含めない
       └─ renderMarkdownPreview(document)
            ├─ 許可したHTML要素だけを生成
            ├─ テキストと属性をエスケープ
            └─ URLスキームを検証
```

変換用Parserとプレビュー用Parserは同じ正規化処理を利用するが、プレビューでは
`ignoreHtml` を指定する。プレビューはConverterの文字列をHTMLへ変換せず、
`MarkdownDocument` から直接HTMLを生成する。

### 2.4 入力支援と検索・置換

`MarkdownEditor.vue` はtextarea DOM、選択範囲、IME、スクロール同期など、入力要素に
密接な処理を担当する。文字列操作そのものはVueに依存しないUtilsへ分離される。

```text
keydown / input / compositionend
  ▼
MarkdownEditor.vue
  ├─ useMarkdownEditor
  │    └─ utils/markdownEditor
  │         ├─ ショートカット
  │         ├─ リスト継続
  │         └─ インデント変更
  ├─ utils/inputReplacement
  ├─ utils/fullWidthMarkdown
  └─ useTextSearch
       └─ utils/textSearch
```

入力支援や置換は最終的に `update:modelValue` を発行し、通常入力と同じタブ更新・保存・
変換経路へ合流する。独立した文書状態や保存経路は持たない。

### 2.5 コピー

`App.vue` は現在の `ConversionResult.output` と選択形式の表示名を
`useClipboard` へ渡す。`useClipboard` はClipboard APIの成功・失敗を通知状態へ
変換し、一定時間後に通知を消去する。コンポーネントはClipboard APIを直接操作しない。

## 3. モジュールの責務と依存関係

### 3.1 レイヤーごとの責務

| レイヤー | 主な場所 | 責務 | 含めない処理 |
| --- | --- | --- | --- |
| アプリ合成 | `src/App.vue` | 画面横断状態の接続、主要コンポーネントの構成、変換経路の選択 | 個別の変換規則、Storageの直列化、文字列編集アルゴリズム |
| Component | `src/components/` | 表示、Propsの反映、Emit、DOMイベント、アクセシビリティ | 出力形式固有の変換規則、複数箇所で共有する純粋計算 |
| Composable | `src/composables/` | リアクティブな状態と状態操作、ライフサイクル、ブラウザAPIとの接続 | テンプレート、形式固有の描画 |
| Parser | `src/parser/` | Markdown文字列の解析、mdastから中間表現への正規化 | 出力先固有の記法、UI状態 |
| Converter | `src/converters/` | 中間表現から各出力形式への変換、変換警告の生成 | Markdown文字列の再解析、Vue状態、DOM操作 |
| Utils | `src/utils/` | Vueに依存しない文字列処理、入力編集、プレビューHTML生成 | リアクティブ状態の所有、コンポーネント表示 |
| Types | `src/types/` | 層をまたいで共有するデータ契約 | 状態変更や実行時処理 |
| Directive | `src/directives/` | Vue要素へ横断的なDOM動作を付加 | 製品状態や変換処理 |

基本的な依存方向は次のとおりである。

```text
App / Components
  ├─→ Composables ──→ Utils / Types / Browser API
  ├─→ Parser ───────→ Types / remark
  ├─→ Converters ───→ Types
  └─→ Utils ────────→ Types
```

Parser、Converter、汎用UtilsはVueコンポーネントへ依存しない。Converter同士も依存せず、
共通契約と明確に共通化された補助処理だけを共有する。

### 3.2 Component

Componentは表示領域で分類される。

| 場所 | 主な責務 |
| --- | --- |
| `components/common/` | アプリ全体で使うアイコン、ツールチップ、通知、設定UI |
| `components/editor/` | 文書タブ、textarea、検索・置換、入力支援、フォーカスモードUI |
| `components/output/` | 出力形式選択、プレビュー、変換結果、変換警告 |

親子間のデータはPropsで下向きに渡し、変更要求はEmitで上向きに通知する。
文書本文は `MarkdownEditor` と `App.vue` の間を `v-model` で接続する。

`MarkdownEditor.vue` はDOM選択範囲やネイティブUndo・Redoとの整合を扱うため、
一般的な表示コンポーネントより責務が大きい。ただし、Markdown編集アルゴリズムと
検索・置換の計算はComposableとUtilsへ分離する。

### 3.3 Composable

| Composable | 所有する責務 |
| --- | --- |
| `useEditorTabs` | タブ一覧、選択中タブ、削除済みタブ、タブ操作、本文更新 |
| `useEditorStorage` | タブ状態の検証、復元、移行、保存タイミング |
| `useMarkdownEditor` | textareaイベントとMarkdown編集操作の接続 |
| `useTextSearch` | 検索状態、現在位置、置換操作 |
| `useInputReplacementSettings` | 入力置換ルールと全体設定 |
| `useAppSettings` | 内部スクロール、左右比率、全角Markdown補正設定 |
| `useOutputFormatPreference` | 選択中の変換形式 |
| `useThemePreference` | ライト・ダークテーマ |
| `useWorkspaceSplitter` | 左右ペイン比率の計算とポインター・キーボード操作 |
| `useFocusMode` | フォーカスモードと編集位置の維持 |
| `useClipboard` | コピー実行と成功・失敗通知 |
| `useDebouncedLocalStorage` | 単一状態の読み込み、監視、遅延保存 |

Composableは「状態の所在」と「その状態に対して許される操作」をまとめる。
単にコード行数を減らす目的では作成せず、複数のリアクティブ値、ライフサイクル、
ブラウザAPIとの接続を一つの責務として扱う場合に使用する。

### 3.4 Parserと中間表現

[`parseMarkdown.ts`](../../src/parser/parseMarkdown.ts) はremarkのParser設定と公開関数を
持つ。実際のmdastから中間表現への変換は
[`normalizeMarkdownAst.ts`](../../src/parser/normalizeMarkdownAst.ts) が担当する。

中間表現は [`types/markdown.ts`](../../src/types/markdown.ts) に定義される。

```text
MarkdownDocument
  └─ BlockNode[]
      ├─ heading
      ├─ paragraph
      ├─ list
      ├─ quote
      ├─ codeBlock
      ├─ table
      ├─ thematicBreak
      └─ rawHtmlBlock
```

インライン要素は `InlineNode` の判別可能なUnionとして表す。各ノードの `type` を
基準に分岐できるため、新しいノード種別を追加した場合はTypeScriptの型検査を通じて
Parser、全Converter、プレビューレンダラーへの影響を検出しやすい。

中間表現には変換警告で利用する行・列、リストの開始番号やspread、コードブロックの
言語とmeta、表の配置など、出力判断に必要な情報を保持する。

### 3.5 Converter

Converterの契約は [`types/conversion.ts`](../../src/types/conversion.ts) にある。

```ts
interface Converter {
  readonly format: OutputFormat
  convert(document: MarkdownDocument): ConversionResult
}
```

各ConverterはBlockとInlineのノード種別ごとに文字列を生成する。変換先で完全に
表現できない場合も、可能な限り内容を残し、必要に応じて `ConversionWarning` を返す。

| 出力形式 | 実装 |
| --- | --- |
| Slack | `src/converters/slack/` |
| Backlog Markdown | `src/converters/backlog-markdown/` |
| Backlog記法 | `src/converters/backlog-notation/` |
| プレーンテキスト | `src/converters/plain-text/` |

形式の追加では、Converterを実装するだけでなく、`OutputFormat`、Registry、選択肢、
変換仕様、全体結合テストを同時に確認する。

### 3.6 Utils、Types、Directive、CSS

`src/utils/` には、入力と出力が値で表せる純粋処理を置く。DOMやVue状態が必要な部分は
ComponentまたはComposableに残し、文字列変換や判定だけをUtilsへ渡す。

`src/types/` は、ParserとConverter、ComponentとComposableなど、複数の層で共有する
契約を定義する。単一ファイル内だけで使う型は利用箇所の近くに定義する。

`src/directives/tooltip.ts` はツールチップのDOMライフサイクルを共通化する。
全体のスタイルは主に [`style.css`](../../src/style.css) が持つ。

## 4. 状態管理と永続化

Piniaなどのグローバルストアは使用していない。アプリ全体で必要な状態は
`App.vue` がComposableを呼び出して保持し、局所的な表示状態は対象Componentが保持する。

### 4.1 状態の所有者

| 状態 | 所有者 | 利用範囲 | 永続化 |
| --- | --- | --- | --- |
| タブ、本文、削除済みタブ、選択中タブ | `useEditorTabs` | アプリ全体 | する |
| 変換結果と警告 | `App.vue` の `computed` | 出力、コピー | しない。入力から再計算 |
| 選択中の出力形式 | `useOutputFormatPreference` | ヘッダー、変換 | する |
| テーマ | `useThemePreference` | アプリ全体 | する |
| 内部スクロール、左右比率、全角補正 | `useAppSettings` | アプリ全体 | する |
| 入力置換の設定とルール | `useInputReplacementSettings` | 設定、Editor | する |
| 検索語、置換語、現在の一致 | `useTextSearch` | MarkdownEditor | しない |
| フォーカスモード、ヘルプ表示 | `useFocusMode` | アプリ全体 | しない |
| 右ペイン内の表示タブ | `OutputPanel.vue` | OutputPanel内 | しない |
| モーダル、ポップオーバー、通知 | 各ComponentまたはComposable | 局所または画面横断 | しない |

派生可能な値は重複して保存せず `computed` で生成する。変換結果、文字数、選択中タブ
そのもの、表示用の形式名が該当する。

### 4.2 LocalStorage

| キー | 内容 | 保存タイミング | 不正値・未保存時 |
| --- | --- | --- | --- |
| `markdown-editor-state-v1` | タブ、本文、選択中ID、削除済みタブ | 本文は500ms後、タブ操作は即時 | 空の`Untitled` 1件へフォールバック |
| `md-converter:theme:v1` | `light` / `dark` | 変更から500ms後 | `light` |
| `md-converter:output-format:v1` | 選択中の出力形式 | 即時 | `slack` |
| `md-converter:settings:v1` | 内部スクロール、左右比率、全角補正 | 即時 | 項目ごとの既定値 |
| `md-converter:input-replacements:v1` | 有効状態と入力置換ルール | 即時 | 有効・ルールなし |

旧キー `md-converter:draft:v1` だけが存在する場合、
`useEditorStorage` は内容を初期タブへ移行し、新形式の保存成功後に旧キーを削除する。
削除済みタブは復元時に保存期限を確認し、30日を超えたものを状態から除外する。

LocalStorageから取得した値は信頼せず、型、版、範囲、ID重複などを復元時に検証する。
Storageへのアクセスや保存に失敗しても、アプリ内の状態更新と編集は継続する。

`useDebouncedLocalStorage` は単一の状態値に対する共通の読み込み・監視・保存を提供する。
タブ状態は移行、期限切れ削除、操作別の保存タイミングがあるため、専用の
`useEditorStorage` を使用する。

### 4.3 状態変更の原則

- Componentは受け取ったPropsを直接変更せず、EmitまたはComposableの操作を使用する
- LocalStorageをComponentから直接読み書きしない
- 保存済みデータの検証と既定値への復帰はComposable内に閉じる
- 変換結果や文字数のような派生値を別の可変状態として保持しない
- 一時的な表示状態は、共有範囲が広がるまで対象Componentのローカル状態に置く
- フォーカスモードでも同じ `MarkdownEditor` と本文状態を使用し、編集経路を複製しない

## 5. テストで保証している範囲

テストはVitestを使用し、すべてjsdom環境で実行する。実装ファイルだけを探しやすくする
ため、テストファイルは `tests/` へ集約する。純粋処理、Composable、Componentなどの
単体テストは `tests/unit/` で `src/` のディレクトリ構造を踏襲し、画面横断フローは
`tests/integration/` へ配置する。

```text
tests/
├─ unit/
│  ├─ components/
│  ├─ composables/
│  ├─ converters/
│  ├─ directives/
│  ├─ parser/
│  └─ utils/
└─ integration/
   └─ App.spec.ts
```

### 5.1 テストの層

| 対象 | 主なテスト | 保証する内容 |
| --- | --- | --- |
| Parser | `tests/unit/parser/parseMarkdown.spec.ts` | Markdown要素から中間表現への正規化、位置情報、生HTMLの扱い |
| Converter | `tests/unit/converters/**/convertTo*.spec.ts` | Markdown入力に対応する出力文字列と警告 |
| 純粋処理 | `tests/unit/utils/*.spec.ts` | 編集、検索・置換、入力置換、全角補正、プレビューHTML、文字数 |
| 状態と永続化 | `tests/unit/composables/*.spec.ts` | 状態遷移、保存と復元、不正値、移行、操作上限 |
| Component | `tests/unit/components/**/*.spec.ts` | Props・Emit、DOMイベント、キーボード操作、アクセシビリティ属性 |
| アプリ結合 | `tests/integration/App.spec.ts` | 入力から変換・表示・保存・コピーまでの主要な画面横断フロー |
| Directive | `tests/unit/directives/tooltip.spec.ts` | ツールチップの表示、位置、終了条件、後始末 |

Converterテストでは実装内部の補助関数ではなく、入力Markdownに対する出力と警告を
検証する。Parserテストは外部mdastではなく、アプリが利用する `MarkdownDocument` を
検証する。

ComposableテストではStorage、時刻、ID生成などを差し替え、状態遷移と境界条件を
決定的に確認する。Componentテストと `tests/integration/App.spec.ts` はVue Test Utilsで
DOMイベントを発生させ、ユーザー操作から結果までを確認する。

すべてのComponentとComposableに個別のテストファイルがあるわけではない。テーマ、
フォーカスモード、左右ペイン、コピーなどの画面横断動作は、主に
`tests/integration/App.spec.ts` で結合した状態を検証する。

### 5.2 自動テストの境界

現在のテストは次を完全には保証しない。

- 実ブラウザでの見た目、折り返し、スクロール位置、レスポンシブレイアウト
- ブラウザやOSごとの差があるIME、Clipboard、ネイティブUndo・Redo
- ポインタードラッグやフォーカス移動の実機上の操作感
- SlackやBacklog側の将来の記法変更
- すべての不正Markdownと文字列の組み合わせ
- 実ブラウザを使用するE2Eシナリオ

したがって、jsdom上のテスト成功だけで視覚的動作や実ブラウザAPIとの統合まで保証された
とは判断しない。UI、クリップボード、IME、レスポンシブ表示を変更した場合は、
関連する自動テストに加えて実ブラウザで確認する。

### 5.3 検証コマンド

変更後の基本検証は `package.json` に定義された次のコマンドで行う。

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

- `lint` はESLintの規則違反を検出する
- `type-check` はVueとTypeScriptの型整合性を検証する
- `test` は前述の振る舞いを検証する
- `build` は型検査を含め、本番用成果物を生成できることを検証する

## 6. 実装規約と変更判断

### 6.1 コードベースで採用しているパターン

**中間表現を境界にする**

Markdown文字列をConverterごとに解析しない。Parserで一度 `MarkdownDocument` へ変換し、
すべての出力処理が同じ構造を参照する。コードブロック内の記号など、構文上の文脈を
失わないための境界でもある。

**判別可能なUnionでノードを表す**

`BlockNode` と `InlineNode` は `type` を判別子に持つ。ノード種別ごとの処理は
`switch` で明示し、追加時に影響箇所を型検査で検出できる構成を維持する。

**状態操作と純粋計算を分ける**

リアクティブ状態、ライフサイクル、ブラウザAPIとの接続はComposable、同じ入力から
同じ出力を返す計算はUtilsへ置く。Componentは両者をDOMイベントと表示へ接続する。

**依存を注入できる境界を設ける**

Storage、Clipboard、時刻、ID生成などの環境依存値は、必要な箇所で引数から差し替えられる。
これにより、異常系を含む状態遷移をブラウザ環境から切り離してテストできる。

**永続化境界で実行時検証する**

TypeScriptの型はLocalStorageの内容を保証しない。保存値は `unknown` として解析し、
構造と値域を確認してからアプリ状態へ取り込む。

**失敗しても編集状態を守る**

Storage、Clipboard、変換で例外が発生しても、入力本文を失わず操作を継続できる状態を
優先する。復旧できない処理は通知または変換警告として表現する。

### 6.2 変更案を評価する観点

変更をレビューするときは、少なくとも次を確認する。

1. 製品仕様または変換仕様の変更を伴うか
2. 状態の所有者は一つに定まっているか
3. UI、状態操作、純粋計算の責務が混在していないか
4. 既存の中間表現と共通型を利用できるか
5. LocalStorageの形式、既定値、移行、異常系へ影響するか
6. Parser、全Converter、プレビューのどこまで波及するか
7. 入出力または状態遷移として回帰テストを追加できるか
8. jsdomでは確認できず、手動確認が必要な動作はあるか

代表的な変更と影響範囲は次のとおりである。

| 変更 | 主な影響範囲 |
| --- | --- |
| Markdownノードを追加 | Markdown型、Parser、全Converter、プレビュー、変換仕様、各テスト |
| 出力形式を追加 | Conversion型、Converter、Registry、形式選択UI、仕様、結合テスト |
| 変換規則を変更 | 対象Converter、変換仕様、対象Converterテスト |
| 保存項目を追加 | 状態を所有するComposable、Storage検証、既定値、仕様、復元テスト |
| textareaの編集操作を追加 | MarkdownEditor、Composable、純粋Utils、IME・選択範囲、テスト |
| 画面横断UIを追加 | App.vue、関連Component、状態の所有者、アクセシビリティ、結合テスト |

既存の責務で表現できる変更に新しい層やグローバル状態を追加しない。反対に、複数箇所へ
同じ状態操作や判定が重複し始めた場合は、責務を持つComposable、Utils、共通型への集約を
検討する。
