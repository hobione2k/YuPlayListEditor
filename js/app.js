'use strict';

// ===== 定数 =====
// 複数の再生リストを保存するlocalStorageのキー
const STORAGE_KEY = 'yutplaylist.playlists';
// 旧バージョン(再生リスト1つのみ)の保存キー(移行用)
const LEGACY_STORAGE_KEY = 'yutplaylist.items';
// 埋め込み再生に使うURL(プライバシー強化モード)
const EMBED_BASE = 'https://www.youtube-nocookie.com/embed/';
// タイトル取得に使うoEmbedのURL
const OEMBED_BASE = 'https://www.youtube.com/oembed?format=json&url=';
// 再生リスト名が空のときに使う名前
const DEFAULT_LIST_NAME = '無題の再生リスト';
// 再生リスト名の最大文字数
const MAX_NAME_LENGTH = 50;

// ===== DOM要素 =====
const accordionEl = document.getElementById('accordion');
const noListsEl = document.getElementById('no-lists');
const newListBtn = document.getElementById('new-list');
const statusEl = document.getElementById('status');
const importBtn = document.getElementById('import-json');
const exportBtn = document.getElementById('export-json');
const importFileInput = document.getElementById('import-file');
const playerEl = document.getElementById('player');
const nowPlayingEl = document.getElementById('now-playing');

// ===== 状態 =====
// 再生リスト一覧: { id, name, open, items: [{ id, title, url }] } の配列
//   open: アコーディオンが開いているかどうか
let playlists = loadPlaylists();
// 再生中の動画: { listId, videoId }(未再生ならnull)
let playing = null;

// ===== 保存・読み込み =====

// 再生リスト識別用のIDを生成する
function createListId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 再生リストを1つ作る
function createPlaylist(name, items = [], open = true) {
  return { id: createListId(), name, open, items };
}

// localStorageから再生リスト一覧を読み込む
// (保存が無ければ旧バージョンのデータを移行し、それも無ければ空のリストを1つ作る)
function loadPlaylists() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.playlists)) {
      // 旧形式(プルダウン版)の選択中リストは開いた状態で引き継ぐ
      return data.playlists.map((p) => ({
        ...p, // YamaPlayerから取り込んだ付加情報(active / youtubeListId)も保持する
        open: typeof p.open === 'boolean' ? p.open : p.id === data.currentListId,
        items: Array.isArray(p.items) ? p.items : [],
      }));
    }
  } catch {
    // 読み込み失敗時は下の初期化処理へ
  }

  // 旧バージョン(リスト1つのみ)のデータがあれば「再生リスト1」として引き継ぐ
  let legacyItems = [];
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (Array.isArray(legacy)) legacyItems = legacy;
  } catch {
    // 旧データが壊れている場合は空で開始
  }
  return [createPlaylist('再生リスト1', legacyItems)];
}

// 再生リスト一覧をlocalStorageへ保存する
function savePlaylists() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ playlists }));
  } catch {
    statusEl.textContent = '再生リストを保存できませんでした';
  }
}

// IDから再生リストを探す
function findList(listId) {
  return playlists.find((p) => p.id === listId);
}

// ===== URL解析 =====

