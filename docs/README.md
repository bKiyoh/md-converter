# ドキュメントガイド

このディレクトリには、現行仕様、リリース前後の実装計画、技術解説、対応履歴を保存する。
作業時はすべての文書を順番に読むのではなく、このガイドから対象機能の正本を選ぶ。

## ディレクトリ構成

```text
docs/
├─ README.md       # 文書の入口、正本、読む順番
├─ specs/          # 現行の製品・機能・変換仕様
├─ architecture/   # 現在の技術設計
├─ designs/        # 未実装の改善案・方式検討
├─ plans/          # 初回リリースまでの実装計画
├─ post-release/   # リリース後の現行修正・改善計画
├─ release/        # リリース判断に使用する確認記録と配布情報
├─ archive/        # 完了済み計画と過去の判断経緯
└─ incident/       # 障害の事象、原因、対応記録
```

## 最初に読む文書

1. 開発ルールとしてルートの [`AGENTS.md`](../AGENTS.md) を読む
2. このガイドで対象機能の正本を確認する
3. [`specs/product-spec.md`](specs/product-spec.md) と対象の機能別仕様書を読む
4. 実装変更では [`post-release/maintenance-plan.md`](post-release/maintenance-plan.md) の対象範囲を確認する
5. 必要な場合だけ技術解説や履歴資料を参照する

## 現行仕様

| 文書 | 正本とする内容 |
| --- | --- |
| [`specs/product-spec.md`](specs/product-spec.md) | 画面、主要機能、対応範囲、共通する製品仕様 |
| [`specs/conversion-rules.md`](specs/conversion-rules.md) | Markdownから各出力形式への変換と警告 |
| [`specs/tab-management-spec.md`](specs/tab-management-spec.md) | 文書タブ、並べ替え、削除、復元、保存 |
| [`specs/focus-mode-spec.md`](specs/focus-mode-spec.md) | フォーカスモードの表示、操作、状態保持 |
| [`specs/input-replacement-spec.md`](specs/input-replacement-spec.md) | 入力置換の契機、ルール、設定、保存 |
| [`specs/full-width-markdown-normalization-spec.md`](specs/full-width-markdown-normalization-spec.md) | 全角Markdown補正の対象、除外条件、処理順序 |

`specs/product-spec.md` はアプリ全体の要約を持ち、機能別仕様書は対象機能の詳細を持つ。
両者に矛盾がある場合は、どちらかを推測で優先せず、実装前に差異を報告する。

## 開発・設計

| 文書 | 役割 |
| --- | --- |
| [`architecture/code-reading-guide.md`](architecture/code-reading-guide.md) | 開発者向けのコード構成、責務、データフロー、状態管理、テスト境界 |
| [`post-release/README.md`](post-release/README.md) | リリース前後の文書境界と、リリース後文書の更新ルール |
| [`post-release/maintenance-plan.md`](post-release/maintenance-plan.md) | リリース後の現行マイルストーン、修正候補、完了条件 |
| [`post-release/change-log.md`](post-release/change-log.md) | リリース後に実装・検証・公開が完了した変更の記録 |
| [`plans/implementation-plan.md`](plans/implementation-plan.md) | 初回リリース前の最終計画を保存する履歴 |
| [`architecture/parser-design.md`](architecture/parser-design.md) | Parserの採用理由、中間表現へ保持する情報、制約 |
| [`release/browser-verification.md`](release/browser-verification.md) | 正式対応ブラウザ、確認済み環境、リリース前の手動確認項目 |
| [`release/asset-provenance.md`](release/asset-provenance.md) | 画像・フォント資産の出典・加工履歴、ハッシュ、公開前の権利確認事項 |
| [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) | 依存パッケージの版、ライセンス、著作権表示、ライセンス全文 |

実装計画は作業範囲を定める文書であり、製品仕様の正本ではない。設計文書は実装上の
判断を記録する資料であり、製品仕様を上書きしない。

### フォーカスモード改善の設計案

以下は2026-10-15の改善依頼をNo.別に整理した設計書である。No.1はPR-10、No.2はPR-11、No.3はPR-12で対象実装と開発環境の検証を完了し、No.4はPR-13で比較・採用・実装と開発環境検証済み。No.5は代替案採用・確認済み（段落専用18pxは保留）、No.7はPR-15で実装・開発環境検証済み。No.6・8は未実装である。実機確認などの残件は各設計書と確認記録を参照する。
各文書は現状、推奨仕様、実現方法、変更予定ファイル、検証条件、残る判断を記録する。
現行仕様は引き続き `specs/` を正本とし、採用時に対象仕様と実装計画を先に更新する。
No.1・2に続き今回のNo.3を優先する指示によりPR-8の保留を維持した。次の改善対象はNo.8の背景比較・改善である。現在の作業範囲と状態は実装計画を参照する。

