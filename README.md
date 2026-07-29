# Markdown Converter

Markdownで作成した文章を、Slack、Backlog、プレーンテキスト向けの形式へ変換・コピーするWebアプリです。入力、変換、自動保存はブラウザ内で完結し、入力内容を外部サーバーへ送信しません。

## 主な機能

- Slack、Backlog Markdown、Backlog記法、プレーンテキストへのリアルタイム変換
- 変換結果のコピーと、情報損失がある場合の警告表示
- 最大7件のMarkdownタブ、PCでのドラッグ並べ替え、削除済みタブ、ライト・ダークモード、変換形式のLocalStorageへの自動保存
- 幅を調整できるPCの2カラム表示と、767px以下の画面での入力・変換結果タブ
- 選択中のMarkdown本文を対象とする文章検索、1件置換、一括置換
- ユーザー登録ルールによるMarkdown本文の入力置換
- 設定で有効化できる全角Markdown記号の入力補正
- 見出し、装飾、リスト、チェックリスト、引用、コード、リンク、テーブル、水平線、改行への対応

## 必要環境

- Node.js `^20.19.0 || ^22.13.0 || >=24.0.0`
- npm（Node.jsに同梱されるバージョン）

Node.jsの範囲は、使用するVite、Vitest、ESLintの公式な実行条件を満たす共通範囲です。開発環境と公開時のビルド環境には `.node-version` でNode.js `22.20.0`を指定しています。

## セットアップ

```bash
npm install
```

## 開発サーバー

```bash
npm run dev
```

表示されたローカルURLをブラウザで開きます。既定では `http://localhost:5173` です。

## 検証コマンド

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

- `lint`: TypeScriptとVueコンポーネントをESLintで検査します。
- `type-check`: `vue-tsc`でTypeScriptとVueコンポーネントの型を検査します。
- `test`: Vitestで単体テストを1回実行します。
- `build`: 型チェック後、Viteで本番用ファイルを `dist/` に生成します。

ビルド結果をローカルで確認する場合は、`npm run preview` を実行します。

## 操作

Markdown入力欄へ入力し、ヘッダーの「変換形式」で貼り付け先を選択します。変換結果はリアルタイムに更新されます。入力エリア上部のブラウザ風タブでは、末尾タブの横にある「＋」で最大7件の文書を追加でき、タブのダブルクリックで名前を変更できます。PCではタブ名をドラッグし、別のタブに表示される挿入線の位置へドロップすると順番を変更できます。タブ外へドロップした場合は元の順序を維持します。タブ右端の「×」で削除し、ゴミ箱アイコンの削除済み一覧から復元できます。削除時の成功通知は表示しません。

内容が空で、名前がデフォルト形式の `Untitled` または `Untitled N`（Nは2以上）のタブは、削除済み一覧へ残さずそのまま完全削除します。旧形式名として保存された `文章N` も同じ扱いです。内容があるタブ、空白文字を入力したタブ、名前を変更した空タブは削除済み一覧へ保持します。

入力フッターの検索アイコン、`Ctrl + F` / `Command + F` から、選択中タブのMarkdown本文を検索できます。一致箇所は入力欄内ですべてハイライトされ、現在位置は強い色で表示されます。`Ctrl + H` / `Command + Option + F` では置換欄も開きます。検索・置換欄のEnterで次、Shift + Enterで前の一致へ移動し、Escapeで閉じます。検索は大文字・小文字を区別しない部分一致で、正規表現と改行をまたぐ検索には対応しません。1件置換とすべて置換は現在のタブだけを更新し、通常の入力と同じように自動保存されます。フォーカスモードでは左側の検索アイコンまたは同じショートカットから利用できます。

設定の「入力置換」では、よく使う文字列を最大100件登録できます。IME入力は確定後、直接入力は半角スペース、全角スペース、Enterの入力時に完全一致を判定します。入力した区切りは保持し、1回の入力では1ルールだけを適用します。インラインコードとコードブロック、貼り付け、検索・一括置換、タブ名などMarkdown本文の直接入力以外には適用しません。Markdown記法を生成するルールは登録できません。通常モードとフォーカスモードは同じルールを使用します。詳細は [`docs/input-replacement-spec.md`](docs/input-replacement-spec.md) を参照してください。

設定の「全角Markdown補正」は初期状態ではOFFです。ONにすると、`＃`、`＊`、`＞`、`［`などの全角Markdown記号を、直接入力またはIME確定の直後に1文字から半角へ補正します。行頭の `ー` は `-` へ補正し、全角空白や数字は見出し・リストなどの構文位置だけを補正します。通常文章の全角英数字、コード本文、貼り付け、検索・一括置換、保存内容の復元、Undo／Redoには適用しません。通常モードとフォーカスモードは同じ設定を使用します。詳細は [`docs/full-width-markdown-normalization-spec.md`](docs/full-width-markdown-normalization-spec.md) を参照してください。

PC表示では入力と右ペインの間にある区切りバーをドラッグして、左右の表示割合を変更できます。区切りバーへフォーカスして左右矢印キーを押すと5%ずつ変更し、Home・Endキーで可動範囲の端へ、ダブルクリックで50:50へ戻ります。各ペインの最小幅は280pxです。

