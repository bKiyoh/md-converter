# 対応ブラウザと確認記録

> 文書区分：リリース確認記録。製品としての対応範囲は
> [`../specs/product-spec.md`](../specs/product-spec.md) を正本とする。

## 正式対応範囲

| 環境 | 最低バージョン | 備考 |
| --- | ---: | --- |
| Google Chrome（Windows、macOS） | 111 | Chromium系の基準環境 |
| Microsoft Edge（Windows、macOS） | 111 | Chromium系の企業利用環境 |
| Mozilla Firefox（Windows、macOS） | 114 | Gecko固有の編集・Clipboard挙動を手動確認する |
| Safari（macOS） | 16.4 | WebKit固有の編集・Clipboard挙動を手動確認する |
| Google Chrome（Android） | 111 | 320px幅とモバイルタブを実機確認する |
| Safari（iOS、iPadOS） | 16.4 | 320px幅、IME、フォーカス移動を実機確認する |

最低バージョンは、Vite 8の本番ビルド既定値
[`baseline-widely-available`](https://vite.dev/config/build-options.html#build-target) の
Chrome 111、Edge 111、Firefox 114、Safari 16.4、iOS 16.4を基準とする。Android Chromeは
同じChrome 111を下限とする。独自のレガシー向けpolyfillは追加しない。

Internet Explorer、最低バージョン未満のブラウザ、アプリ内WebView、タッチ専用操作による
Markdownタブの並べ替えは対象外とする。

## 2026-08-01の確認結果

| 対象 | 方法 | 結果 |
| --- | --- | --- |
| 単体・コンポーネント動作 | Vitest / jsdom | 自動テスト成功。実ブラウザAPIや見た目の保証には使用しない |
| 本番配布物 | `npm run build` | Vite 8の既定ターゲットでビルド成功 |
| Google Chrome 150.0.7871.187 / Windows | `vite preview`をヘッドレス表示 | ページタイトルとMarkdown入力欄のDOM描画を確認 |
| Microsoft Edge 150.0.4078.105 / Windows | `vite preview`をヘッドレス表示 | ページタイトルとMarkdown入力欄のDOM描画を確認 |
| Firefox 114以降 | 実ブラウザ | 未確認 |
| macOS Safari 16.4以降 | 実機 | 未確認 |
| Android Chrome 111以降 | 実機 | 未確認 |
| iOS／iPadOS Safari 16.4以降 | 実機 | 未確認 |
| 各ブラウザの最低バージョン | 実ブラウザ | 未確認 |

ヘッドレス表示は起動と初期描画のスモーク確認であり、IME、Clipboard、ネイティブ編集履歴、
ドラッグ、タッチ、視覚的なレイアウトの確認を代替しない。未確認行は確認済みとして扱わない。

## リリース前の実ブラウザ確認

正式リリースの候補ビルドをHTTPSで配信し、対象OSとブラウザの組み合わせごとに次を確認する。

- 日本語IMEの入力・変換・確定中に、Markdown補正や入力置換が確定前の文字列を壊さない
- `Ctrl`／`Command + Z` とRedoで、直接入力、置換、全角Markdown補正を戻せる
- Clipboardを許可した場合にコピーでき、拒否した場合に失敗通知と手動コピー手段が表示される
- LocalStorage保存、再読み込み復元、利用不可時の永続警告と再試行が動作する
- マウス／トラックパッドのドラッグと、キーボードのF2、`Alt + ←` / `Alt + →` でタブを操作できる
- 320px幅、767px境界、PC幅の200%ズームで主要操作が隠れず、横スクロールに依存しない
- ライト／ダーク、フォーカスモード、情報・設定・完全削除モーダルのフォーカス移動とEscape終了が動作する
- Slack、Backlog Markdown、Backlog記法、プレーンテキストの出力を対象サービスまたはテキスト入力欄へ貼り付けられる

確認時はブラウザ名、完全なバージョン、OS／端末、確認日、失敗した項目をこの文書へ追記する。