// 入力されたURL(または動画ID)からYouTubeの動画IDを取り出す
function extractVideoId(input) {
  const text = input.trim();
  const idPattern = /^[A-Za-z0-9_-]{11}$/;

  // 動画IDそのものが入力された場合
  if (idPattern.test(text)) return text;

  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = null;

  if (host === 'youtu.be') {
    // 短縮URL: https://youtu.be/ID
    id = url.pathname.split('/')[1];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      // 通常URL: https://www.youtube.com/watch?v=ID
      id = url.searchParams.get('v');
    } else {
      // ショート・埋め込み・ライブ: /shorts/ID, /embed/ID, /live/ID
      const match = url.pathname.match(/^\/(shorts|embed|live|v)\/([^/?#]+)/);
      if (match) id = match[2];
    }
  }

  return id && idPattern.test(id) ? id : null;
}

// ===== URL生成 =====

// 動画の視聴ページURL
function watchUrl(id) {
  return `https://www.youtube.com/watch?v=${id}`;
}

// 動画のサムネイル画像URL
function thumbnailUrl(id) {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

// ===== タイトル取得 =====

// oEmbedで動画タイトルを取得する(取得できなければnull)
async function fetchTitle(id) {
  try {
    const res = await fetch(OEMBED_BASE + encodeURIComponent(watchUrl(id)), {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.title === 'string' ? data.title : null;
  } catch {
    return null;
  }
}

// ===== 描画 =====

// アコーディオン全体を描き直す
function renderAll() {
  accordionEl.replaceChildren(...playlists.map(createListElement));
  noListsEl.hidden = playlists.length > 0;
}

// 指定した再生リスト1つ分だけ描き直す(他のリストの入力状態を保つため)
function rerenderList(listId) {
  const list = findList(listId);
  const oldEl = accordionEl.querySelector(`[data-list-id="${listId}"]`);
  if (!list || !oldEl) return null;
  const newEl = createListElement(list);
  oldEl.replaceWith(newEl);
  return newEl;
}

// 再生リスト1つ分のアコーディオン要素を作る
function createListElement(list) {
  const section = document.createElement('section');
  section.className = 'acc';
  section.dataset.listId = list.id;
  const bodyId = `acc-body-${list.id}`;

  // --- 見出し部分(開閉ボタン・名前入力欄・件数・削除ボタン) ---
  const header = document.createElement('div');
  header.className = 'acc-header';

  // 開閉ボタン
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'acc-toggle';
  toggle.textContent = '▶';
  toggle.setAttribute('aria-controls', bodyId);
  toggle.addEventListener('click', () => toggleList(list.id, section));

  // 再生リスト名の入力欄(直接編集可能)
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'acc-name';
  nameInput.value = list.name;
  nameInput.maxLength = MAX_NAME_LENGTH;
  nameInput.setAttribute('aria-label', '再生リスト名');
  // 入力のたびに名前を保存する(再描画はしないので入力中のフォーカスは保たれる)
  nameInput.addEventListener('input', () => {
    list.name = nameInput.value;
    savePlaylists();
  });
  // 編集完了時、空欄なら既定の名前に戻す
  nameInput.addEventListener('blur', () => {
    const trimmed = nameInput.value.trim();
    list.name = trimmed || DEFAULT_LIST_NAME;
    nameInput.value = list.name;
    savePlaylists();
  });
  // Enterキーで編集を確定する
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nameInput.blur();
  });

  // 登録件数
  const count = document.createElement('span');
  count.className = 'acc-count';
  count.textContent = `${list.items.length}件`;

  // 再生リスト削除ボタン
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'acc-delete';
  del.textContent = '削除';
  del.setAttribute('aria-label', `再生リスト「${list.name}」を削除`);
  setupTwoStepDelete(del, () => deleteList(list.id));

  header.append(toggle, nameInput, count, del);

  // --- 本体部分(動画追加フォーム・動画一覧) ---
  const body = document.createElement('div');
  body.className = 'acc-body';
  body.id = bodyId;

  // 動画追加フォーム
  const form = document.createElement('form');
  form.className = 'add-form';
  form.autocomplete = 'off';
  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.className = 'url-input';
  urlInput.placeholder = 'YouTube動画のURLを入力';
  urlInput.required = true;
  const addBtn = document.createElement('button');
  addBtn.type = 'submit';
  addBtn.textContent = '追加';
  form.append(urlInput, addBtn);

  // メッセージ表示欄
  const message = document.createElement('p');
  message.className = 'message';
  message.setAttribute('role', 'status');

  // 追加フォームの送信(ページ遷移はさせない)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!urlInput.value.trim()) return;
    addItem(list.id, urlInput.value, message);
  });

  // 動画一覧
  const ul = document.createElement('ul');
  ul.className = 'playlist';
  ul.replaceChildren(...list.items.map((item) => createItemElement(list.id, item)));

  // 空のときの表示
  const empty = document.createElement('p');
  empty.className = 'empty';
  empty.textContent = '再生リストは空です';
  empty.hidden = list.items.length > 0;

  body.append(form, message, ul, empty);
  section.append(header, body);

  // 開閉状態を反映する
  applyOpenState(section, list.open);
  return section;
}

// アコーディオンの開閉状態を要素に反映する
function applyOpenState(section, open) {
  section.classList.toggle('open', open);
  section.querySelector('.acc-toggle').setAttribute('aria-expanded', String(open));
  section.querySelector('.acc-toggle').setAttribute('aria-label', open ? '再生リストを閉じる' : '再生リストを開く');
  section.querySelector('.acc-body').hidden = !open;
}

// 動画一覧の1行分の要素を作る
function createItemElement(listId, item) {
  const li = document.createElement('li');
  li.className = 'playlist-item';
  li.tabIndex = 0;
  li.dataset.id = item.id;
  if (playing && playing.listId === listId && playing.videoId === item.id) {
    li.classList.add('active');
  }

  // サムネイル
  const img = document.createElement('img');
  img.src = thumbnailUrl(item.id);
  img.alt = '';
  img.loading = 'lazy';

  // タイトルとURL
  const info = document.createElement('div');
  info.className = 'item-info';
  const title = document.createElement('p');
  title.className = 'item-title';
  title.textContent = item.title;
  title.title = item.title;
  const url = document.createElement('p');
  url.className = 'item-url';
  url.textContent = item.url;
  url.title = item.url;
  info.append(title, url);

  // 削除ボタン
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'delete-btn';
  del.textContent = '削除';
  del.setAttribute('aria-label', `${item.title} を削除`);
  del.addEventListener('click', (e) => {
    e.stopPropagation(); // 行クリック(再生)を発火させない
    removeItem(listId, item.id);
  });

  // 並べ替え用のドラッグハンドル
  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.textContent = '⠿';
  handle.title = 'ドラッグで並べ替え(Alt+↑↓キーでも移動可)';
  handle.setAttribute('aria-hidden', 'true');
  handle.addEventListener('pointerdown', (e) => startDrag(e, listId, li));
  // ハンドル上のクリックで再生が始まらないようにする
  handle.addEventListener('click', (e) => e.stopPropagation());

  // 行クリック/Enterキーで再生
  li.addEventListener('click', () => playVideo(listId, item.id, li));
  li.addEventListener('keydown', (e) => {
    if (e.target !== li) return; // 削除ボタン上のキー操作は対象外
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      playVideo(listId, item.id, li);
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      // Alt+↑↓キーで1つ上/下へ移動(キーボードでの並べ替え)
      e.preventDefault();
      moveItem(listId, item.id, e.key === 'ArrowUp' ? -1 : 1);
    }
  });

  li.append(handle, img, info, del);
  return li;
}

