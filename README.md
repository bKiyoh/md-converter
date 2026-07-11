# Markdown Converter

Markdownで作成した文章を、Slack、Backlog、プレーンテキスト向けの形式へ変換するWebアプリです。

現在はMilestone 1として、Vue 3、TypeScript、Viteを用いた開発基盤だけを構成しています。Markdownの解析・変換機能はまだ実装していません。

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

## Milestone 1の主要依存関係

| 依存関係 | 用途 |
| --- | --- |
| Vue 3 | Composition APIを利用するUI基盤 |
| Vite / `@vitejs/plugin-vue` | 開発サーバー、本番ビルド、Vue単一ファイルコンポーネントの処理 |
| TypeScript / `vue-tsc` | TypeScriptと `.vue` ファイルの型チェック |
| Vitest / Vue Test Utils / jsdom | Vueコンポーネントの単体テスト |
| ESLint / Vue・TypeScript設定 | TypeScriptとVueコンポーネントの静的検査 |

正確な導入バージョンは `package-lock.json` で固定しています。Pinia、Vue Router、UIライブラリ、MarkdownパーサーはMilestone 1の対象外のため導入していません。
