# game-lab

ブラウザで遊べる小さなゲームの公開用リポジトリです。ビルド・サーバーサイド処理・外部ライブラリは不要です。

| ゲーム | 公開URL | コピー元（01_Games配下） |
| --- | --- | --- |
| ねこぷよ | https://nekomagu1002-lab.github.io/game-lab/nekopuyo/ | Game-Nekopuyo（0.1.1） |
| ねこぽん | https://nekomagu1002-lab.github.io/game-lab/nekopon/ | Game-Nekopon（v1.3、2026-09-26調整を含む） |
| ねこロケット | https://nekomagu1002-lab.github.io/game-lab/nekorocket/ | Game-NekoRocket（友人テスト版） |
| 猫クリッカー | https://nekomagu1002-lab.github.io/game-lab/cat-clicker/ | Game-CatClicker/cat-clicker-02（V0.2） |

2026-10-08：ねこロケット友人テスト版の公開用31ファイルを追加しました。開発元は保持しています。ローカルHTTP検証の詳細は [NEKOROCKET-20261008.md](docs/NEKOROCKET-20261008.md) を参照してください。

## 構成

- index.html：カード型ゲーム一覧
- assets/css/style.css：一覧専用CSS
- nekopuyo/：HTML、styles.css、src/（5本のJS）
- nekopon/：HTML、style.css、responsive.css、src/（8本のJS）
- cat-clicker/：HTML、style.css、4本のJS
- nekorocket/：HTML、CSS、JS（9本）、WAV（18本）、MIDI（2本）、計31ファイル
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

猫の描画はCanvas／インラインSVGです。既存3ゲームは外部画像・音声ファイルを取得せず、ねこぽん・猫クリッカーの音はWeb Audioで生成します。ねこぷよに音声はありません。
ねこロケットは同じゲームディレクトリ内のWAV効果音とMIDI BGMを読み込みます。MIDIは簡易Web Audioシンセで再生し、MP3を配置した曲はMP3が優先されます。タイトル／ステージ選択BGMは未配置の既知仕様で、無音・警告ログのままゲームを続行します。初期設定は音OFFです。調整・実験（D）と診断UIは友人テスト版に残しています。
ねこロケットの進行・設定は保存されません。公開コピーにはfile://起動用の.mid.jsを含めていないため、ローカル確認もHTTPで行ってください。
記録はねこぽんがnekopon.save.v1、猫クリッカーがcat-clicker-v02を使用し、互いに重複しません。localStorageは同一オリジン内で共有されるため、今後のゲームにも固有キーを使ってください。
開発元のfile://やlocalhostの保存データは公開URLへ自動移行しません。猫クリッカーは既存のセーブ引継ぎ機能を利用できます。
