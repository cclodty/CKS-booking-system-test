import { Utils } from './utils.js';
import { API } from './api.js';
import { State } from './state.js';
import { Nav } from './nav.js';

export const Auth = {
  showLoginView: () => {
    document.getElementById('loginView').classList.remove('hidden-view');
    document.body.style.overflow = 'hidden';
    const input = document.getElementById('authUsername');
    if (input) input.focus();
  },
  hideLoginView: () => {
    document.getElementById('loginView').classList.add('hidden-view');
    document.body.style.overflow = '';
    document.getElementById('loginError').classList.add('hidden-view');
    document.getElementById('authPassword').value = '';
  },
  handleAuth: async (e) => {
    e.preventDefault();
    const btn = document.getElementById('authSubmitBtn');
    const errorBox = document.getElementById('loginError');
    const userStr = document.getElementById('authUsername').value.trim();
    const passStr = document.getElementById('authPassword').value;

    errorBox.classList.add('hidden-view');
    if (!userStr || !passStr) {
      errorBox.textContent = '請輸入帳號密碼';
      errorBox.classList.remove('hidden-view');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 驗證中...';

    try {
      // 密碼先在瀏覽器做 SHA-256，伺服器再以 bcrypt 保存與比對
      const hashedPw = await Utils.hashPassword(passStr);
      const res = await API.request('login', { username: userStr, password: hashedPw });

      if (res.adminData) {
        State.db.users = res.adminData.users || [];
        State.db.authCodes = res.adminData.authCodes || [];
      }

      Auth.onLoginSuccess(res.user);
      Auth.hideLoginView();
    } catch (err) {
      console.error('登入程序出錯:', err);
      errorBox.textContent = err.message || '登入失敗，請確認網路連線';
      errorBox.classList.remove('hidden-view');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '確認登入';
    }
  },

  onLoginSuccess: (userData) => {
    Auth.applyUser(userData, true);
    Utils.showToast(`歡迎回來，${userData.name || userData.username}`);
  },

  /** 依身分切換介面元素；switchToAdmin 為 true 時同時跳到後台頁 */
  applyUser: (userData, switchToAdmin) => {
    State.systemUser = userData;
    localStorage.setItem('booking_user', JSON.stringify({ id: userData.id, username: userData.username }));

    document.getElementById('guestUserGroup').classList.add('hidden-view');
    document.getElementById('loggedUserGroup').classList.remove('hidden-view');
    const nameEl = document.getElementById('loggedUserName');
    if (nameEl) nameEl.textContent = userData.name || userData.username;

    const adminBtn = document.getElementById('navAdminBtn');
    const mobAdminBtn = document.getElementById('mobileNavAdminBtn');
    if (adminBtn) adminBtn.classList.remove('hidden-view');
    if (mobAdminBtn) mobAdminBtn.classList.remove('hidden-view');

    const isSuper = userData.role === 'superadmin';
    document.getElementById('superAdminMenu').classList.toggle('hidden-view', !isSuper);

    let showAuthCodes = isSuper;
    if (!isSuper) {
      const mRooms = userData.managedRooms || [];
      const managedRoomsData = (State.db.rooms || []).filter(r => mRooms.includes(r.id));
      showAuthCodes = managedRoomsData.some(r => r.requiresAuthCode === true || r.requiresAuthCode === 'true');
    }
    document.getElementById('adminMenuAuthCodesBtn').classList.toggle('hidden-view', !showAuthCodes);

    const canSeeRooms = isSuper || (userData.managedRooms || []).length > 0;
    document.getElementById('adminMenuRoomsBtn').classList.toggle('hidden-view', !canSeeRooms);

    if (switchToAdmin) Nav.switchTab('admin');
  },

  logout: async () => {
    try {
      await API.request('logout');
    } catch (e) {
      /* 即使伺服器端已逾期，仍要清掉前端狀態 */
    }
    State.systemUser = null;
    State.db.users = [];
    State.db.authCodes = [];
    localStorage.removeItem('booking_user');
    document.getElementById('guestUserGroup').classList.remove('hidden-view');
    document.getElementById('loggedUserGroup').classList.add('hidden-view');
    document.getElementById('navAdminBtn').classList.add('hidden-view');
    document.getElementById('mobileNavAdminBtn').classList.add('hidden-view');
    Nav.switchTab('booking');
    Utils.showToast('已登出管理員身分');
  }
};