// ===== 並べ替え =====

// ドラッグハンドルを押したときに並べ替えを開始する
// (マウス・タッチ共通で動くようPointer Eventsで実装)
function startDrag(e, listId, li) {
  if (e.button !== 0) return; // 左ボタン(タッチ含む)のみ
  e.preventDefault(); // テキスト選択などを防ぐ

  const ul = li.parentElement;
  const pointerId = e.pointerId;
  li.classList.add('dragging');
  // ドラッグ中はプレイヤー(iframe)にポインタを奪われないようにする
  document.body.classList.add('is-dragging');

  // ドラッグ開始時のポインタ位置と行の位置(ポインタに追従させる計算用)
  const startY = e.clientY;
  const startTop = li.offsetTop;

  // ドラッグ中の行をポインタに追従させる
  // (DOM上の位置が変わった分を差し引き、見た目上はポインタの真下に留める)
  const followPointer = (clientY) => {
    const offset = clientY - startY - (li.offsetTop - startTop);
    li.style.transform = `translateY(${offset}px)`;
  };

  // ポインタ位置に合わせて、ドラッグ中の行をDOM上で移動する
  const onMove = (ev) => {
    if (ev.pointerId !== pointerId) return; // 別の指・ポインタは無視
    // ドラッグ中の行以外で、ポインタより下にある最初の行を探す
    // (アニメーション中の見た目の位置ではなく、本来の配置位置で判定してちらつきを防ぐ)
    const ulTop = ul.getBoundingClientRect().top;
    const others = [...ul.children].filter((el) => el !== li);
    const next = others.find((el) => ev.clientY < ulTop + el.offsetTop + el.offsetHeight / 2) ?? null;

    // 位置が変わる場合のみ、他の行を滑らかに動かしながら挿入する
    const needsMove = next ? li.nextElementSibling !== next : ul.lastElementChild !== li;
    if (needsMove) {
      animateReorder(others, () => ul.insertBefore(li, next));
    }
    followPointer(ev.clientY);
  };

  // ドラッグ終了時、DOM上の並び順をデータに反映して保存する
  const onEnd = (ev) => {
    if (ev.pointerId !== pointerId) return;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
    li.classList.remove('dragging');
    document.body.classList.remove('is-dragging');

    // ドラッグしていた行を、ポインタ位置から本来の配置位置へ滑らかに戻す
    const lastTransform = li.style.transform;
    li.style.transform = '';
    if (lastTransform && !prefersReducedMotion()) {
      li.animate([{ transform: lastTransform }, { transform: 'none' }], {
        duration: 150,
        easing: 'ease-out',
      });
    }

    const list = findList(listId);
    if (!list) return;
    const order = [...ul.children].map((el) => el.dataset.id);
    list.items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    savePlaylists();
  };

  // 行をDOM上で移動するとポインタキャプチャが外れるため、window全体でポインタを追跡する
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
}

