'use strict';

// ===== ライト/ダークテーマの切り替え =====
(() => {
  // 選択したテーマを保存するlocalStorageのキー
  const THEME_KEY = 'yutplaylist.theme';
  const root = document.documentElement;
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // 保存済みのテーマを読み込む('light' / 'dark'、未保存ならnull)
  function loadTheme() {
    try {
      const value = localStorage.getItem(THEME_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  }

  // 選択したテーマを保存する
  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // 保存できない環境(プライベートモード等)では何もしない
    }
  }

  // 現在実際に表示されているテーマを返す(明示選択がなければOS設定に従う)
  function currentTheme() {
    return root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
  }

  // ボタンの表示を現在のテーマに合わせて更新する
  function updateButton() {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const isDark = currentTheme() === 'dark';
    // 押したときに切り替わる先のテーマを表示する
    button.textContent = isDark ? '☀ ライト' : '🌙 ダーク';
    button.setAttribute('aria-label', isDark ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え');
  }

  // 画面描画前に保存済みテーマを適用する(ちらつき防止)
  const saved = loadTheme();
  if (saved) root.dataset.theme = saved;

  // DOM構築後にボタンの表示とクリック処理を設定する
  document.addEventListener('DOMContentLoaded', () => {
    updateButton();
    document.getElementById('theme-toggle').addEventListener('click', () => {
      // 現在と逆のテーマに切り替えて保存する
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      saveTheme(next);
      updateButton();
    });
  });

  // 明示選択がない状態でOS設定が変わったら、ボタン表示を追従させる
  darkQuery.addEventListener('change', updateButton);
})();