767px以下の画面では「入力」と「変換結果」のタブを使用します。タブへフォーカスした状態で、左右矢印キー、Homeキー、Endキーでも切り替えられます。Markdown入力とテーマは変更から500ms後、文書タブの追加・切り替え・並べ替え・名前変更・削除・復元、変換形式、エディター内部スクロール設定、左右ペイン比率、全角Markdown補正設定、入力置換設定は変更直後に次のキーへ保存されます。

| 保存対象 | LocalStorageキー |
| --- | --- |
| Markdownタブ、選択中のタブ、削除済みタブ | `markdown-editor-state-v1` |
| テーマ | `md-converter:theme:v1` |
| 変換形式 | `md-converter:output-format:v1` |
| エディター内部スクロール設定、左右ペイン比率、全角Markdown補正設定 | `md-converter:settings:v1` |
| 入力置換の全体設定とルール | `md-converter:input-replacements:v1` |

旧版の `md-converter:draft:v1` だけが存在する場合は、内容を初期タブ「Untitled」へ移行します。変換結果は入力から再計算できるため保存しません。変換形式の保存値がない場合または不正な場合はSlackを使用します。保存内容は利用中のブラウザのサイトデータを削除すると削除されます。LocalStorageやClipboard APIが利用できない場合も編集と変換は継続でき、コピー失敗時は手動コピーの案内を表示します。

## Cloudflare Pagesへの公開

このアプリは `npm run build` で生成される `dist/` だけで動作する静的Webアプリです。Cloudflare PagesではGitHubリポジトリを接続し、次の値を設定します。

| 設定 | 値 |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 空欄（リポジトリルート） |
| Node.js | `22.20.0`（`.node-version`から取得） |
| アプリ用環境変数 | なし |

`main`へのpushでproductionを更新し、それ以外のブランチとPull Requestはpreview deploymentとして扱います。Vue Routerは使用しておらず、Cloudflare Pagesが静的サイトのルートを配信するため、`vite.config.ts`の`base`変更やSPA用リダイレクトは不要です。

`public/_headers` はViteによって成果物へコピーされ、Cloudflare Pages上でContent Security Policyなどのセキュリティヘッダーを設定します。入力内容を外部送信しない方針を維持するため、Pages Functions、アクセス解析、エラー監視、外部フォントは使用しません。

## 主要依存関係

| 依存関係 | 用途 |
| --- | --- |
| Vue 3 | Composition APIを利用するUI基盤 |
| Vite / `@vitejs/plugin-vue` | 開発サーバー、本番ビルド、Vue単一ファイルコンポーネントの処理 |
| TypeScript / `vue-tsc` | TypeScriptと `.vue` ファイルの型チェック |
| Vitest / Vue Test Utils / jsdom | Vueコンポーネントの単体テスト |
| ESLint / Vue・TypeScript設定 | TypeScriptとVueコンポーネントの静的検査 |
| unified / remark-parse / remark-gfm | CommonMarkとGFMをmdastへ解析するMarkdownパーサー |

正確な導入バージョンは `package-lock.json` で固定しています。Pinia、Vue Router、UIライブラリは導入していません。パーサーの設計と既知の制約は [`docs/parser-design.md`](docs/parser-design.md) を参照してください。

パーサー、中間表現、出力先別Converter、変換警告、安全なプレビュー、ブラウザ内保存を含む実装全体の解説は、[`docs/technical-overview.md`](docs/technical-overview.md) にまとめています。

## 既知の制約

- 入力はCommonMarkを基礎としたGFMとして解析します。他のMarkdown方言、HTML、画像、脚注はMVP対象外です。
- Slackのテーブルはコードブロック、プレーンテキストのテーブルはタブ区切りへ変換するため、列幅や配置が貼り付け先で揃わない場合があります。
- Backlogのチェックリストは課題詳細だけで操作可能です。対象外の入力欄では文字列として表示されます。
- 文字数はUnicodeコードポイント単位です。結合文字や複数コードポイントからなる絵文字は、見た目より多く数える場合があります。
- Clipboard APIとLocalStorageの利用可否はブラウザ設定や実行環境に依存します。対応ブラウザの正式な範囲と実機検証は未確定です。
- Markdownタブの並べ替えはブラウザ標準のDrag and Drop APIを使用し、PCのマウスまたはトラックパッド操作を対応範囲とします。タッチ専用操作とキーボードによる並べ替えには対応していません。
- 削除済みタブは30日間保持します。複数ウィンドウ間の同期・競合解決と独自の編集履歴には対応していません。
- 入力置換のUndo／Redo単位はブラウザ標準textareaの編集履歴に依存するため、ブラウザによって操作単位が異なる場合があります。
- 全角Markdown補正は直接入力とIME確定後だけを対象とし、貼り付けた全角Markdownの一括補正には対応していません。Undo／Redo単位はブラウザ標準textareaの編集履歴に依存します。

形式ごとの変換と警告の詳細は [`docs/conversion-rules.md`](docs/conversion-rules.md) を参照してください。
