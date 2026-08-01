# Md Converter

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

## ドキュメント

仕様、実装計画、技術解説、完了済み計画の区分と読む順番は、
[`docs/README.md`](docs/README.md) にまとめています。

- アプリ全体の仕様：[`docs/specs/product-spec.md`](docs/specs/product-spec.md)
- 形式ごとの変換仕様：[`docs/specs/conversion-rules.md`](docs/specs/conversion-rules.md)
- 開発者向けコードベースガイド：[`docs/architecture/code-reading-guide.md`](docs/architecture/code-reading-guide.md)
- 現在の実装計画：[`docs/plans/implementation-plan.md`](docs/plans/implementation-plan.md)
- Markdownパーサー設計：[`docs/architecture/parser-design.md`](docs/architecture/parser-design.md)

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

Markdown入力欄へ入力し、ヘッダーの変換先から貼り付け先を選択します。変換結果はリアルタイムに更新されます。入力エリア上部では最大7件の文書タブを追加、切り替え、名前変更、削除、復元、並べ替えできます。詳細は [`docs/specs/tab-management-spec.md`](docs/specs/tab-management-spec.md) を参照してください。

入力フッターの検索アイコン、`Ctrl + F` / `Command + F` から、選択中タブのMarkdown本文を検索できます。一致箇所は入力欄内ですべてハイライトされ、現在位置は強い色で表示されます。`Ctrl + H` / `Command + Option + F` では置換欄も開きます。検索・置換欄のEnterで次、Shift + Enterで前の一致へ移動し、Escapeで閉じます。検索は大文字・小文字を区別しない部分一致で、正規表現と改行をまたぐ検索には対応しません。1件置換とすべて置換は現在のタブだけを更新し、通常の入力と同じように自動保存されます。フォーカスモードでは左側の検索アイコンまたは同じショートカットから利用できます。

設定の「入力置換」では、Markdown本文の直接入力へ適用する置換ルールを最大100件登録できます。詳細は [`docs/specs/input-replacement-spec.md`](docs/specs/input-replacement-spec.md) を参照してください。

設定の「全角Markdown補正」をONにすると、直接入力またはIME確定時の全角Markdown記号を、構文として必要な範囲で半角へ補正します。詳細は [`docs/specs/full-width-markdown-normalization-spec.md`](docs/specs/full-width-markdown-normalization-spec.md) を参照してください。

PC表示では入力と右ペインの間にある区切りバーをドラッグして、左右の表示割合を変更できます。区切りバーへフォーカスして左右矢印キーを押すと5%ずつ変更し、Home・Endキーで可動範囲の端へ、ダブルクリックで50:50へ戻ります。各ペインの最小幅は280pxです。

767px以下の画面では「入力」と「変換結果」のタブを使用します。タブへフォーカスした状態で、左右矢印キー、Homeキー、Endキーでも切り替えられます。

Markdown文書と設定はブラウザのLocalStorageへ保存します。保存内容はブラウザのサイトデータを削除すると失われますが、外部サーバーへは送信しません。保存対象と復元条件は [`docs/specs/product-spec.md`](docs/specs/product-spec.md) と [`docs/specs/tab-management-spec.md`](docs/specs/tab-management-spec.md) を参照してください。

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

正確な導入バージョンは `package-lock.json` で固定しています。Pinia、Vue Router、UIライブラリは導入していません。Parserと中間表現の設計判断は、[`docs/architecture/parser-design.md`](docs/architecture/parser-design.md) を参照してください。

## 既知の制約

- 入力はCommonMarkを基礎としたGFMとして解析します。他のMarkdown方言、画像、脚注には対応していません。生HTMLは実行せず、文字列として保持して警告します。
- Slackのテーブルはコードブロック、プレーンテキストのテーブルは2列の`項目：値`またはタブ区切りへ変換するため、列幅や配置が貼り付け先で揃わない場合があります。
- Backlogのチェックリストは課題詳細だけで操作可能です。対象外の入力欄では文字列として表示されます。
- 文字数はUnicodeコードポイント単位です。結合文字や複数コードポイントからなる絵文字は、見た目より多く数える場合があります。
- Clipboard APIとLocalStorageの利用可否はブラウザ設定や実行環境に依存します。対応ブラウザの正式な範囲と実機検証は未確定です。
- Markdownタブの並べ替えはブラウザ標準のDrag and Drop APIを使用し、PCのマウスまたはトラックパッド操作を対応範囲とします。タッチ専用操作とキーボードによる並べ替えには対応していません。
- 削除済みタブは30日間保持します。複数ウィンドウ間の同期・競合解決と独自の編集履歴には対応していません。
- 入力置換のUndo／Redo単位はブラウザ標準textareaの編集履歴に依存するため、ブラウザによって操作単位が異なる場合があります。
- 全角Markdown補正は直接入力とIME確定後だけを対象とし、貼り付けた全角Markdownの一括補正には対応していません。Undo／Redo単位はブラウザ標準textareaの編集履歴に依存します。

形式ごとの変換と警告の詳細は [`docs/specs/conversion-rules.md`](docs/specs/conversion-rules.md) を参照してください。
