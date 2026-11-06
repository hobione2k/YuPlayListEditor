# YutPlayList

YouTube動画の再生リストを作って、ブラウザ上で埋め込み再生できるシンプルなツール

## 使い方

YouTubeの埋め込み再生にはリファラ（ページのオリジン）が必要なため、`index.html` を直接開く（`file://`）とエラーになる場合があります。
ローカルサーバー経由で開いてください。

```sh
# 例: Pythonを使う場合
python -m http.server 8000
# → ブラウザで http://localhost:8000/ を開く
```

* 再生リストはアコーディオン形式で複数作成可能
  * 「＋ 新しい再生リスト」で作成、見出しの ▶ で開閉、「削除」でリストごと削除
  * 見出しの再生リスト名はその場で直接編集可能（空欄にすると「無題の再生リスト」）
* 開いた再生リスト内の入力欄にYouTube動画のURLを入れて「追加」で再生リストに追加
  * 対応形式: `youtube.com/watch?v=…` / `youtu.be/…` / `youtube.com/shorts/…` / `youtube.com/embed/…` / `youtube.com/live/…` / 動画ID（11文字）
* 再生リストの項目をクリック（またはEnterキー）で埋め込み再生
* 項目左端の「⠿」をドラッグして順番を変更（項目選択中に Alt+↑↓ キーでも移動可）
* 「削除」ボタンで再生リストから削除
* 再生リストはブラウザ（localStorage）に保存され、次回開いたときも残ります
* [YamaPlayer](https://github.com/koorimizuw/YamaPlayer) のプレイリストJSON形式でインポート / エクスポート（画面下部の「YamaPlayer」メニューを開いて操作）
  * エクスポート: 全ての再生リストを1つのJSONファイルとしてダウンロード（YouTube動画は `Mode: 1`（AVPro）で出力）
  * インポート: JSONファイル内の再生リストを、既存の再生リストの後ろに追加（YouTube以外のURLは取り込みません）
* 右上（テーマ切り替えボタンの左）の矢印ボタンで埋め込み動画の拡大表示をON/OFF（ON: 画面に収まる範囲で最大表示、OFF: パネル幅いっぱい、選択はブラウザに保存）
* 右上のボタンでライト / ダークテーマを切り替え（初期状態はOSの設定に従い、選択はブラウザに保存）

## 外部通信について

CSP（Content-Security-Policy）で通信先を次のものに限定しています。フォーム送信は禁止しています。

| 用途 | 通信先 |
| --- | --- |
| 動画の埋め込み再生（プライバシー強化モード） | `https://www.youtube-nocookie.com` |
| サムネイル画像 | `https://i.ytimg.com` |
| 動画タイトルの取得（oEmbed） | `https://www.youtube.com` |

タイトルが取得できなかった場合は「動画 （動画ID）」と表示します。

## ディレクトリ構成

```text
index.html        画面
css/style.css     スタイル
js/app.js         URL解析・再生リスト管理・埋め込み再生の処理
js/theme.js       ライト / ダークテーマの切り替え
js/player-size.js 埋め込み動画の拡大表示ON/OFFの切り替え
js/yamaplayer.js  YamaPlayer形式JSONとの相互変換
docs/spec.md      仕様
```

## AIの利用について

このツールはClaudeCodeを使用して作成しています。
