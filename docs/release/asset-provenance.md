# 配布資産の由来と権利確認

> 文書区分：リリース確認記録。この文書はリポジトリ、配布物と画像メタデータから確認できた事実を
> 記録するものであり、法的助言または権利の保証ではない。

## 現在の配布資産

| ファイル | 寸法 | SHA-256 |
| --- | ---: | --- |
| `public/favicon.png` | 64 × 64px | `e71a35e8f554357ad5deb410dffe2f40b2a0b714a842b9c2dcca74578cdc56f3` |
| `src/assets/title-icon-light.png` | 128 × 128px | `2fcbb29c7122ef32701a702c6b84959777eeb66613276e3195422368b9062bf5` |
| `src/assets/title-icon-dark.png` | 128 × 128px | `3f637d2a3394caefd07a9b15d23dd2495696a004a2336550d2ef89426a5ab921` |

3点はコミット `9b6ea21df5198bb4935ff9bd5343b360c180efc9`（2026-07-18、導入者：
Oyukawa）で初めて追加された。Gitのコミット作者は導入者を示すだけで、画像の制作者または
権利者であることを証明しない。

## 確認できた生成情報

追加時点の `public/favicon.png` に含まれていたC2PAマニフェストから、次を確認した。

- 作成日時：2026-07-18T00:00:00Z
- Software Agent：`gpt-image` 2.0
- Claim Generator：OpenAI Media Service API
- Digital Source Type：`trainedAlgorithmicMedia`
- C2PA仕様：2.2.0

この情報から、元faviconがOpenAIの画像生成サービスによる生成物であることは確認できる。
生成に使用したアカウント、入力プロンプト、入力画像、生成を依頼した人物はリポジトリに
記録されていない。

`title-icon-light.png` と `title-icon-dark.png` は同じコミットで追加され、同じシンボルを
使用しているが、生成ソフトウェアや加工手順を示すメタデータは保持していない。そのため、
元faviconから派生したものか、個別に生成したものかをリポジトリだけでは確定できない。

## 現在の加工履歴

コミット `5dd5beec0648c1529e2f44225c268ed87764deab`（2026-08-01）で、表示上の
シンボル、配色、背景・透過を維持したまま次の機械的な縮小を行った。

- favicon：1254 × 1254pxから64 × 64pxへ縮小
- ライト／ダーク用タイトル画像：1254 × 1254pxから128 × 128pxへ縮小
- 加工環境：Windowsの.NET `System.Drawing`
- 補間：High Quality Bicubic、Source Copy、32bit ARGB PNG

縮小後のPNGには元faviconのC2PAマニフェストを引き継いでいないため、由来の確認にはこの
文書とGit履歴を使用する。

## 利用条件の確認状況

[OpenAI Terms of Use](https://openai.com/policies/terms-of-use/)（2026-01-01発効）は、
OpenAIと利用者の間では、適用法令の範囲で利用者が出力を所有すると定める一方、出力が
一意とは限らないこと、入力に必要な権利を持ち、出力の利用へ責任を負うことも定めている。
どのOpenAI契約が元faviconの生成者へ適用されたかは、リポジトリから確認できない。

したがって、OpenAI生成という事実だけを公開利用の権利保証として扱わない。正式リリース
前に、権利者が次を確認し、この文書へ確認者と日付を追記する。

- 元faviconを生成したアカウントの利用者、またはその利用者から許諾を受けた者が、本プロジェクトでの公開利用を承認している
- 生成時の入力画像や指示に、許諾のない第三者の著作物・商標を使用していない
- ライト／ダーク用タイトル画像の制作者、生成・加工方法、本プロジェクトでの利用条件を説明できる
- 画像をアプリの識別標識として使用することについて、必要な商標調査または法務判断を完了している

現時点の権利確認状態は「未確認」であり、この状態を「公開承認済み」と読み替えない。

## Noto Sans JP 400（PR-11）

確認日：2026-10-15。画像資産とは独立して、公式配布物と付属ライセンスを確認した。

- 出典：[Google Fonts公式リポジトリの固定コミット](https://github.com/google/fonts/tree/66a36c8c94b1a5d992ee4e7f392fccfe4945767c/ofl/notosansjp)
- 原本：`NotoSansJP[wght].ttf`、9,589,900 bytes、Version 2.004-H2。METADATAの上流コミットは `notofonts/noto-cjk@523d033d6cb47f4a80c58a35753646f5c3608a78`
- 原本SHA-256：`c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f`
- 同梱物：`public/fonts/noto-sans-jp-400.woff2`、2,302,780 bytes（約2.20MiB）
- 同梱物SHA-256：`845e6c7ae83229c2d8f68876046be1bcff26b2a28cd5a14f497d5c502e82e957`
- 付属ライセンス：[OFL-NotoSansJP.txt](../../public/fonts/OFL-NotoSansJP.txt)、4,388 bytes、SHA-256 `1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9`
- ライセンス：配布物に付属するSIL OFL 1.1。著作権表示を含め全文を無変更で同梱する。Reserved Font Nameは「Source」であり、派生物のfamilyはNoto Sans JP、styleはRegularとする
- 加工：可変軸wghtを400へ固定し、instance名を更新、WOFF2圧縮。文字サブセットは削除していない。原本とのcmap一致（16,732コードポイント）、`fvar`の除去、`usWeightClass=400`を再読込して確認した
- 加工環境：macOS 14.5 arm64、Python 3.10、fontTools 4.65.0、Brotli 1.2.0。フォント更新時だけ使用し、npm依存・アプリ実行時・通常ビルドには追加しない

加工の再現手順（原本とOFLを上記コミットから取得してから実行）：

```python
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

font = TTFont("NotoSansJP[wght].ttf", recalcTimestamp=False)
font = instantiateVariableFont(font, {"wght": 400}, inplace=True, updateFontNames=True)
font.flavor = "woff2"
font.save("noto-sans-jp-400.woff2")
```

`THIRD_PARTY_NOTICES.md` はnpm依存から生成するため、静的フォントの案内も生成スクリプトに
追加した。ライセンス全文は生成対象から分離した `public/fonts/` に保存し、Viteでdistにも
配布する。生成し直しても案内が失われない。依存の既存不整合（PR-2）で生成・チェックを
実行できない場合は、依存一覧を書き換えず、静的フォント案内だけを同じ内容で追記する。

PR-18（2026-10-15）で同じWOFF2を通常モードの入力本文・検索層にも適用した。フォントファイル・ハッシュ・ライセンスに変更はない。初回取得はフォーカス開始時ではなく、通常画面の初期表示から必要時に行われる。
