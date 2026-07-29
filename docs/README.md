# ドキュメントガイド

このディレクトリには、現行仕様、実装計画、技術解説、対応履歴を保存する。
作業時はすべての文書を順番に読むのではなく、このガイドから対象機能の正本を選ぶ。

## ディレクトリ構成

```text
docs/
├─ README.md       # 文書の入口、正本、読む順番
├─ specs/          # 現行の製品・機能・変換仕様
├─ architecture/   # 現在の技術設計
├─ plans/          # 現在進行中または次に実施する計画
├─ archive/        # 完了済み計画と過去の判断経緯
└─ incident/       # 障害の事象、原因、対応記録
```

## 最初に読む文書

1. 開発ルールとしてルートの [`AGENTS.md`](../AGENTS.md) を読む
2. このガイドで対象機能の正本を確認する
3. [`specs/product-spec.md`](specs/product-spec.md) と対象の機能別仕様書を読む
4. 実装変更では [`plans/implementation-plan.md`](plans/implementation-plan.md) の対象範囲を確認する
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
| [`plans/implementation-plan.md`](plans/implementation-plan.md) | 現在のマイルストーン、対象範囲、完了条件 |
| [`architecture/parser-design.md`](architecture/parser-design.md) | Parserの採用理由、中間表現へ保持する情報、制約 |

実装計画は作業範囲を定める文書であり、製品仕様の正本ではない。設計文書は実装上の
判断を記録する資料であり、製品仕様を上書きしない。

## 履歴・記録

| 文書 | 役割 |
| --- | --- |
| [`archive/implementation-plan-completed.md`](archive/implementation-plan-completed.md) | 完了したマイルストーンの計画と判断経緯 |
| [`incident/raw-html-conversion.md`](incident/raw-html-conversion.md) | 生HTML変換障害の事象、原因、対応、検証結果 |

履歴・記録は当時の状況を保存する資料であり、現行仕様の正本として使用しない。

## 作業別の参照先

| 作業 | 必ず確認する文書 |
| --- | --- |
| 画面や共通動作の変更 | `specs/product-spec.md`、`plans/implementation-plan.md` |
| 変換処理の変更 | `specs/conversion-rules.md`、`plans/implementation-plan.md` |
| 文書タブ・保存の変更 | `specs/tab-management-spec.md`、`specs/product-spec.md`、`plans/implementation-plan.md` |
| フォーカスモードの変更 | `specs/focus-mode-spec.md`、`specs/product-spec.md`、`plans/implementation-plan.md` |
| 入力置換の変更 | `specs/input-replacement-spec.md`、`specs/product-spec.md`、`plans/implementation-plan.md` |
| 全角Markdown補正の変更 | `specs/full-width-markdown-normalization-spec.md`、`specs/product-spec.md`、`plans/implementation-plan.md` |
| Parser・中間表現の変更 | `architecture/parser-design.md`、関連する現行仕様、`plans/implementation-plan.md` |
| 不具合修正 | 再現箇所に対応する現行仕様と関連テスト |

## 更新ルール

- 製品仕様を変える場合は、コードより先に該当する現行仕様を更新する
- 新機能は `plans/implementation-plan.md` に対象範囲、対象外、完了条件を追加してから実装する
- 変換仕様を変える場合は、`specs/conversion-rules.md` と対応するテストを同じ作業で更新する
- 実装だけの詳細は仕様書へ重複させず、必要に応じて技術解説へ記録する
- 完了した計画は現行計画へ残し続けず、`archive/` へ移して履歴として保存する
- 文書間の矛盾を見つけた場合は推測で解消せず、差異と影響範囲を報告する
