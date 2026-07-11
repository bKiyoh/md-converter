# Markdown Converter

Markdownで作成した文章を、Slack、Backlog、プレーンテキスト向けの形式へ変換・コピーするWebアプリです。入力、変換、自動保存はブラウザ内で完結し、入力内容を外部サーバーへ送信しません。

## 主な機能

- Slack、Backlog Markdown、Backlog記法、プレーンテキストへのリアルタイム変換
- 変換結果のコピーと、情報損失がある場合の警告表示
- Markdown入力とライト・ダークモードのLocalStorageへの自動保存
- PCの2カラム表示と、767px以下の画面での入力・変換結果タブ
- 見出し、装飾、リスト、チェックリスト、引用、コード、リンク、テーブル、水平線、改行への対応

## 必要環境

- Node.js `^20.19.0 || ^22.13.0 || >=24.0.0`
- npm（Node.jsに同梱されるバージョン）

Node.jsの範囲は、使用するVite、Vitest、ESLintの公式な実行条件を満たす共通範囲です。

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

Markdown入力欄へ入力し、変換結果側の「出力形式」で貼り付け先を選択します。変換結果はリアルタイムに更新されます。

767px以下の画面では「入力」と「変換結果」のタブを使用します。タブへフォーカスした状態で、左右矢印キー、Homeキー、Endキーでも切り替えられます。入力内容とテーマは変更から500ms後に次のキーへ保存されます。

| 保存対象 | LocalStorageキー |
| --- | --- |
| Markdown入力 | `md-converter:draft:v1` |
| テーマ | `md-converter:theme:v1` |

変換結果と出力形式は保存しません。LocalStorageやClipboard APIが利用できない場合も編集と変換は継続でき、コピー失敗時は手動コピーの案内を表示します。

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

## 既知の制約

- 入力はCommonMarkを基礎としたGFMとして解析します。他のMarkdown方言、HTML、画像、脚注はMVP対象外です。
- Slackのテーブルはコードブロック、プレーンテキストのテーブルはタブ区切りへ変換するため、列幅や配置が貼り付け先で揃わない場合があります。
- Backlogのチェックリストは課題詳細だけで操作可能です。対象外の入力欄では文字列として表示されます。
- 文字数はUnicodeコードポイント単位です。結合文字や複数コードポイントからなる絵文字は、見た目より多く数える場合があります。
- Clipboard APIとLocalStorageの利用可否はブラウザ設定や実行環境に依存します。対応ブラウザの正式な範囲と実機検証は未確定です。

形式ごとの変換と警告の詳細は [`docs/conversion-rules.md`](docs/conversion-rules.md) を参照してください。