// OSで「視差効果を減らす」が有効ならアニメーションを省略する
function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// DOMの並び替えを行い、位置が変わった要素を元の位置から新しい位置へ滑らかに動かす
// (FLIP方式: 変更前の位置を記録 → 並び替え → 差分だけずらしてから0へ戻す)
function animateReorder(elements, mutate) {
  // 変更前の見た目上の位置を記録(アニメーション途中の位置も含む)
  const before = new Map(elements.map((el) => [el, el.getBoundingClientRect().top]));

  mutate();

  if (prefersReducedMotion()) return;
  elements.forEach((el) => {
    // 途中のアニメーションを止めて、変更後の本来の位置を測る
    el.getAnimations().forEach((a) => a.cancel());
    const delta = before.get(el) - el.getBoundingClientRect().top;
    if (delta === 0) return;
    // 変更前の位置から本来の位置へ移動させる
    el.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], {
      duration: 200,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
    });
  });
}

// 動画を1つ上(-1)または下(+1)へ移動する(キーボード操作用)
function moveItem(listId, videoId, delta) {
  const list = findList(listId);
  if (!list) return;
  const from = list.items.findIndex((v) => v.id === videoId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.items.length) return;

  // 配列内で入れ替えて保存し、移動後の行にフォーカスを戻す
  [list.items[from], list.items[to]] = [list.items[to], list.items[from]];
  savePlaylists();
  rerenderList(listId)?.querySelector(`.playlist-item[data-id="${videoId}"]`).focus();
}

// ===== 再生 =====

