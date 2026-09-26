# game-lab

ブラウザで遊べる小さなゲームの公開用リポジトリです。ビルド・サーバーサイド処理・外部ライブラリは不要です。

| ゲーム | 公開URL | コピー元（01_Games配下） |
| --- | --- | --- |
| ねこぷよ | https://nekomagu1002-lab.github.io/game-lab/nekopuyo/ | Game-Nekopuyo（0.1.1） |
| ねこぽん | https://nekomagu1002-lab.github.io/game-lab/nekopon/ | Game-Nekopon（v1.3、2026-09-26調整を含む） |
| 猫クリッカー | https://nekomagu1002-lab.github.io/game-lab/cat-clicker/ | Game-CatClicker/cat-clicker-02（V0.2） |

## 構成

- index.html：カード型ゲーム一覧
- assets/css/style.css：一覧専用CSS
- nekopuyo/：HTML、styles.css、src/（5本のJS）
- nekopon/：HTML、style.css、responsive.css、src/（8本のJS）
- cat-clicker/：HTML、style.css、4本のJS
- .nojekyll：静的ファイルをそのまま配信
- docs/PUBLICATION.md：公開用コピーの方針と検証結果

## GitHub Pages設定

Settings → Pages → Build and deployment → Deploy from a branch → main → / (root) → Save。
デプロイ完了後、https://nekomagu1002-lab.github.io/game-lab/ を開きます。

## 更新方法

元の開発プロジェクトで開発・検証し、必要な実行ファイルだけを該当ディレクトリへコピーしてください。開発元を移動・削除しません。.git、node_modules、バックアップ、ZIP、キャッシュ、開発用テストは持ち込みません。
HTMLからの参照は相対パスを維持し、/game-lab/以下を模したHTTP環境で一覧からの遷移と各ゲームの操作を確認してから、mainへ通常のcommit/pushを行います。
ゲーム追加時は専用ディレクトリと一覧のarticle.game-cardを追加し、表示件数も更新してください。ゲーム固有CSS/JSは共通化しません。

## 保存と素材

猫の描画はCanvas／インラインSVG、音はWeb Audioによる生成です。外部画像・音声ファイルの取得はありません。ねこぷよに音声はありません。
記録はねこぽんがnekopon.save.v1、猫クリッカーがcat-clicker-v02を使用し、互いに重複しません。localStorageは同一オリジン内で共有されるため、今後のゲームにも固有キーを使ってください。
開発元のfile://やlocalhostの保存データは公開URLへ自動移行しません。猫クリッカーは既存のセーブ引継ぎ機能を利用できます。