| No. | 設計書 | 優先度 | 主な検討内容 |
| --- | --- | --- | --- |
| 1 | [エディタの横幅調整](designs/focus-mode/no-01-editor-width.md) | 高 | 実装・幅検証済み。外側中央領域と本文幅を分け、本文の上限720pxを適用 |
| 2 | [フォントの最適化](designs/focus-mode/no-02-font-family.md) | 高 | 3案比較後、Noto Sans JP 400を自己ホストで実装。開発環境で検証済み、実機確認は残件 |
| 3 | [フォントサイズの調整](designs/focus-mode/no-03-font-size.md) | 高 | 16・17・18px相当の比較後、1.125remを実装。開発環境で拡大追従を検証済み、実機確認は残件 |
| 4 | [行間・文字間隔の調整](designs/focus-mode/no-04-line-and-letter-spacing.md) | 高 | 5案比較後に行高1.8・字間0.02emを採用・実装し、検索層との一致を検証済み |
| 5 | [段落間の余白調整](designs/focus-mode/no-05-paragraph-spacing.md) | 高 | 原文空行＋行間改善を利用者選択で採用・確認済み。18px専用余白は保留 |
| 6 | [タイプライターモード](designs/focus-mode/no-06-typewriter-mode.md) | 中 | カーソル座標計測、IME・検索・手動スクロールとの優先順位 |
| 7 | [本文文字数カウント](designs/focus-mode/no-07-character-count.md) | 中 | 既存の原文コードポイント数を再利用し下部へ表示、実装・検証済み |
| 8 | [背景デザイン改善](designs/focus-mode/no-08-background-design.md) | 中 | テーマ別の微細なグラデーションと視認性確認 |

採用する場合の推奨検討順はNo.1→2→3→4→5の方式判断→7→8→6。
本文の文字組みを先に決め、座標計測を伴うNo.6を最後に評価する。
これは実装開始や複数マイルストーンの同時実施を指示する順序ではない。
No.7・8は単独でも導入できる。No.5の希望仕様保留は他No.の検討を妨げない。方式判断は完了済み。

No.1は外側領域と本文幅を分け、PR-6の外側幅拡張方針と両立させる。PR-6は保留を維持する。No.2・4・5で指定された
参考サイトは本文・CSSを取得できず、サイトの実測値と提示された候補値は区別している。

## 履歴・記録

| 文書 | 役割 |
| --- | --- |
| [`archive/implementation-plan-completed.md`](archive/implementation-plan-completed.md) | 完了したマイルストーンの計画と判断経緯 |
| [`plans/implementation-plan.md`](plans/implementation-plan.md) | 初回リリース前の最終計画とリリース境界での状態 |
| [`post-release/change-log.md`](post-release/change-log.md) | 初回リリース後に公開した変更の要約 |
| [`incident/raw-html-conversion.md`](incident/raw-html-conversion.md) | 生HTML変換障害の事象、原因、対応、検証結果 |

履歴・記録は当時の状況を保存する資料であり、現行仕様の正本として使用しない。

## 作業別の参照先

| 作業 | 必ず確認する文書 |
| --- | --- |
| コード構成や変更影響を確認する | `architecture/code-reading-guide.md`、関心のある機能の現行仕様 |
| 画面や共通動作の変更 | `specs/product-spec.md`、`post-release/maintenance-plan.md` |
| 変換処理の変更 | `specs/conversion-rules.md`、`post-release/maintenance-plan.md` |
| 文書タブ・保存の変更 | `specs/tab-management-spec.md`、`specs/product-spec.md`、`post-release/maintenance-plan.md` |
| フォーカスモードの変更 | `specs/focus-mode-spec.md`、`specs/product-spec.md`、`post-release/maintenance-plan.md` |
| フォーカスモード改善案の検討・採用判断 | 上記の現行仕様・計画と、対象No.の `designs/focus-mode/` 設計書 |
| 入力置換の変更 | `specs/input-replacement-spec.md`、`specs/product-spec.md`、`post-release/maintenance-plan.md` |
| 全角Markdown補正の変更 | `specs/full-width-markdown-normalization-spec.md`、`specs/product-spec.md`、`post-release/maintenance-plan.md` |
| Parser・中間表現の変更 | `architecture/parser-design.md`、関連する現行仕様、`post-release/maintenance-plan.md` |
| 不具合修正 | 再現箇所に対応する現行仕様と関連テスト、`post-release/maintenance-plan.md` |

## 更新ルール

- 製品仕様を変える場合は、コードより先に該当する現行仕様を更新する
- リリース後の修正・新機能は `post-release/maintenance-plan.md` に対象範囲、対象外、完了条件を追加してから実装する
- 変換仕様を変える場合は、`specs/conversion-rules.md` と対応するテストを同じ作業で更新する
- 実装だけの詳細は仕様書へ重複させず、必要に応じて技術解説へ記録する
- 未実装の設計案は現行仕様と区別し、採用・保留・見送りの判断と実装後の文書状態を更新する
- 完了した計画は現行計画へ残し続けず、`archive/` へ移して履歴として保存する
- 初回リリース前の計画へ、リリース後の修正や改善を追記しない
- リリース後に公開した変更は `post-release/change-log.md` へ追記する
- 文書間の矛盾を見つけた場合は推測で解消せず、差異と影響範囲を報告する
