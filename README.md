# marplint

Marpスライド用の高機能linter。オーバーフロー、余白、アクセシビリティなど様々な問題を検出・修正します。

## 機能一覧

### 静的ルール（高速、13種類）

| ルール | 説明 |
|--------|------|
| `marp/slide-line-count` | スライドあたりの行数チェック |
| `marp/slide-content-density` | コンテンツ密度（文字数/リスト項目数） |
| `marp/html-blank-lines` | HTMLタグとMarkdown間の空行 |
| `marp/missing-font-class` | font-classの提案 |
| `marp/balanced-columns` | 2カラムレイアウトのバランス |
| `marp/heading-hierarchy` | 見出しレベルの順序 |
| `marp/code-block-length` | コードブロックの長さ |
| `marp/link-validity` | リンク切れ検出 |
| `marp/japanese-consistency` | 全角/半角の一貫性 |
| `marp/slide-title-required` | 各スライドにタイトル必須 |
| `marp/table-structure` | テーブル構造の妥当性 |
| `marp/duplicate-content` | 重複スライド検出 |
| `marp/max-nested-list` | リストのネスト深度制限 |

### 視覚ルール（Playwright使用、6種類）

| ルール | 説明 |
|--------|------|
| `marp/overflow` | ピクセルオーバーフロー検出 |
| `marp/whitespace` | 過剰な余白検出 |
| `marp/font-readability` | フォントサイズの可読性 |
| `marp/color-contrast` | 色のコントラスト比（WCAG） |
| `marp/element-overlap` | 要素の重なり検出 |
| `marp/text-truncation` | テキスト切れ検出 |

### 高度な分析機能

- **複雑度スコアリング**: 各スライドの複雑さを0-100でスコア化
- **読了時間推定**: 日本語/英語を考慮した発表時間目安
- **アクセシビリティ監査**: alt属性、見出し階層、リンクテキストなど

## インストール

```bash
cd marplint
bun install
```

## 使い方

### 基本使用法

```bash
# 静的ルールのみ（高速）
bun run lint

# 視覚ルールを含む（完全チェック）
bun run lint:visual

# 特定のファイルをチェック
bun run marplint src/slides/part-01.md
```

### CLI オプション

```bash
# 静的ルールのみ
marplint --static src/slides/*.md

# 視覚ルールを含む
marplint --visual src/slides/*.md

# 自動修正
marplint --fix src/slides/*.md

# 修正のプレビュー（変更なし）
marplint --fix-dry-run src/slides/*.md

# ファイル変更を監視
marplint --watch src/slides/*.md

# 高度な分析
marplint --analyze src/slides/*.md

# 特定ルールのみ
marplint --rule marp/overflow src/slides/part-01.md

# JSON出力
marplint --format json src/slides/*.md

# HTMLレポート出力
marplint --format html src/slides/*.md > report.html
```

### 自動修正対応ルール

`--fix` オプションで自動修正できるルール:

- `marp/html-blank-lines` - HTMLタグ周りに空行を追加
- `marp/missing-font-class` - font-classディレクティブを追加
- `marp/heading-hierarchy` - H1をH2に変換

## 設定

`.marplintrc.json` で設定をカスタマイズ:

```json
{
  "rules": {
    "marp/slide-line-count": {
      "enabled": true,
      "maxLines": 30,
      "minLines": 5
    },
    "marp/overflow": {
      "enabled": true,
      "threshold": 10
    },
    "marp/font-readability": {
      "enabled": true,
      "minFontSize": 12,
      "warnFontSize": 16
    },
    "marp/color-contrast": {
      "enabled": true,
      "minContrastRatio": 4.5
    }
  },
  "viewport": {
    "width": 1280,
    "height": 720
  }
}
```

## Git Hooks

pre-commitフックをインストール:

```bash
bash marplint/scripts/install-hooks.sh
```

コミット前に自動でlintが実行されます。

## 分析レポート

```bash
bun run marplint --analyze src/slides/*.md
```

出力例:
```
📊 Document Analysis Report
============================

📈 Summary
----------
Total Slides: 24
Average Complexity: 18/100 (Simple)
Estimated Reading Time: 13:12
Average Accessibility: 100/100

💡 Recommendations
------------------
• 2 slides are very complex. Consider simplifying slides 5, 12.
• 1 slide may take >2 minutes to present. Consider splitting slide 8.
```

## 技術スタック

- TypeScript
- Commander.js（CLI）
- Playwright（視覚ルール）
- Chokidar（ファイル監視）
- Chalk（カラー出力）

## プロジェクト構造

```
marplint/
├── src/
│   ├── index.ts              # CLI エントリーポイント
│   ├── rules/                # 静的ルール (13種類)
│   ├── visual/               # 視覚ルール (6種類)
│   ├── fixers/               # 自動修正機能
│   ├── analysis/             # 高度な分析機能
│   └── utils/                # ユーティリティ
├── scripts/
│   ├── pre-commit            # Git hook
│   └── install-hooks.sh      # Hook インストーラ
├── .marplintrc.json          # 設定ファイル例
└── package.json
```

## バージョン履歴

- **v1.2.0**: 高度な分析機能（複雑度、読了時間、アクセシビリティ）
- **v1.1.0**: 自動修正、ウォッチモード、HTMLレポート
- **v1.0.0**: 初期リリース（5静的ルール + 2視覚ルール）
