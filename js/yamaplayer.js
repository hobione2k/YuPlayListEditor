'use strict';

// ===== YamaPlayer形式JSONとの相互変換 =====
// 形式はYamaPlayer(Editor/Playlist/PlaylistExporter.cs)の出力に準拠する
//   {
//     "playlists": [
//       {
//         "active": true,
//         "name": "再生リスト名",
//         "tracks": [ { "playerType": 1, "title": "動画タイトル", "url": "動画URL" } ],
//         "youtubeListId": ""
//       }
//     ]
//   }
// playerType は YamaPlayer の VideoPlayerType 列挙型の数値
const YAMA_PLAYER_TYPE = {
  UnityVideoPlayer: 0,
  AVProVideoPlayer: 1,
  ImageViewer: 2,
  Other: 3,
};

// YouTube動画はAVProで再生する(YamaPlayerのYouTube取り込み処理と同じ)
const YAMA_DEFAULT_PLAYER_TYPE = YAMA_PLAYER_TYPE.AVProVideoPlayer;

// 本ツールの再生リスト一覧をYamaPlayer形式のJSON文字列に変換する
function toYamaPlayerJson(playlists) {
  const data = {
    playlists: playlists.map((list) => ({
      // 読み込み時に保持した値があれば引き継ぎ、無ければ既定値にする
      active: typeof list.active === 'boolean' ? list.active : true,
      name: list.name,
      tracks: list.items.map((item) => ({
        playerType: Number.isInteger(item.playerType) ? item.playerType : YAMA_DEFAULT_PLAYER_TYPE,
        title: item.title,
        url: item.url,
      })),
      youtubeListId: typeof list.youtubeListId === 'string' ? list.youtubeListId : '',
    })),
  };
  // YamaPlayerの出力(Newtonsoft.Json Indented)に合わせて2スペースで整形する
  return JSON.stringify(data, null, 2);
}

// オブジェクトから、候補のキー名(camelCase / PascalCase など)の順に値を取り出す
function pickValue(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

// YamaPlayer形式のJSON文字列を解析し、本ツールの再生リスト形式に変換する
//   extractVideoId: URLからYouTube動画IDを取り出す関数
//   watchUrl: 動画IDから視聴ページURLを作る関数
// 戻り値: { playlists: [{ name, active, youtubeListId, items }], skipped: 取り込めなかったトラック数 }
// 形式が不正な場合は例外を投げる
function parseYamaPlayerJson(text, extractVideoId, watchUrl) {
  // 先頭にBOMが付いている場合は取り除いてから解析する
  const root = JSON.parse(text.replace(/^﻿/, ''));
  const rawLists = pickValue(root, ['playlists', 'Playlists']);
  if (!Array.isArray(rawLists)) {
    throw new Error('"playlists" が見つかりません');
  }

  let skipped = 0;
  const playlists = rawLists
    .filter((p) => p && typeof p === 'object')
    .map((p) => {
      const rawTracks = pickValue(p, ['tracks', 'Tracks']);
      const items = [];

      (Array.isArray(rawTracks) ? rawTracks : []).forEach((t) => {
        const url = String(pickValue(t, ['url', 'Url']) ?? '');
        const id = extractVideoId(url);
        // YouTube以外のURLや、同じリスト内で重複する動画は取り込まない
        if (!id || items.some((v) => v.id === id)) {
          skipped++;
          return;
        }
        const title = String(pickValue(t, ['title', 'Title']) ?? '').trim();
        const playerType = Number(pickValue(t, ['playerType', 'mode', 'Mode']));
        items.push({
          id,
          title: title || `動画 ${id}`,
          url: watchUrl(id),
          // 再エクスポート時に元の再生方式を保つため保持する
          playerType: Number.isInteger(playerType) ? playerType : YAMA_DEFAULT_PLAYER_TYPE,
        });
      });

      const name = String(pickValue(p, ['name', 'Name']) ?? '').trim();
      const active = pickValue(p, ['active', 'Active']);
      const youtubeListId = pickValue(p, ['youtubeListId', 'YoutubeListId']);
      return {
        name,
        // 本ツールでは使わないが、再エクスポート時に引き継ぐため保持する
        active: typeof active === 'boolean' ? active : true,
        youtubeListId: typeof youtubeListId === 'string' ? youtubeListId : '',
        items,
      };
    });

  return { playlists, skipped };
}
