# 生HTMLを含むMarkdownが変換できない事象

## ステータス

- 発生日：2026-07-13
- 対応マイルストーン：Milestone 12
- 状態：対応完了

## 事象

主要なMarkdown要素をまとめた確認用文章へ次の生HTMLを含めると、変換結果が空になり、汎用警告だけが表示された。

```md
通常の文章

<div>テスト</div>

後続の文章
```

表示された警告：

```text
Markdownを変換できませんでした。入力内容を確認してください。
```

## 原因

`remark-parse`は`<div>テスト</div>`を有効なMarkdown内のブロックHTMLノードとして解析する。一方、`normalizeMarkdownAst`は生HTMLをMVP対象外として例外にしていた。

例外は`App.vue`の変換境界で一律に捕捉され、変換結果全体が空文字へ置き換えられていた。そのため、生HTML以外の変換可能な見出し、段落、リストなども出力されなかった。

生HTMLは不正なMarkdownではなく、既知の未対応要素である。これを`invalid-structure`として扱い、入力内容の確認を求める表示は原因と一致していなかった。

## 対応方針

1. 生HTMLのブロックノードとインラインノードを中間表現へ追加する。
2. 正規化時に例外を投げず、元文字列と位置情報を保持する。
3. 各Converterは生HTMLをHTMLとして解釈せず、出力先に応じてエスケープした文字列として保持する。
4. 生HTMLノードごとに`unsupported-node`警告を返す。
5. 生HTML以外の文書内容は通常どおり変換する。
6. Markdownプレビューでは既存どおり生HTMLを破棄し、DOMへ出力しない。
7. 生HTMLではUI境界の汎用catchへ到達させず、catchの文言は入力不備と断定しない内容へ変更する。

## 期待結果

上記入力では変換結果を空にせず、通常の文章、生HTMLの原文、後続の文章を保持する。また、生HTMLの開始位置を含む次の警告を表示する。

```text
生HTMLには対応していないため、文字列として保持しました。
```

## 対象外

- 生HTMLのレンダリング
- HTMLタグの除去やDOMとしての解釈
- HTMLパーサーまたはサニタイザーの追加
- 画像や脚注など、生HTML以外の未対応Markdown要素の同時対応

## 実装結果

- ブロックHTMLを`rawHtmlBlock`、インラインHTMLを`rawHtmlInline`として中間表現へ保持した。
- 4つのConverterで生HTMLの原文を保持し、`unsupported-node`警告を返すようにした。
- Backlog MarkdownとBacklog記法では、既存の通常テキスト用エスケープを適用した。
- Markdownプレビューでは生HTMLを破棄する既存動作を維持した。
- UI境界の汎用エラー文言を、予期しないエラーであることと入力が保持されることを示す内容へ変更した。
- パーサー、4つのConverter、画面結合テストへ回帰ケースを追加した。

## 検証結果

2026-07-13に以下を実行し、すべて成功した。

```text
npm run lint
npm run type-check
npm run test       # 13ファイル、137件成功
npm run build
git diff --check
```
