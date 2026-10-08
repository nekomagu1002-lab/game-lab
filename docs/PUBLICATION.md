# 公開用コピー・検証記録

## ねこロケット友人テスト版（2026-10-08）

公開必須31ファイルを追加しました。既存ゲームの変更は今回のcommitへ含めず、copy-manifest.jsonの既存24件もHEADの内容を維持して55件へ拡張しています。ローカルHTTP検証と開発元保持の記録は [NEKOROCKET-20261008.md](NEKOROCKET-20261008.md)、[verification-nekorocket-20261008.json](verification-nekorocket-20261008.json) を参照してください。Pages設定は変更しません。以下は初回コピー時点の記録です。

確認日：2026-09-26。元の開発フォルダには書き込まず、実行に必要な24ファイル（168,635 bytes）のみをコピーしました。元の開発ファイル389件は作業前後のSHA-256が一致しました（.git、node_modulesは比較対象外）。

## コピー元と内容

- Game-Nekopuyo → nekopuyo：index.html、styles.css、src/*.js（5本）、計7ファイル
- Game-Nekopon → nekopon：index.html、style.css、responsive.css、src/*.js（8本）、計11ファイル
- Game-CatClicker/cat-clicker-02 → cat-clicker：index.html、style.css、engine.js、cats.js、audio.js、game.js、計6ファイル

ゲームのHTML/CSS/JSは元ファイルとバイト単位で一致します。ゲーム固有ファイルは.gitattributesでGitの改行変換を無効にし、コピー時の内容を保持します。copy-manifest.jsonにコピー元相対パス・サイズ・SHA-256を記録しました。
.git、node_modules、バックアップ、開発用テスト、参考画像、ZIP、QA画像、キャッシュは公開対象外です。

## 追加ファイルと参照

一覧index.htmlとassets/css/style.css、README.md、.nojekyll、.gitignore、.gitattributes、この検証記録とマニフェストを追加しました。
一覧のゲームリンクは ./nekopuyo/、./nekopon/、./cat-clicker/。一覧CSSは ./assets/css/style.css です。
ゲームはもともとstyle.cssやsrc/app.js等の文書相対パスであり、ルート基準の参照を修正する必要はありませんでした。src/や直下の構成を保ち、無理なcss/js/assetsへの並べ替えはしていません。

## 動作確認

WindowsのMicrosoft Edge（Playwright、独立した一時プロファイル）で74項目PASS。詳細はverification.jsonを参照してください。

- ローカルHTTPで /game-lab/ 配下だけを配信し、ルート /assets/ 等へ逃げる要求は404となる条件で確認。
- 一覧の3リンクを実クリックし、各ゲームのサブディレクトリへ遷移。
- 一覧と3ゲームのindex.htmlをfile://で直接開き、オフラインでも動作確認。
- CSS読込、Canvas/SVG描画、ねこぷよの開始・移動・回転・落下・一時停止、ねこぽんの開始・猫落下・一時停止・BGM切替、猫クリッカーの加算・購入・自動進行・AudioContext稼働を確認。
- 1920×1080、1600×900、1366×768で一覧と3ゲームのプレイ画面にページ全体の縦横スクロールなし。スクリーンショットを目視確認。
- HTTP 404、ページ実行エラー、console.error、失敗リクエスト、外部HTTP通信は0件。
- 元ファイル389件の保持と公開用24ファイルのSHA-256一致を確認。

## 未確認・注意点

GitHub APIのリポジトリ情報では作業時点のhas_pagesはfalseでした。Settings → Pages → Deploy from a branch → main → / (root) → Saveを設定してください。公開サーバー上での最終確認はデプロイ後に必要です。
この検証は公開配置と基本操作を対象としており、全モード・クリア条件・長時間プレイの再検証はしていません。ゲームロジックは変更していません。Safari／Firefox／実機スマートフォンと実際の聴感は未確認です。
開発時の保存データは公開URLへ自動移行しません。記録はブラウザ保存で、オンライン同期はありません。ゲーム一覧へ戻る専用ボタンは追加していないため、ブラウザの戻る操作を利用できます。
