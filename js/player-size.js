'use strict';

// ===== 埋め込み動画の拡大表示ON/OFF切り替え =====
// ON  = 'large' : パネルごと画面幅まで広げ、画面に収まる範囲で最大表示
// OFF = 'medium': パネル幅いっぱいに表示
(() => {
  // 選択したサイズを保存するlocalStorageのキー
  const SIZE_KEY = 'yutplaylist.playerSize';
  // 選択できるサイズと既定のサイズ
  // (以前保存された 'small' などの廃止値は既定サイズとして扱う)
  const SIZES = ['medium', 'large'];
  const DEFAULT_SIZE = 'large';

  const playerArea = document.getElementById('player-area');
  const toggle = document.getElementById('size-toggle');

  // 保存済みのサイズを読み込む(未保存・不正値なら既定サイズ)
  function loadSize() {
    try {
      const value = localStorage.getItem(SIZE_KEY);
      return SIZES.includes(value) ? value : DEFAULT_SIZE;
    } catch {
      return DEFAULT_SIZE;
    }
  }

  // 選択したサイズを保存する
  function saveSize(size) {
    try {
      localStorage.setItem(SIZE_KEY, size);
    } catch {
      // 保存できない環境(プライベートモード等)では何もしない
    }
  }

  // サイズを画面に反映する(CSSは data-size 属性で幅を切り替える)
  function applySize(size) {
    playerArea.dataset.size = size;
    // 拡大時はパネル自体を画面幅まで広げるため、body側にもサイズを設定する
    document.body.dataset.playerSize = size;

    // ボタンのON/OFF状態と説明文を更新する(アイコンはCSSで切り替え)
    const isLarge = size === 'large';
    toggle.setAttribute('aria-pressed', String(isLarge));
    const label = isLarge ? '拡大表示を解除' : '拡大表示';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  }

  // ボタンクリックで拡大表示のON/OFFを切り替えて保存する
  toggle.addEventListener('click', () => {
    const next = playerArea.dataset.size === 'large' ? 'medium' : 'large';
    applySize(next);
    saveSize(next);
  });

  // 初期表示: 保存済みのサイズを反映する
  applySize(loadSize());
})();
