import { State } from './state.js';
import { Constants } from './constants.js';
import { Utils } from './utils.js';
import { Nav } from './nav.js';

export const API = {
  /**
   * 呼叫 PHP 後端的單一進入點。
   * 請求格式與原 Vercel 版本相同：POST { action, payload }
   */
  request: async (action, payload = {}) => {
    let res;
    try {
      res = await fetch(Constants.API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action, payload })
      });
    } catch (networkErr) {
      API.showConnectionWarning();
      throw new Error('無法連線至伺服器，請檢查網路或稍後再試');
    }

    let result;
    try {
      result = await res.json();
    } catch (parseErr) {
      throw new Error(`伺服器回應格式錯誤 (HTTP ${res.status})`);
    }

    if (!result.success) {
      if (res.status === 401) {
        // Session 逾期：清掉本地登入狀態，讓使用者重新登入
        State.systemUser = null;
        localStorage.removeItem('booking_user');
      }
      throw new Error(result.error || '伺服器回傳失敗');
    }

    API.hideConnectionWarning();
    return result;
  },

  showConnectionWarning: () => {
    const el = document.getElementById('apiWarning');
    if (!el) return;
    el.innerHTML = `
      <h4 class="font-bold text-red-700 mb-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i> 無法連線至伺服器</h4>
      <p class="text-sm text-red-600">系統目前無法連線至後端 API，畫面顯示的是最後一次成功載入的快取資料，暫時無法新增或修改。</p>`;
    el.classList.remove('hidden-view');
  },

  hideConnectionWarning: () => {
    const el = document.getElementById('apiWarning');
    if (el) el.classList.add('hidden-view');
  },

  /** 初始化資料：先用本機快取秒開畫面，再向後端要最新資料 */
  loadInitialData: async () => {
    const cache = localStorage.getItem(Constants.CACHE_KEY);
    if (cache) {
      try {
        State.db = { ...State.db, ...JSON.parse(cache) };
        Nav.renderActiveScreen();
      } catch (e) {
        localStorage.removeItem(Constants.CACHE_KEY);
      }
    }

    try {
      const result = await API.request('getData');
      State.db = { ...State.db, ...result.data };
      State.systemUser = result.user || null;
      API.saveCache();
      Nav.renderActiveScreen();
    } catch (error) {
      console.error('資料同步失敗:', error);
    }
  },

  /** 只快取公開資料，帳號與授權碼不寫入 localStorage */
  saveCache: () => {
    try {
      const { users, authCodes, ...publicData } = State.db;
      localStorage.setItem(Constants.CACHE_KEY, JSON.stringify(publicData));
    } catch (e) {
      /* 容量不足時忽略 */
    }
  },

  updateLocalData: (table, data) => {
    if (!State.db[table]) State.db[table] = [];
    const arr = Array.isArray(data) ? data : [data];
    arr.forEach(newItem => {
      const idx = State.db[table].findIndex(item => item.id === newItem.id);
      if (idx > -1) State.db[table][idx] = { ...State.db[table][idx], ...newItem };
      else State.db[table].push(newItem);
    });
    API.saveCache();
  },

  deleteLocalData: (table, idOrIds) => {
    if (!State.db[table]) return;
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    State.db[table] = State.db[table].filter(item => !ids.includes(item.id));
    API.saveCache();
  },

  deleteData: (collectionName, id) => {
    if (collectionName === 'users' && State.systemUser && State.systemUser.role !== 'superadmin') {
      const targetUser = State.db.users.find(u => u.id === id);
      if (targetUser && targetUser.role === 'superadmin') {
        return Utils.showToast('一般管理員無法刪除超級管理員', true);
      }
    }
    Utils.customConfirm('確定要刪除此筆資料嗎？此操作無法復原！', async () => {
      Utils.showLoading(true, '刪除資料中...');
      try {
        await API.request('deleteRow', { table: collectionName, id });
        API.deleteLocalData(collectionName, id);
        Utils.showToast(collectionName === 'bookings' ? '已成功刪除預約' : '資料已刪除');
        Nav.renderActiveScreen();
      } catch (err) {
        Utils.showToast('刪除失敗: ' + err.message, true);
      } finally {
        Utils.showLoading(false);
      }
    });
  }
};
