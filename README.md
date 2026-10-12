# Inoue Hinata — Portfolio

井上陽向汰の個人ポートフォリオサイトのソースコードです。

## 🔗 サイトを見る

**[https://magu0914.github.io/](https://magu0914.github.io/)**

ブラウザ拡張機能・Discord Bot・Webゲームなど、これまで個人で作ってきた作品をまとめています。

## 📝 概要

| | |
|---|---|
| 著者 | 井上 陽向汰 (Inoue Hinata) |
| 所属 | 長崎県立大学大学院 情報工学専攻 人間情報科学コース 修士1年 |
| 修了予定 | 2028年3月 |
| Location | 長崎 |

## 🛠 技術

- **HTML / CSS / Vanilla JS**、ビルドなし・フレームワークなし
- 外部依存は Google Fonts のみ
- GitHub Pages でホスティング

## ✨ 仕掛け

| | |
|---|---|
| 見え方の切り替え | ヘッダーで「通常 / P型 / D型 / 補正」を切り替えると、サイト全体に修士研究と同じ色変換（Machado 2009 / Daltonize）が SVG `feColorMatrix` でかかる。`color-interpolation-filters="linearRGB"` を明示して線形RGBで計算 |
| 見え方比較スライダー | 自作 Breakout の配色を P型シミュレーションと並べて比較 |
| Play the title | タイトル文字をサンプリングしてブロックにし、その場でブロック崩しができる。本編と同じ重み付き抽選でアイテム（WIDE / MULTI / PIERCE / SLOW / BOMB）が落ちる。ボタンを押したときだけ動く |
| 実績 | 13個。見え方を切り替える、タイトルを崩しきる、制作記事を全部読む…などで解除（localStorage） |
| 8bit モード | ↑↑↓↓←→←→BA |
| ハイスコア | Breakout を遊んだことがあるブラウザでは、作品カードにハイスコアが出る（同一オリジンの localStorage） |
| 404 | GAME OVER / CONTINUE? |

アクセシビリティ: 小さい文字は WCAG AA（4.5:1）以上、`prefers-reduced-motion` 対応、キーボードだけで全操作可能、状態は色だけで示さない。

## 📁 構成

```
index.html            トップページ
works/*.html          作品ごとの制作記事（きっかけ・流れ・工夫・嫌だったこと→直したこと）
works/feature.css
assets/style.css      デザイン（タイトル画面とステージセレクト）
assets/site.js        見え方切り替え / 比較スライダー / ハイスコア表示
assets/fun.js         実績 / 8bit モード
assets/title-breakout.js
404.html
```

## 📂 掲載作品

| # | 作品 | リポジトリ |
|---|---|---|
| 01 | Character Counter — 文字カウント拡張 | [character-counter](https://github.com/magu0914/character-counter) |
| 02 | Photo Tagger — Google フォト用タグ管理 | [photo-tagger](https://github.com/magu0914/photo-tagger) |
| 03 | Senryu Bot — Discord 川柳検出 Bot | [senryu-bot](https://github.com/magu0914/senryu-bot) |
| 04 | Breakout — ブロック崩しゲーム | [break-out-game](https://github.com/magu0914/break-out-game) |

## 📬 Contact

- Email: hinatainoue0914@gmail.com
- GitHub: [@magu0914](https://github.com/magu0914)

## License

MIT