// 指定した動画をプレイヤーに埋め込んで再生する
function playVideo(listId, videoId, li) {
  const item = findList(listId)?.items.find((v) => v.id === videoId);
  if (!item) return;

  playing = { listId, videoId };

  const iframe = document.createElement('iframe');
  iframe.src = `${EMBED_BASE}${videoId}?autoplay=1&rel=0`;
  iframe.title = item.title;
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  // YouTube埋め込みにはリファラ(オリジン)が必要
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';

  playerEl.replaceChildren(iframe);
  nowPlayingEl.textContent = item.title;

  // 再生中の強調表示を付け替える(再描画しないのでフォーカスは保たれる)
  accordionEl.querySelectorAll('.playlist-item.active').forEach((el) => el.classList.remove('active'));
  li.classList.add('active');
}

// プレイヤーを初期状態(未選択)に戻す
function clearPlayer() {
  playing = null;
  const p = document.createElement('p');
  p.className = 'player-placeholder';
  p.textContent = '再生リストから動画を選択してください';
  playerEl.replaceChildren(p);
  nowPlayingEl.textContent = '';
}

// ===== 動画の追加・削除 =====

// URLから動画を指定の再生リストへ追加する
async function addItem(listId, input, messageEl) {
  const list = findList(listId);
  if (!list) return;

  const id = extractVideoId(input);
  if (!id) {
    messageEl.textContent = 'YouTube動画のURLを認識できませんでした';
    return;
  }
  if (list.items.some((v) => v.id === id)) {
    messageEl.textContent = 'この動画は既にこの再生リストにあります';
    return;
  }

  messageEl.textContent = 'タイトルを取得中…';
  const title = (await fetchTitle(id)) ?? `動画 ${id}`;

  // 取得待ちの間にリストが削除されたり、同じ動画が追加されたりしていないか再確認
  if (!findList(listId)) return;
  if (list.items.some((v) => v.id === id)) {
    messageEl.textContent = 'この動画は既にこの再生リストにあります';
    return;
  }

  list.items.push({ id, title, url: watchUrl(id) });
  savePlaylists();
  // このリストだけ描き直し、続けて追加できるようURL入力欄にフォーカスを戻す
  rerenderList(listId)?.querySelector('.url-input').focus();
}

// 指定の再生リストから動画を削除する
function removeItem(listId, videoId) {
  const list = findList(listId);
  if (!list) return;
  list.items = list.items.filter((v) => v.id !== videoId);
  savePlaylists();
  // 再生中の動画を削除した場合はプレイヤーも停止する
  if (playing && playing.listId === listId && playing.videoId === videoId) clearPlayer();
  rerenderList(listId);
}

// ===== 再生リスト自体の管理(開閉・作成・削除) =====

// 再生リストの開閉を切り替える
function toggleList(listId, section) {
  const list = findList(listId);
  if (!list) return;
  list.open = !list.open;
  savePlaylists();
  applyOpenState(section, list.open);
}

// 新しい再生リストを作成し、名前をすぐ編集できる状態にする
function createNewList() {
  const list = createPlaylist(`再生リスト${playlists.length + 1}`);
  playlists.push(list);
  savePlaylists();
  renderAll();
  const nameInput = accordionEl.querySelector(`[data-list-id="${list.id}"] .acc-name`);
  nameInput.focus();
  nameInput.select();
}

// 削除確認の待ち時間(この時間内に2回目を押すと削除する)
const DELETE_CONFIRM_MS = 3000;

// ボタンを「2回押しで実行」にする(ダイアログを出さない誤操作防止)
//   1回目: ボタンを確認状態(赤色・「もう一度押して削除」)にする
//   2回目: 確認状態のうちに押されたら onConfirm を実行する
//   一定時間経過、またはフォーカスが外れたら元の状態に戻す
function setupTwoStepDelete(button, onConfirm) {
  const originalText = button.textContent;
  const originalLabel = button.getAttribute('aria-label');
  let timer = null;

  // 確認状態を解除して元の表示に戻す
  const reset = () => {
    clearTimeout(timer);
    timer = null;
    button.classList.remove('confirming');
    button.textContent = originalText;
    button.setAttribute('aria-label', originalLabel);
  };

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (button.classList.contains('confirming')) {
      // 2回目: 削除を実行
      reset();
      onConfirm();
      return;
    }
    // 1回目: 確認状態にして、一定時間後に自動で元に戻す
    button.classList.add('confirming');
    button.textContent = 'もう一度押して削除';
    button.setAttribute('aria-label', `${originalLabel}(もう一度押すと削除されます)`);
    timer = setTimeout(reset, DELETE_CONFIRM_MS);
  });

  // 他の場所を操作したら確認状態を解除する
  button.addEventListener('blur', reset);
}

// 再生リストを削除する(2回押しで確認済みの前提)
function deleteList(listId) {
  const list = findList(listId);
  if (!list) return;
  playlists = playlists.filter((p) => p.id !== listId);
  savePlaylists();
  // 再生中の動画が含まれるリストを削除した場合はプレイヤーも停止する
  if (playing && playing.listId === listId) clearPlayer();
  renderAll();
}

// ===== YamaPlayer形式JSONのエクスポート・インポート =====

// 日付をファイル名用の文字列(YYYYMMDD-HHMMSS)にする
function formatFileDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// 全ての再生リストをYamaPlayer形式のJSONファイルとしてダウンロードする
// (ブラウザ内でファイルを生成して保存するだけで、外部へは送信しない)
function exportJson() {
  if (playlists.length === 0) {
    statusEl.textContent = 'エクスポートする再生リストがありません';
    return;
  }
  const json = toYamaPlayerJson(playlists);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // 一時的なリンクを作ってクリックし、ダウンロードさせる
  const a = document.createElement('a');
  a.href = url;
  a.download = `yamaplayer-playlists-${formatFileDate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // ダウンロード開始前に解放されないよう、少し待ってからURLを解放する
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  statusEl.textContent = `${playlists.length} 件の再生リストをエクスポートしました`;
}

// 選択されたYamaPlayer形式のJSONファイルを読み込み、再生リストとして追加する
// (既存の再生リストは残したまま、末尾に追加する)
async function importJson(file) {
  let result;
  try {
    result = parseYamaPlayerJson(await file.text(), extractVideoId, watchUrl);
  } catch (err) {
    statusEl.textContent = `読み込みに失敗しました: ${err.message}`;
    return;
  }
  if (result.playlists.length === 0) {
    statusEl.textContent = 'ファイルに再生リストが含まれていません';
    return;
  }

  // 取り込んだリストを本ツールの形式に整えて追加する(閉じた状態で追加)
  result.playlists.forEach((p, i) => {
    const list = createPlaylist(p.name || `インポート${i + 1}`, p.items, false);
    list.active = p.active;
    list.youtubeListId = p.youtubeListId;
    playlists.push(list);
  });
  savePlaylists();
  renderAll();

  const itemCount = result.playlists.reduce((sum, p) => sum + p.items.length, 0);
  let text = `${result.playlists.length} 件の再生リスト(動画 ${itemCount} 件)をインポートしました`;
  if (result.skipped > 0) {
    text += `。YouTube以外または重複の ${result.skipped} 件は取り込んでいません`;
  }
  statusEl.textContent = text;
}

// ===== イベント登録 =====
newListBtn.addEventListener('click', createNewList);

// エクスポートボタン
exportBtn.addEventListener('click', exportJson);

// インポートボタン: 非表示のファイル選択欄を開く
importBtn.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', async () => {
  const file = importFileInput.files[0];
  if (file) await importJson(file);
  // 同じファイルを続けて選んでも反応するよう選択をリセットする
  importFileInput.value = '';
});

// ===== 初期表示 =====
// 旧データの移行や初期リスト作成の結果をすぐ保存しておく
savePlaylists();
renderAll();
