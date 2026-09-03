import { State } from './state.js';
import { Utils } from './utils.js';
import { API } from './api.js';
import { Nav } from './nav.js';
import { Auth } from './auth.js'; 
import { Print } from './print.js'; 

// ==========================================
//管理員後台邏輯
// ==========================================
export const Admin = {
      renderActiveTab: () => {
        const tab = State.adminTab;
        if (tab === 'bookings') Admin.renderBookings();
        else if (tab === 'users') Admin.renderUsers();
        else if (tab === 'rooms') Admin.renderRooms();
        else if (tab === 'classes') Admin.renderClasses();
        else if (tab === 'timeslots') Admin.renderTimeSlots();
        else if (tab === 'holidays') Admin.renderHolidays();
        else if (tab === 'permissions') Admin.renderPermissions();
        else if (tab === 'settings') Admin.renderSettings();
        else if (tab === 'authcodes') Admin.renderAuthCodes();
        else if (tab === 'print') Admin.renderPrintTab();
      },
      switchTab: (tabId) => {
        State.adminTab = tabId;
        document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden-view'));
        const activeEl = document.getElementById(`admin-${tabId}`);
        if(activeEl) activeEl.classList.remove('hidden-view');
        
        document.querySelectorAll('.admin-nav-btn').forEach(btn => {
          if(btn.dataset.target === tabId) { btn.classList.add('bg-blue-600','text-white','shadow-sm'); btn.classList.remove('bg-white','hover:bg-gray-50','border','border-gray-100'); }
          else { btn.classList.remove('bg-blue-600','text-white','shadow-sm'); btn.classList.add('bg-white','hover:bg-gray-50','border','border-gray-100'); }
        });
        Admin.renderActiveTab();
      },
      renderRoomNoticeSlotsForm: (customNotices = {}, closedSlots = []) => {
          const container = document.getElementById('rNoticeSlotsContainer');
          if (!container) return;
          const allTs = Utils.getSortedTimeSlots();
          if(allTs.length === 0) {
            container.innerHTML = '<div class="col-span-full text-xs text-gray-400 p-2 text-center bg-white rounded border border-gray-200">尚無設定任何時間段，請先前往「時間段設定」新增。</div>';
            return;
          }
          container.innerHTML = allTs.map(ts => {
            const val = customNotices[ts.id] || '';
            const isOpen = !closedSlots.includes(ts.id);
            return `
              <div class="flex flex-col gap-2 text-sm bg-white border ${isOpen ? 'border-gray-200' : 'border-red-200 bg-red-50/30'} p-3 rounded-lg shadow-sm transition-colors">
                <div class="flex justify-between items-start gap-2 border-b border-gray-100 pb-2">
                  <span class="font-bold ${isOpen ? 'text-gray-800' : 'text-red-700'} leading-tight">${Utils.esc(ts.name)}</span>
                  <label class="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <input type="checkbox" id="isOpen_${ts.id}" class="room-slot-open-cb w-4 h-4 text-blue-600 rounded" value="${ts.id}" ${isOpen ? 'checked' : ''} onchange="App.Admin.toggleSlotOpenStatus(this, '${Utils.escAttr(ts.id)}')">
                    <span class="text-xs font-medium ${isOpen ? 'text-gray-600' : 'text-red-600'}">開放預約</span>
                  </label>
                </div>
                <div>
                  <input type="text" id="notice_${ts.id}" class="room-notice-input w-full p-2 border ${isOpen ? 'border-gray-300' : 'border-red-200'} rounded outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-white" placeholder="輸入不開放原因或專屬提示" value="${Utils.esc(val)}">
                </div>
              </div>
            `;
          }).join('');
      },
      toggleSlotOpenStatus: (cb, tsId) => {
          const card = cb.closest('div.flex-col.gap-2.text-sm');
          const span = cb.nextElementSibling;
          const nameSpan = card.querySelector('span.font-bold');
          const input = document.getElementById(`notice_${tsId}`);
          if (cb.checked) {
              card.className = 'flex flex-col gap-2 text-sm bg-white border border-gray-200 p-3 rounded-lg shadow-sm transition-colors';
              span.className = 'text-xs font-medium text-gray-600';
              nameSpan.className = 'font-bold text-gray-800 leading-tight';
              input.className = 'room-notice-input w-full p-2 border border-gray-300 rounded outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-white';
          } else {
              card.className = 'flex flex-col gap-2 text-sm bg-red-50/30 border border-red-200 p-3 rounded-lg shadow-sm transition-colors';
              span.className = 'text-xs font-medium text-red-600';
              nameSpan.className = 'font-bold text-red-700 leading-tight';
              input.className = 'room-notice-input w-full p-2 border border-red-200 rounded outline-none focus:ring-2 focus:ring-blue-500 text-xs bg-white';
          }
      },
      renderBookings: () => {
        const data = State.db;
        if (!data) return;
        const isSuper = State.systemUser.role === 'superadmin';
        const mRooms = State.systemUser.managedRooms || [];
        let mBookings = isSuper ? data.bookings : data.bookings.filter(b => mRooms.includes(b.roomId));
        
        const todayStr = new Date().toISOString().split('T')[0];
        const searchKeyword = document.getElementById('adminBookingSearch').value.trim().toLowerCase();
        
        mBookings = mBookings.filter(b => b.date >= todayStr);
        if (searchKeyword) {
            mBookings = mBookings.filter(b => String(b.userName || '').toLowerCase().includes(searchKeyword));
            document.getElementById('btnBatchDelete').classList.remove('hidden-view');
        } else {
            document.getElementById('btnBatchDelete').classList.add('hidden-view');
        }

        mBookings.sort((a,b)=> {
            const dateDiff = new Date(b.date) - new Date(a.date);
            if (dateDiff !== 0) return dateDiff;
            return String(a.timeSlot).localeCompare(String(b.timeSlot));
        });
        
        document.getElementById('adminBookingsTitle').textContent = `預約管理 (共 ${mBookings.length} 筆未來記錄)`;
        const bTbody = document.getElementById('adminBookingsTbody');

        if(mBookings.length === 0) {
          bTbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-400 bg-gray-50">尚無未來預約記錄</td></tr>';
          document.getElementById('adminBookingPageInfo').textContent = '0 / 0';
          document.getElementById('btnPrevPage').disabled = true;
          document.getElementById('btnNextPage').disabled = true;
          return;
        } 

        const perPage = State.adminBookingPerPage === 'all' ? mBookings.length : parseInt(State.adminBookingPerPage);
        const totalPages = Math.max(1, Math.ceil(mBookings.length / perPage));

        if (State.adminBookingPage > totalPages) State.adminBookingPage = totalPages;
        if (State.adminBookingPage < 1) State.adminBookingPage = 1;

        const startIndex = (State.adminBookingPage - 1) * perPage;
        const pageBookings = State.adminBookingPerPage === 'all' ? mBookings : mBookings.slice(startIndex, startIndex + perPage);

        bTbody.innerHTML = pageBookings.map(b => {
          const room = data.rooms.find(r => r.id === b.roomId);
          const rName = room ? `<span class="font-bold">${Utils.esc(room.name)}</span> ${room.roomNumber ? `<span class="text-xs text-gray-500">(${Utils.esc(room.roomNumber)})</span>`:''}` : '<span class="text-gray-400">已刪除</span>';
          
          const isStudent = b.isStudent === true || b.isStudent === 'true';
          const displayUser = Utils.esc(b.userName || '訪客');
          const displayClass = isStudent && b.className ? `<span class="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded mr-1">${Utils.esc(b.className)}</span>` : '';
          const displayParti = b.participants ? `<span class="text-[10px] text-gray-500 ml-1">(${Number(b.participants)}人)</span>` : '';
          
          const isLocked = b.isLocked === true || b.isLocked === 'true';

          // 修改部分：如果目前有輸入姓名過濾 (searchKeyword)，則顯示 Checkbox
          //const checkboxHTML = searchKeyword ? `<input type="checkbox" class="bulk-cb w-4 h-4 mr-2 cursor-pointer align-middle" data-id="${b.id}" data-ts="${b.timeSlot}" data-name="${b.userName || ''}" onchange="App.Admin.onBookingCheckboxChange(this)">` : '';
          const checkboxHTML = searchKeyword ? `<input type="checkbox" class="bulk-cb w-4 h-4 mr-2 cursor-pointer align-middle" data-id="${Utils.esc(b.id)}" data-ts="${Utils.esc(b.timeSlot)}" data-room="${Utils.esc(b.roomId)}" onchange="App.Admin.onBookingCheckboxChange(this)">` : '';
              
          return `<tr class="hover:bg-blue-50/30 border-b border-gray-100 last:border-0 transition-colors">
            <td class="p-4 font-mono text-sm">${checkboxHTML}${Utils.esc(b.date)}</td>
            <td class="p-4 text-blue-700 font-bold bg-blue-50/20">${Utils.esc(b.timeSlot)}</td>
            <td class="p-4">${rName}</td>
            <td class="p-4 font-medium flex items-center">${displayClass}${displayUser}${displayParti}</td>
            <td class="p-4 text-sm max-w-[200px] truncate" title="${Utils.esc(b.purpose)}">${Utils.esc(b.purpose)}</td>
            <td class="p-4 text-right whitespace-nowrap">
              <button onclick="App.Admin.startEditBooking('${Utils.escAttr(b.id)}')" class="text-blue-500 hover:text-white hover:bg-blue-500 px-3 py-1.5 rounded-lg border border-blue-200 hover:border-blue-500 transition-all text-sm shadow-sm mr-1" title="編輯預約">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button onclick="App.Admin.toggleLockBooking('${Utils.escAttr(b.id)}')" class="${isLocked ? 'text-yellow-600 bg-yellow-50 border-yellow-200' : 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 border-transparent hover:border-yellow-200'} px-3 py-1.5 rounded-lg border transition-all text-sm shadow-sm mr-1" title="${isLocked ? '解鎖預約' : '鎖定預約'}">
                <i class="fa-solid fa-${isLocked ? 'lock' : 'unlock'}"></i>
              </button>
              <button onclick="App.API.deleteData('bookings','${Utils.escAttr(b.id)}')" class="text-red-500 hover:text-white hover:bg-red-500 px-3 py-1.5 rounded-lg border border-red-200 hover:border-red-500 transition-all text-sm shadow-sm"><i class="fa-solid fa-trash-can mr-1"></i>刪除</button>
            </td></tr>`;
        }).join('');

        document.getElementById('adminBookingPageInfo').textContent = `第 ${State.adminBookingPage} 頁 / 共 ${totalPages} 頁`;
        document.getElementById('btnPrevPage').disabled = State.adminBookingPage <= 1;
        document.getElementById('btnNextPage').disabled = State.adminBookingPage >= totalPages;
      },
      startEditBooking: (id) => {
        const b = State.db.bookings.find(x => x.id === id);
        if (!b) return;
        
        document.getElementById('editBkId').value = b.id;
        document.getElementById('editBkDate').value = b.date;
        
        const tsSelect = document.getElementById('editBkTimeSlot');
        const datalist = document.getElementById('timeSlotOptions');
        if (datalist) {
           datalist.innerHTML = Utils.getSortedTimeSlots().map(ts => `<option value="${Utils.esc(ts.name)}">`).join('');
        }
        document.getElementById('editBkTimeSlot').value = b.timeSlot;

        document.getElementById('editBkUserName').value = b.userName || '';
        document.getElementById('editBkIsStudent').checked = (b.isStudent === true || b.isStudent === 'true');
        
        const sel = document.getElementById('editBkClassName');
        const classes = Utils.getSortedClasses();
        sel.innerHTML = classes.length === 0 ? '<option value="">(無可用班級)</option>' : classes.map(c => `<option value="${Utils.esc(c.name)}">${Utils.esc(c.name)}</option>`).join('');
        sel.value = b.className || '';
        
        document.getElementById('editBkParticipants').value = b.participants || 0;
        document.getElementById('editBkPurpose').value = b.purpose || '';
        
        Admin.toggleEditStudentFields();
        document.getElementById('adminBookingEditModal').classList.remove('hidden-view');
      },
      closeEditBookingModal: () => {
        document.getElementById('adminBookingEditModal').classList.add('hidden-view');
      },
      toggleEditStudentFields: () => {
        const isStudent = document.getElementById('editBkIsStudent').checked;
        const classSection = document.getElementById('editBkClassSection');
        if (isStudent) classSection.classList.remove('hidden-view');
        else classSection.classList.add('hidden-view');
      },
      saveEditBooking: async () => {
        const id = document.getElementById('editBkId').value;
        const b = State.db.bookings.find(x => x.id === id);
        if (!b) return;
        
        const newDate = document.getElementById('editBkDate').value;
        const newTimeSlot = document.getElementById('editBkTimeSlot').value.trim();
        const userName = document.getElementById('editBkUserName').value.trim();
        const isStudent = document.getElementById('editBkIsStudent').checked;
        const className = isStudent ? document.getElementById('editBkClassName').value : '';
        const participants = parseInt(document.getElementById('editBkParticipants').value) || 0;
        const purpose = document.getElementById('editBkPurpose').value.trim();
        
        if(!newDate || !newTimeSlot) return Utils.showToast("日期與時間段為必填", true);
        if(isStudent && !className) return Utils.showToast("請選擇班級", true);
        if(!userName) return Utils.showToast("請填寫預約人姓名", true);
        if(participants <= 0) return Utils.showToast("請填寫有效的預約人數", true);
        if(!purpose) return Utils.showToast("請填寫預約用途", true);
        
        const room = State.db.rooms.find(r => r.id === b.roomId);
        if(room && room.capacity && room.capacity > 0 && participants > room.capacity) {
           return Utils.showToast(`人數超過課室上限 (${room.capacity}人)`, true);
        }

        if (Utils.isSlotClosed(newTimeSlot, room, State.db.timeSlots)) {
             return Utils.showToast("該時段不開放預約！", true);
        }
        const exact = State.db.bookings.find(x => x.id !== b.id && x.roomId === b.roomId && x.date === newDate && Utils.isTimeOverlap(newTimeSlot, x.timeSlot));
        if (exact) return Utils.showToast("該日期與時段已與其他預約衝突！", true);

        const updatedBooking = { ...b, userName, isStudent, className, participants, purpose, date: newDate, timeSlot: newTimeSlot };
        
        Utils.showLoading(true, "儲存修改中...");
        try {
            await API.request('saveRow', { table: 'bookings', data: updatedBooking });
            API.updateLocalData('bookings', updatedBooking);
            Utils.showToast("預約記錄已更新！");
            Admin.closeEditBookingModal();
            Admin.renderBookings();
        } catch (e) {
            Utils.showToast("儲存失敗: " + e.message, true);
        } finally {
            Utils.showLoading(false);
        }
      },
      changeBookingPage: (dir) => {
        State.adminBookingPage += dir;
        Admin.renderBookings();
      },
      changeBookingPerPage: (val) => {
        State.adminBookingPerPage = val;
        State.adminBookingPage = 1;
        Admin.renderBookings();
      },
      toggleLockBooking: async (id) => {
        const b = State.db.bookings.find(x => x.id === id);
        if (!b) return;
        if (State.systemUser.role !== 'superadmin' && !(State.systemUser.managedRooms || []).includes(b.roomId)) {
            return Utils.showToast("無權限修改此預約", true);
        }
        Utils.showLoading(true, "修改狀態中...");
        try {
          b.isLocked = !(b.isLocked === true || b.isLocked === 'true');
          await API.request('saveRow', { table: 'bookings', data: b });
          API.updateLocalData('bookings', b);
          Utils.showToast(b.isLocked ? "預約已鎖定" : "預約已解鎖");
          Admin.renderBookings();
        } catch (e) {
          Utils.showToast("操作失敗: " + e.message, true);
        } finally {
          Utils.showLoading(false);
        }
      },
      // 勾選 checkbox 時，自動連動：相同時段 + 相同課室
      onBookingCheckboxChange: (el) => {
        const isChecked = el.checked;
        const ts = el.dataset.ts;
        const roomId = el.dataset.room;
        
        document.querySelectorAll('.bulk-cb').forEach(cb => {
            if (cb.dataset.ts === ts && cb.dataset.room === roomId) {
                cb.checked = isChecked;
            }
        });
      },
      batchDeleteBookings: () => {
         const keyword = document.getElementById('adminBookingSearch').value.trim().toLowerCase();
         if (!keyword) return Utils.showToast("請先輸入預約人姓名進行過濾，再執行批量刪除！", true);
         
         // 新增：取得畫面中已被勾選的預約 ID
         const checkedBoxes = document.querySelectorAll('.bulk-cb:checked');
         if (checkedBoxes.length === 0) return Utils.showToast("請先在列表中勾選要刪除的預約記錄！", true);
         const idsToDelete = Array.from(checkedBoxes).map(cb => cb.dataset.id);
         
         const isSuper = State.systemUser.role === 'superadmin';
         const mRooms = State.systemUser.managedRooms || [];
         let mBookings = isSuper ? State.db.bookings : State.db.bookings.filter(b => mRooms.includes(b.roomId));
         
         // 新增：只篩選出「有被勾選」的預約資料
         const bookingsToDelete = mBookings.filter(b => idsToDelete.includes(b.id));
         
         if (bookingsToDelete.length === 0) return Utils.showToast("沒有找到可刪除的預約記錄", true);
         
         const lockedCount = bookingsToDelete.filter(b => b.isLocked === true || b.isLocked === 'true').length;
         const finalDeletes = bookingsToDelete.filter(b => !(b.isLocked === true || b.isLocked === 'true'));

         let msg = `即將批量刪除勾選的 ${bookingsToDelete.length} 筆預約。`;
         if (lockedCount > 0) msg += `\n(其中包含 ${lockedCount} 筆已鎖定的預約，將被自動略過)`;
         if (finalDeletes.length === 0) return Utils.showToast("勾選的預約皆已鎖定，無法刪除。", true);
         
         msg += `\n\n確定要刪除這 ${finalDeletes.length} 筆資料嗎？此操作無法復原！`;

         Utils.customConfirm(msg, async () => {
             Utils.showLoading(true, "批量刪除中...");
             try {
               const finalIds = finalDeletes.map(b => b.id);
               await API.request('deleteRow', { table: 'bookings', id: finalIds }); 
               API.deleteLocalData('bookings', finalIds);
               Utils.showToast(`成功批量刪除 ${finalIds.length} 筆預約！`);
               Nav.renderActiveScreen();
             } catch (err) {
               Utils.showToast("批量刪除失敗: " + err.message, true);
             } finally {
               Utils.showLoading(false);
             }
         });
      },
      renderUsers: () => {
        const usersTbody = document.getElementById('adminUsersTbody');
        const isSuper = State.systemUser.role === 'superadmin';
        if(State.db.users.length === 0) {
          usersTbody.innerHTML = '<tr><td colspan="3" class="p-8 text-center text-gray-500">尚無帳戶</td></tr>';
        } else {
          usersTbody.innerHTML = State.db.users.map(u => {
            const roleBadge = u.role === 'superadmin' ? '<span class="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold">超級管理員</span>' : '<span class="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">一般管理員</span>';
            const isMe = State.systemUser.id === u.id;
            const displayUsername = (!isSuper && u.role === 'superadmin') ? Utils.maskUsername(u.username) : u.username;
            const canEdit = isSuper || isMe;
            let actions = '';
            if (canEdit) {
               actions = `<button onclick="App.Admin.startEditUser('${Utils.escAttr(u.id)}')" class="text-blue-500 hover:text-white hover:bg-blue-500 px-3 py-1.5 rounded-lg border border-blue-200 transition-all text-sm mr-1"><i class="fa-solid fa-pen-to-square mr-1"></i>編輯</button>`;
               if (isSuper) {
                 actions += `<button onclick="App.API.deleteData('users','${Utils.escAttr(u.id)}')" class="text-red-500 hover:text-white hover:bg-red-500 px-3 py-1.5 rounded-lg border border-red-200 transition-all text-sm"><i class="fa-solid fa-trash-can mr-1"></i>刪除</button>`;
               }
            } else {
               actions = `<span class="text-gray-400 text-xs bg-gray-100 px-2 py-1 rounded border">無權限修改</span>`;
            }
            return `<tr class="border-b last:border-0 hover:bg-gray-50"><td class="p-4 font-bold">${Utils.esc(displayUsername)} ${isMe ? '<span class="text-[10px] text-blue-600 ml-2">(您)</span>':''}</td><td class="p-4">${roleBadge}</td><td class="p-4 text-right">${actions}</td></tr>`;
          }).join('');
        }
        const roleSelect = document.getElementById('newRole');
        if (roleSelect) roleSelect.disabled = !isSuper;
      },
      saveUser: async () => {
        const idField = document.getElementById('editUserId').value;
        const pass = document.getElementById('newPassword').value;
        const isSuper = State.systemUser.role === 'superadmin';
        let username = document.getElementById('newUsername').value.trim();
        let role = document.getElementById('newRole').value;

        if(isSuper && !username) return Utils.showToast("帳號為必填", true);
        if(!idField && !pass) return Utils.showToast("新增帳號時密碼為必填", true);
        if(!idField && State.db.users.find(u => u.username === username)) return Utils.showToast("此帳號名稱已被使用", true);

        if(!isSuper) {
           if (!idField || idField !== State.systemUser.id) return Utils.showToast("一般管理員僅能修改自己的帳號", true);
           const existingU = State.db.users.find(u => u.id === idField);
           username = existingU.username; role = existingU.role;
        }

        Utils.showLoading(true, "儲存帳號中...");
        try {
          const uid = idField || `u_${Date.now()}`;
          // 留空代表沿用原密碼；後端收到空字串就不會覆寫 password_hash
          const hashedPw = pass ? await Utils.hashPassword(pass) : '';

          const existingU = idField ? State.db.users.find(u => u.id === idField) : null;
          const payload = { id: uid, username, password: hashedPw, role, managedRooms: existingU ? (existingU.managedRooms || []) : [] };

          const res = await API.request('saveRow', { table: 'users', data: payload });
          API.updateLocalData('users', (res.data && res.data[0]) || { ...payload, password: undefined });
          Utils.showToast(idField ? "帳戶更新成功" : "帳戶新增成功");
          Admin.resetUserForm();
        } catch(e) { 
          Utils.showToast("儲存失敗: " + e.message, true); 
        } finally {
          Utils.showLoading(false);
        }
      },
      startEditUser: (id) => {
        const u = State.db.users.find(x=>x.id===id);
        const isSuper = State.systemUser.role === 'superadmin';
        if (!isSuper && u.role === 'superadmin') return Utils.showToast("一般管理員無法編輯超級管理員", true);
        if (!isSuper && u.id !== State.systemUser.id) return Utils.showToast("一般管理員只能修改自己的密碼", true);
        
        document.getElementById('editUserId').value = id;
        document.getElementById('newUsername').value = u.username;
        document.getElementById('newUsername').disabled = !isSuper;
        document.getElementById('newPassword').value = '';
        document.getElementById('newPassword').placeholder = '設定新密碼 (不修改請留空)';
        document.getElementById('passwordAsterisk').style.display = 'none';
        document.getElementById('newRole').value = u.role;
        document.getElementById('newRole').disabled = !isSuper;
        document.getElementById('btnSaveUser').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> 儲存變更'; 
        document.getElementById('btnCancelUser').classList.remove('hidden-view');
        window.scrollTo({ top: document.getElementById('admin-users').offsetTop, behavior: 'smooth' });
      },
      resetUserForm: () => {
        const isSuper = State.systemUser.role === 'superadmin';
        document.getElementById('editUserId').value = '';
        document.getElementById('newUsername').value = '';
        document.getElementById('newUsername').disabled = !isSuper;
        document.getElementById('newPassword').value = '';
        document.getElementById('newPassword').placeholder = '設定登入密碼';
        document.getElementById('passwordAsterisk').style.display = 'inline';
        document.getElementById('newRole').value = 'admin';
        document.getElementById('newRole').disabled = !isSuper;
        document.getElementById('btnSaveUser').innerHTML = '<i class="fa-solid fa-user-plus"></i> 新增帳戶'; 
        document.getElementById('btnCancelUser').classList.add('hidden-view');
        Admin.renderUsers();
      },
      renderRooms: () => {
        const rGrid = document.getElementById('adminRoomsGrid');
        const isSuper = State.systemUser.role === 'superadmin';
        const managedRoomIds = State.systemUser.managedRooms || [];
        const viewableRooms = isSuper ? Utils.getSortedRooms() : Utils.getSortedRooms().filter(r => managedRoomIds.includes(r.id));
        
        rGrid.innerHTML = viewableRooms.map(r => {
          const editClass = document.getElementById('editRoomId').value === r.id ? 'border-blue-400 bg-blue-50 shadow-md ring-2 ring-blue-100' : 'border-gray-200 bg-white hover:border-blue-200 hover:shadow-md';
          return `<div class="p-5 rounded-xl border flex justify-between items-center transition-all ${editClass}">
            <div>
              <div class="font-bold text-lg flex items-center gap-2 mb-2">
                ${Utils.esc(r.name)} 
                ${r.roomNumber ? `<span class="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">${Utils.esc(r.roomNumber)}</span>`:''}
              </div>
              <div class="flex gap-2 mt-1 items-center flex-wrap">
                <span class="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded tracking-wide">${Utils.esc(r.type)}</span>
                ${r.requiresAuthCode === true || r.requiresAuthCode === 'true' ? '<span class="text-[10px] text-purple-600 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded flex items-center gap-1"><i class="fa-solid fa-key"></i>需授權碼</span>' : ''}
                ${r.capacity && r.capacity > 0 ? `<span class="text-[10px] text-gray-600 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded flex items-center gap-1"><i class="fa-solid fa-user-group"></i>上限 ${r.capacity}人</span>` : ''}
                <span class="text-[11px] text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono"><i class="fa-solid fa-sort mr-1"></i>排序: ${r.order||0}</span>
              </div>
            </div>
            <div class="flex gap-1">
              <button onclick="App.Admin.startEditRoom('${Utils.escAttr(r.id)}')" class="text-blue-500 hover:bg-blue-100 p-2 rounded-lg transition-colors" title="編輯"><i class="fa-solid fa-pen-to-square"></i></button>
              ${isSuper ? `<button onclick="App.API.deleteData('rooms','${Utils.escAttr(r.id)}')" class="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="刪除"><i class="fa-solid fa-trash-can"></i></button>` : ''}
            </div></div>`;
        }).join('');

        if (!document.getElementById('editRoomId').value) Admin.renderRoomNoticeSlotsForm();
      },
      saveRoom: async () => {
        const name = document.getElementById('rName').value.trim();
        if(!name) return Utils.showToast("請填寫課室/功能室名稱", true);
        const id = document.getElementById('editRoomId').value || `rm_${Date.now()}`;
        
        const customNotices = {};
        const closedSlots = [];
        document.querySelectorAll('.room-notice-input').forEach(input => {
          const tsId = input.id.replace('notice_', '');
          const val = input.value.trim();
          if(val) customNotices[tsId] = val;
          const isOpenCb = document.getElementById(`isOpen_${tsId}`);
          if (isOpenCb && !isOpenCb.checked) closedSlots.push(tsId);
        });

        Utils.showLoading(true, "儲存課室中...");
        const payload = { 
           id, name, roomNumber: document.getElementById('rNum').value.trim(), type: document.getElementById('rType').value, 
           order: Number(document.getElementById('rOrder').value), capacity: Number(document.getElementById('rCapacity').value), 
           customNotices, requiresAuthCode: document.getElementById('rRequiresAuth').checked,
           closedSlots
        };
        try {
          await API.request('saveRow', { table: 'rooms', data: payload });
          API.updateLocalData('rooms', payload);
          Utils.showToast("課室儲存成功");
          Admin.resetRoomForm();
        } catch(e) { Utils.showToast("儲存失敗: " + e.message, true); } 
        finally { Utils.showLoading(false); }
      },
      startEditRoom: (id) => {
        document.getElementById('editRoomId').value=id; 
        Admin.renderRooms(); 
        const r = State.db.rooms.find(x=>x.id===id);
        document.getElementById('rName').value=r.name;
        document.getElementById('rNum').value=r.roomNumber||''; document.getElementById('rType').value=r.type||'課室';
        document.getElementById('rOrder').value=r.order||0;
        document.getElementById('rCapacity').value=r.capacity||0;
        document.getElementById('rRequiresAuth').checked = (r.requiresAuthCode === true || r.requiresAuthCode === 'true');
        
        Admin.renderRoomNoticeSlotsForm(r.customNotices || {}, r.closedSlots || []);
        document.getElementById('btnSaveRoom').innerHTML='<i class="fa-solid fa-floppy-disk"></i> 儲存變更'; 
        document.getElementById('adminRoomFormContainer').classList.remove('hidden-view');
        document.getElementById('btnCancelRoom').classList.remove('hidden-view');
        document.getElementById('rName').focus();
      },
      resetRoomForm: () => {
        document.getElementById('editRoomId').value=''; document.getElementById('rName').value=''; document.getElementById('rNum').value=''; 
        document.getElementById('rType').value='課室'; document.getElementById('rOrder').value=0; document.getElementById('rCapacity').value=0;
        document.getElementById('rRequiresAuth').checked = false;
        Admin.renderRoomNoticeSlotsForm({}, []);
        document.getElementById('btnSaveRoom').innerHTML='<i class="fa-solid fa-plus"></i> 新增'; 
        document.getElementById('btnCancelRoom').classList.add('hidden-view');
        if (State.systemUser && State.systemUser.role !== 'superadmin') {
           document.getElementById('adminRoomFormContainer').classList.add('hidden-view');
        }
        Admin.renderRooms();
      },
      renderClasses: () => {
        const cGrid = document.getElementById('adminClassesGrid');
        if (!cGrid) return;
        const sortedClasses = Utils.getSortedClasses();
        if (sortedClasses.length === 0) cGrid.innerHTML = '<div class="col-span-full p-6 text-center text-gray-400">目前沒有設定任何班級。</div>';
        else {
          cGrid.innerHTML = sortedClasses.map(c => {
            const editClass = document.getElementById('editClassId').value === c.id ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 bg-white hover:border-blue-200 shadow-sm hover:shadow-md';
            return `<div class="p-3 rounded-xl border flex justify-between items-center transition-all ${editClass}">
              <div>
                <div class="font-bold text-base text-gray-800">${Utils.esc(c.name)}</div>
                <div class="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-mono mt-1 w-max">排序: ${c.order||0}</div>
              </div>
              <div class="flex flex-col gap-1">
                <button onclick="App.Admin.startEditClass('${Utils.escAttr(c.id)}')" class="text-blue-500 hover:bg-blue-100 p-1.5 rounded-md transition-colors"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="App.API.deleteData('classes','${Utils.escAttr(c.id)}')" class="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"><i class="fa-solid fa-trash-can"></i></button>
              </div></div>`;
          }).join('');
        }
      },
      saveClass: async () => {
        const name = document.getElementById('cName').value.trim();
        if(!name) return Utils.showToast("請填寫班級名稱", true);
        const id = document.getElementById('editClassId').value || `c_${Date.now()}`;
        Utils.showLoading(true, "儲存班級中...");
        const payload = { id, name, order: Number(document.getElementById('cOrder').value) };
        try {
          await API.request('saveRow', { table: 'classes', data: payload });
          API.updateLocalData('classes', payload);
          Utils.showToast("班級儲存成功");
          Admin.resetClassForm();
        } catch(e) { Utils.showToast("儲存失敗: " + e.message, true); } 
        finally { Utils.showLoading(false); }
      },
      startEditClass: (id) => {
        const c = State.db.classes.find(x=>x.id===id);
        document.getElementById('editClassId').value=id; document.getElementById('cName').value=c.name;
        document.getElementById('cOrder').value=c.order||0;
        document.getElementById('btnSaveClass').innerHTML='<i class="fa-solid fa-floppy-disk"></i> 儲存變更'; 
        document.getElementById('btnCancelClass').classList.remove('hidden-view');
        Admin.renderClasses(); document.getElementById('cName').focus();
      },
      resetClassForm: () => {
        document.getElementById('editClassId').value=''; document.getElementById('cName').value=''; 
        document.getElementById('cOrder').value=0;
        document.getElementById('btnSaveClass').innerHTML='<i class="fa-solid fa-plus"></i> 新增'; document.getElementById('btnCancelClass').classList.add('hidden-view');
        Admin.renderClasses();
      },
      renderTimeSlots: () => {
        const tsGrid = document.getElementById('adminTimeSlotsGrid');
        const sortedSlots = Utils.getSortedTimeSlots();
        if(sortedSlots.length === 0) tsGrid.innerHTML = '<div class="col-span-full p-6 text-center text-gray-400">目前沒有設定任何時間段，使用者將無法進行預約。</div>';
        else {
          tsGrid.innerHTML = sortedSlots.map(ts => {
            const editClass = document.getElementById('editTimeSlotId').value === ts.id ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100' : 'border-gray-200 bg-white hover:border-blue-200 shadow-sm hover:shadow-md';
            return `<div class="p-4 rounded-xl border flex flex-col justify-center transition-all ${editClass}">
              <div class="flex justify-between items-start mb-2">
                <div class="font-bold text-base text-gray-800">${Utils.esc(ts.name)}</div>
                <div class="flex gap-1">
                  <button onclick="App.Admin.startEditTimeSlot('${Utils.escAttr(ts.id)}')" class="text-blue-500 hover:bg-blue-100 p-1.5 rounded-md transition-colors"><i class="fa-solid fa-pen-to-square"></i></button>
                  <button onclick="App.API.deleteData('timeSlots','${Utils.escAttr(ts.id)}')" class="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"><i class="fa-solid fa-trash-can"></i></button>
                </div>
              </div>
              <div class="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-mono w-max mt-auto">排序: ${ts.order||0}</div>
            </div>`;
          }).join('');
        }
      },
      saveTimeSlot: async () => {
        const name = document.getElementById('tsName').value.trim();
        if(!name) return Utils.showToast("請填寫時間段名稱", true);
        const id = document.getElementById('editTimeSlotId').value || `ts_${Date.now()}`;
        Utils.showLoading(true, "儲存時段中...");
        const payload = { id, name, order: Number(document.getElementById('tsOrder').value) };
        try {
          await API.request('saveRow', { table: 'timeSlots', data: payload });
          API.updateLocalData('timeSlots', payload);
          Utils.showToast("時間段儲存成功");
          Admin.resetTimeSlotForm();
        } catch(e) { Utils.showToast("儲存失敗: " + e.message, true); } 
        finally { Utils.showLoading(false); }
      },
      startEditTimeSlot: (id) => {
        const ts = State.db.timeSlots.find(x=>x.id===id);
        document.getElementById('editTimeSlotId').value=id; document.getElementById('tsName').value=ts.name;
        document.getElementById('tsOrder').value=ts.order||0;
        document.getElementById('btnSaveTimeSlot').innerHTML='<i class="fa-solid fa-floppy-disk"></i> 儲存變更'; 
        document.getElementById('btnCancelTimeSlot').classList.remove('hidden-view');
        Admin.renderTimeSlots(); document.getElementById('tsName').focus();
      },
      resetTimeSlotForm: () => {
        document.getElementById('editTimeSlotId').value=''; document.getElementById('tsName').value=''; 
        document.getElementById('tsOrder').value=0;
        document.getElementById('btnSaveTimeSlot').innerHTML='<i class="fa-solid fa-plus"></i> 新增'; document.getElementById('btnCancelTimeSlot').classList.add('hidden-view');
        Admin.renderTimeSlots();
      },
      renderHolidays: () => {
        const hList = document.getElementById('adminHolidaysList');
        hList.innerHTML = Utils.getSortedHolidays().map(h => {
          const sDate = h.startDate || h.date; const eDate = h.endDate || h.date;
          const display = sDate === eDate ? `<i class="fa-regular fa-calendar text-gray-400 mr-2"></i>${sDate}` : `<i class="fa-solid fa-arrows-left-right text-gray-400 mr-2"></i>${sDate} <span class="text-gray-400 mx-1">至</span> ${eDate}`;
          const editClass = document.getElementById('editHolidayId').value === h.id ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100' : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm';
          const statusBadge = (h.allowBooking === true || h.allowBooking === 'true') 
            ? `<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold shadow-sm border border-green-200">開放預約</span>` 
            : `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold shadow-sm border border-red-200">不可預約</span>`;

          return `<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-xl transition-all gap-4 ${editClass}">
            <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full">
              <span class="font-mono bg-gray-100 px-3 py-1.5 rounded-lg font-medium text-sm text-gray-700 shrink-0 border border-gray-200 shadow-inner">${display}</span>
              <span class="font-bold text-gray-800 text-lg flex-1">${Utils.esc(h.description)}</span>
              ${statusBadge}
              <span class="text-[11px] text-gray-500 bg-gray-50 px-2 py-1 rounded border font-mono">排序: ${h.order||0}</span>
            </div>
            <div class="flex gap-1 shrink-0 w-full sm:w-auto justify-end border-t sm:border-0 pt-2 sm:pt-0 mt-2 sm:mt-0">
              <button onclick="App.Admin.startEditHoliday('${Utils.escAttr(h.id)}')" class="text-blue-500 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors text-sm" title="編輯"><i class="fa-solid fa-pen-to-square mr-1"></i>編輯</button>
              <button onclick="App.API.deleteData('holidays','${Utils.escAttr(h.id)}')" class="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors text-sm" title="刪除"><i class="fa-solid fa-trash-can mr-1"></i>刪除</button>
            </div></div>`;
        }).join('');
      },
      saveHoliday: async () => {
        const start = document.getElementById('hStart').value;
        const desc = document.getElementById('hDesc').value.trim();
        const allowBooking = document.getElementById('hAllowBooking').checked;

        if(!start) return Utils.showToast("請選擇開始日期", true);
        if(!desc) return Utils.showToast("請填寫假期名稱", true);
        const end = document.getElementById('hEnd').value || start;
        const id = document.getElementById('editHolidayId').value || `hol_${Date.now()}`;
        Utils.showLoading(true, "儲存假期中...");
        const payload = { id, startDate: start, endDate: end, date: start, description: desc, order: Number(document.getElementById('hOrder').value), allowBooking };
        try {
          await API.request('saveRow', { table: 'holidays', data: payload });
          API.updateLocalData('holidays', payload);
          Utils.showToast("假期儲存成功"); 
          Admin.resetHolidayForm(); 
        } catch(e) { Utils.showToast("儲存失敗: " + e.message, true); } 
        finally { Utils.showLoading(false); }
      },
      startEditHoliday: (id) => {
        const h = State.db.holidays.find(x=>x.id===id);
        document.getElementById('editHolidayId').value=id; document.getElementById('hStart').value=h.startDate||h.date;
        document.getElementById('hEnd').value=h.endDate||h.date; document.getElementById('hDesc').value=h.description; document.getElementById('hOrder').value=h.order||0;
        document.getElementById('hAllowBooking').checked = (h.allowBooking === true || h.allowBooking === 'true');
        document.getElementById('btnSaveHoliday').innerHTML='<i class="fa-solid fa-floppy-disk"></i> 儲存'; document.getElementById('btnCancelHoliday').classList.remove('hidden-view');
        Admin.renderHolidays(); document.getElementById('hStart').focus();
      },
      resetHolidayForm: () => {
        document.getElementById('editHolidayId').value=''; document.getElementById('hStart').value=''; document.getElementById('hEnd').value='';
        document.getElementById('hDesc').value=''; document.getElementById('hOrder').value=0;
        document.getElementById('hAllowBooking').checked = false;
        document.getElementById('btnSaveHoliday').innerHTML='<i class="fa-solid fa-plus"></i> 新增'; document.getElementById('btnCancelHoliday').classList.add('hidden-view');
        Admin.renderHolidays();
      },
      renderPermissions: () => {
        const admins = State.db.users.filter(u => u.role === 'admin');
        const pList = document.getElementById('adminPermissionsList');
        if(admins.length===0) pList.innerHTML = '<div class="p-8 text-center bg-gray-50 border rounded-xl text-gray-500"><i class="fa-solid fa-user-shield text-4xl text-gray-300 mb-3"></i><br>系統中尚無一般管理員 (Admin) 帳號。</div>';
        else {
          pList.innerHTML = admins.map(admin => {
            const checks = Utils.getSortedRooms().map(r => {
              const has = admin.managedRooms?.includes(r.id);
              const bCls = has ? 'bg-blue-50 border-blue-300 text-blue-800 ring-1 ring-blue-300' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600';
              return `<label class="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all shadow-sm ${bCls}">
                <input type="checkbox" ${has?'checked':''} onchange="App.Admin.togglePerm('${Utils.escAttr(admin.id)}','${Utils.escAttr(r.id)}')" class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500">
                <span class="text-sm font-medium whitespace-nowrap">${Utils.esc(r.name)} ${r.roomNumber?`<span class="text-[10px] bg-white/50 px-1 rounded ml-1">${Utils.esc(r.roomNumber)}</span>`:''}</span></label>`;
            }).join('');
            return `<div class="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <h4 class="font-bold text-lg mb-4 flex items-center gap-2 border-b pb-3"><div class="bg-blue-100 p-2 rounded-full"><i class="fa-solid fa-user-tie text-blue-600"></i></div> ${Utils.esc(admin.username)} <span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-normal ml-auto">一般管理員</span></h4>
              <div class="flex flex-wrap gap-2.5">${checks || '<span class="text-sm text-gray-400">尚無課室可分配</span>'}</div></div>`;
          }).join('');
        }
      },
      togglePerm: async (userId, roomId) => {
        const u = State.db.users.find(x=>x.id===userId);
        let cur = u.managedRooms || [];
        const newR = cur.includes(roomId) ? cur.filter(id=>id!==roomId) : [...cur, roomId];
        const payload = { ...u, managedRooms: newR };
        try {
          await API.request('saveRow', { table: 'users', data: payload });
          API.updateLocalData('users', payload);
          Nav.renderActiveScreen();
        } catch(e) { Utils.showToast("更新權限失敗: " + e.message, true); }
      },
      renderSettings: () => {
        if (!document.getElementById('settingShowName')) return;
        document.getElementById('settingShowName').checked = Utils.getSetting('print_show_name', true);
        document.getElementById('settingOrderName').value = Utils.getSettingStr('print_order_name', '1');
        document.getElementById('settingShowClass').checked = Utils.getSetting('print_show_class', true);
        document.getElementById('settingOrderClass').value = Utils.getSettingStr('print_order_class', '2');
        document.getElementById('settingShowParticipants').checked = Utils.getSetting('print_show_participants', true);
        document.getElementById('settingOrderParticipants').value = Utils.getSettingStr('print_order_participants', '3');
        document.getElementById('settingShowPurpose').checked = Utils.getSetting('print_show_purpose', true);
        document.getElementById('settingOrderPurpose').value = Utils.getSettingStr('print_order_purpose', '4');
      },
      saveSettings: async () => {
        Utils.showLoading(true, "儲存設定中...");
        try {
          const payload = [
              {id: 's1', settingKey: 'print_show_name', settingValue: document.getElementById('settingShowName').checked.toString()},
              {id: 'o1', settingKey: 'print_order_name', settingValue: document.getElementById('settingOrderName').value || '1'},
              {id: 's2', settingKey: 'print_show_class', settingValue: document.getElementById('settingShowClass').checked.toString()},
              {id: 'o2', settingKey: 'print_order_class', settingValue: document.getElementById('settingOrderClass').value || '2'},
              {id: 's4', settingKey: 'print_show_participants', settingValue: document.getElementById('settingShowParticipants').checked.toString()},
              {id: 'o4', settingKey: 'print_order_participants', settingValue: document.getElementById('settingOrderParticipants').value || '3'},
              {id: 's3', settingKey: 'print_show_purpose', settingValue: document.getElementById('settingShowPurpose').checked.toString()},
              {id: 'o3', settingKey: 'print_order_purpose', settingValue: document.getElementById('settingOrderPurpose').value || '4'}
          ];
          await API.request('saveRow', {table: 'settings', data: payload});
          API.updateLocalData('settings', payload);
          Utils.showToast('列印設定已儲存');
        } catch(e) { Utils.showToast("儲存失敗: " + e.message, true); } 
        finally { Utils.showLoading(false); }
      },
      renderAuthCodes: () => {
        const acTbody = document.getElementById('adminAuthCodesTbody');
        if (!acTbody) return;
        const authCodes = Utils.getSortedAuthCodes();
        if (authCodes.length === 0) {
            acTbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400">目前沒有產生任何授權碼。</td></tr>';
        } else {
            acTbody.innerHTML = authCodes.map(c => {
                const isUsed = c.isUsed === true || c.isUsed === 'true';
                const statusBadge = isUsed ? '<span class="bg-gray-100 text-gray-500 px-2 py-1 rounded text-xs font-bold border border-gray-200">已使用</span>' : '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200">未使用</span>';
                const dStr = new Date(c.createdAt).toLocaleString('zh-HK');
                return `<tr class="border-b last:border-0 hover:bg-gray-50">
                    <td class="p-4 font-mono font-bold tracking-widest text-blue-600">${Utils.esc(c.code)}</td>
                    <td class="p-4">${statusBadge}</td>
                    <td class="p-4 text-xs text-gray-500">${Utils.esc(c.createdBy)}</td>
                    <td class="p-4 text-xs text-gray-500">${dStr}</td>
                    <td class="p-4 text-right">
                        <button onclick="App.API.deleteData('authCodes','${Utils.escAttr(c.id)}')" class="text-red-500 hover:text-white hover:bg-red-500 px-3 py-1.5 rounded-lg border border-red-200 transition-all text-sm shadow-sm"><i class="fa-solid fa-trash-can"></i></button>
                    </td>
                </tr>`;
            }).join('');
        }
      },
      generateAuthCode: async () => {
        const code = Math.random().toString(36).substr(2, 6).toUpperCase();
        const payload = { id: `ac_${Date.now()}`, code, isUsed: false, createdBy: State.systemUser.username, createdAt: Date.now() };
        Utils.showLoading(true, "產生授權碼中...");
        try {
          await API.request('saveRow', { table: 'authCodes', data: payload });
          API.updateLocalData('authCodes', payload);
          Utils.showToast("授權碼產生成功");
          Admin.renderAuthCodes();
        } catch (e) { Utils.showToast("產生失敗: " + e.message, true); } 
        finally { Utils.showLoading(false); }
      },
      // ==========================================
      // 時間表列印頁面 (調用 print.js 功能)
      // ==========================================
      renderPrintTab: () => {
        // 確認 HTML 中有對應的容器 (id 請確認是否為 admin-print)
        const container = document.getElementById('admin-print');
        if (!container) return;

        // 取得預設日期區間：今天 ~ 未來一週
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        const todayStr = today.toISOString().split('T')[0];
        const nextWeekStr = nextWeek.toISOString().split('T')[0];

        // 建立與圖中完全相同的 UI 介面
        container.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    
                    <div class="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
                        <h3 class="font-bold text-gray-700 mb-4 flex items-center">
                            <i class="fa-regular fa-calendar mr-2"></i>選擇日期區間
                        </h3>
                        <div class="flex items-center gap-4">
                            <div class="flex-1">
                                <label class="block text-sm text-gray-600 mb-1 font-medium">開始日期</label>
                                <input type="date" id="printStartDate" value="${todayStr}" class="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 shadow-sm">
                            </div>
                            <div class="text-gray-400 mt-6 font-bold">至</div>
                            <div class="flex-1">
                                <label class="block text-sm text-gray-600 mb-1 font-medium">結束日期</label>
                                <input type="date" id="printEndDate" value="${nextWeekStr}" class="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 shadow-sm">
                            </div>
                        </div>
                    </div>

                    <div class="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="font-bold text-gray-700 flex items-center">
                                <i class="fa-solid fa-door-open mr-2"></i>選擇課室
                            </h3>
                            <button id="btn-print-check-all" class="text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded transition-colors shadow-sm font-medium">
                                全選 / 取消全選
                            </button>
                        </div>
                        <div id="adminPrintRoomCheckboxes" class="flex flex-wrap gap-2 min-h-[60px] bg-white p-3 border border-gray-200 rounded">
                        </div>
                    </div>
                </div>

                <div class="flex justify-center gap-4 mt-6 border-t pt-6">
                    <button id="btn-generate-report" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded shadow transition-colors flex items-center font-medium">
                        <i class="fa-solid fa-table-list mr-2"></i>產生報表
                    </button>
                    <button id="btn-export-pdf" class="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded shadow transition-colors flex items-center font-medium">
                        <i class="fa-solid fa-file-pdf mr-2"></i>匯出 PDF
                    </button>
                    <button id="btn-print-friendly" class="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2.5 rounded shadow transition-colors flex items-center font-medium">
                        <i class="fa-solid fa-print mr-2"></i>友善列印
                    </button>
                </div>

                <div id="print-report-container" class="mt-8 hidden border-t pt-6">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="font-bold text-gray-700 text-lg">報表預覽</h3>
                    </div>
                    <div id="print-report-content" class="bg-white border border-gray-200 p-4 overflow-x-auto min-h-[200px] shadow-sm">
                        </div>
                </div>
            </div>
        `;

        // ==========================================
        // 【核心調用 1】呼叫 print.js 渲染課室 Checkbox
        // ==========================================
        const renderRoomsCheckboxes = () => {
            const cbContainer = document.getElementById('adminPrintRoomCheckboxes');
            if (!cbContainer) return;

            try {
                // 防呆：確保資料庫已載入
                if (!State.db || !State.db.rooms) {
                    cbContainer.innerHTML = '<span class="text-sm text-gray-500 p-2"><i class="fa-solid fa-spinner fa-spin mr-2"></i>資料載入中...</span>';
                    return;
                }

                // ★ 關鍵修正：使用淺拷貝 [...]，避免 sort() 改變原始 State 資料導致崩潰
                let printRooms = [...State.db.rooms];

                // 權限過濾：如果不是超級管理員，只顯示有權限的課室
                if (State.systemUser && State.systemUser.role !== 'superadmin') {
                    const managed = State.systemUser.managedRooms || [];
                    printRooms = printRooms.filter(r => managed.includes(r.id));
                }

                // 簡單排序
                printRooms.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));

                if (printRooms.length === 0) {
                    cbContainer.innerHTML = '<span class="text-sm text-red-500 p-2"><i class="fa-solid fa-circle-exclamation mr-1"></i>尚無課室可列印 (或無權限)</span>';
                } else {
                    cbContainer.innerHTML = printRooms.map(r => `
                        <label class="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm text-sm">
                            <input type="checkbox" value="${Utils.esc(r.id)}" class="admin-print-room-cb w-4 h-4 text-blue-600 rounded cursor-pointer">
                            <span class="font-medium text-gray-700">${Utils.esc(r.name)} ${r.roomNumber ? `<span class="text-xs text-gray-500">(${Utils.esc(r.roomNumber)})</span>` : ''}</span>
                        </label>
                    `).join('');
                }
            } catch (err) {
                console.error("渲染課室發生錯誤:", err);
                cbContainer.innerHTML = `<span class="text-sm text-red-500 p-2">渲染錯誤，請重新整理頁面</span>`;
            }
        };

        // 確保 DOM 渲染完畢後再執行
        setTimeout(renderRoomsCheckboxes, 50);

        // ==========================================
        // 綁定按鈕事件
        // ==========================================
        
        // 1. 全選/取消全選
        const btnCheckAll = document.getElementById('btn-print-check-all');
        let isAllChecked = false;
        btnCheckAll.addEventListener('click', () => {
            isAllChecked = !isAllChecked;
            const checkboxes = document.querySelectorAll('#adminPrintRoomCheckboxes .admin-print-room-cb');
            checkboxes.forEach(cb => cb.checked = isAllChecked);
        });

        // 2. 產生報表
        document.getElementById('btn-generate-report').addEventListener('click', () => {
            const startDate = document.getElementById('printStartDate').value;
            const endDate = document.getElementById('printEndDate').value;
            const checkedRooms = Array.from(document.querySelectorAll('#adminPrintRoomCheckboxes .admin-print-room-cb:checked')).map(cb => cb.value);

            if (checkedRooms.length === 0) {
                return Utils.showToast('請至少選擇一間課室', true);
            }

            Print.renderPrintView(startDate, endDate, checkedRooms);
            document.getElementById('print-report-container').classList.remove('hidden');
        });

        // 3. 【核心調用 2】呼叫 print.js 匯出 PDF (利用 html2pdf)
        document.getElementById('btn-export-pdf').addEventListener('click', () => {
            const reportContent = document.getElementById('print-report-content');
            
            // 檢查是否已經產生報表
            if (!reportContent || reportContent.innerHTML.trim() === '') {
                return Utils.showToast('請先點擊「產生報表」後再匯出 PDF！', true);
            }
            
            Print.exportPDF(reportContent);
        });

        // 4. 友善列印 (呼叫瀏覽器原生列印)
        document.getElementById('btn-print-friendly').addEventListener('click', () => {
            window.print();
        });
      },
      exportExcel: () => {
        const isSuper = State.systemUser.role === 'superadmin';
        const mRooms = State.systemUser.managedRooms || [];
        const mBookings = isSuper ? State.db.bookings : State.db.bookings.filter(b => mRooms.includes(b.roomId));
        const sortedBookings = [...mBookings].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        
        const excelData = sortedBookings.map(b => {
          const room = State.db.rooms.find(r=>r.id===b.roomId);
          const uName = b.userName || State.db.users.find(u=>u.id===b.userId)?.username || '訪客';
          const isStudent = b.isStudent === true || b.isStudent === 'true';
          return {
             '預約編號': b.id, '日期': b.date, '時間': b.timeSlot, '課室/功能室': room?.name || '未知', '室號': room?.roomNumber || '',
             '是否為學生': isStudent ? '是' : '否', '班級': b.className || '', '預約人': uName, '人數': b.participants || '',
             '用途': b.purpose || '', '鎖定狀態': (b.isLocked === true || b.isLocked === 'true') ? '已鎖定' : '未鎖定', '建立時間': new Date(b.createdAt).toLocaleString('zh-HK')
          };
        });
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "預約記錄");
        XLSX.writeFile(wb, `預約記錄匯出_${new Date().toISOString().split('T')[0]}.xlsx`);
      },
      backupDB: () => {
        if(!State.db) return Utils.showToast("沒有資料可備份", true);
        const wb = XLSX.utils.book_new();
        // 不匯出 users：備份檔不含密碼雜湊，帳號請改用 mysqldump 備份
        ['bookings', 'rooms', 'timeSlots', 'holidays', 'authCodes', 'classes', 'settings'].forEach(tableName => {
           if(State.db[tableName] && State.db[tableName].length > 0) {
              const ws = XLSX.utils.json_to_sheet(State.db[tableName].map(row => {
                 let newRow = {};
                 for(let key in row) newRow[key] = (typeof row[key] === 'object' && row[key] !== null) ? JSON.stringify(row[key]) : row[key];
                 return newRow;
              }));
              XLSX.utils.book_append_sheet(wb, ws, tableName);
           }
        });
        XLSX.writeFile(wb, `系統備份_${new Date().toISOString().split('T')[0]}.xlsx`);
      },
      downloadTemplate: () => {
        const ws = XLSX.utils.aoa_to_sheet([
          ['日期(YYYY-MM-DD)', '時段', '課室/功能室', '預約人', '預約人數', '班級', '用途', '是否為學生(是/否)'],
          ['2024-05-01', '08:00-09:00', '1A', '陳大文', '30', '1A', '補課', '是']
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "預約匯入範本");
        XLSX.writeFile(wb, "預約匯入範本.xlsx");
      },
      importBookings: (e) => {
         const file = e.target.files[0];
         if(!file) return;
         const reader = new FileReader();
         reader.onload = async (evt) => {
           Utils.showLoading(true, "正在分析與匯入資料...");
           try {
             const workbook = XLSX.read(evt.target.result, {type: 'binary'});
             const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
             if(rows.length === 0) throw new Error("Excel 檔案沒有資料");
             
             let successCount = 0, failCount = 0, newBookings = [];
             const dbData = State.db;

             for (const row of rows) {
                const date = row['日期(YYYY-MM-DD)'] || row['日期'];
                const timeSlot = row['時段'] || row['時間'];
                const roomName = row['課室/功能室'] || row['房間'];
                const userName = row['預約人'] || row['姓名'];
                if(!date || !timeSlot || !roomName || !userName) { failCount++; continue; }

                const room = dbData.rooms.find(r => r.name === roomName);
                if(!room) { failCount++; continue; }
                if (Utils.isSlotClosed(timeSlot, room, dbData.timeSlots)) { failCount++; continue; }
                
                let isConflict = false;
                for(let b of dbData.bookings) if (b.roomId === room.id && b.date === date && Utils.isTimeOverlap(timeSlot, b.timeSlot)) { isConflict = true; break; }
                for(let nb of newBookings) if (nb.roomId === room.id && nb.date === date && Utils.isTimeOverlap(timeSlot, nb.timeSlot)) { isConflict = true; break; }
                if (isConflict) { failCount++; continue; }

                newBookings.push({
                   id: `bk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                   roomId: room.id, date, timeSlot, userId: State.systemUser ? State.systemUser.id : 'imported', userName,
                   purpose: row['用途'] || '', createdAt: Date.now(), isLocked: false,
                   isStudent: (row['是否為學生(是/否)'] || '否') === '是', className: row['班級'] || '', participants: parseInt(row['預約人數'] || 0)
                });
                successCount++;
             }
             if (newBookings.length > 0) {
                await API.request('saveRow', { table: 'bookings', data: newBookings });
                API.updateLocalData('bookings', newBookings);
                Nav.renderActiveScreen();
             }
             Utils.showToast(`匯入完成！成功: ${successCount} 筆，失敗/衝突: ${failCount} 筆`);
           } catch(err) { Utils.showToast("匯入錯誤: " + err.message, true); } 
           finally { Utils.showLoading(false); e.target.value = null; }
         };
         reader.readAsBinaryString(file);
      },
      restoreDB: (e) => {
         const file = e.target.files[0];
         if(!file) return;
         Utils.customConfirm("⚠️ 警告：資料還原將會清除目前系統中的所有資料，並以備份檔覆蓋。\n確定要執行還原嗎？", () => {
           const reader = new FileReader();
           reader.onload = async (evt) => {
              Utils.showLoading(true, "正在還原資料庫，請勿關閉視窗...");
              try {
                 const workbook = XLSX.read(evt.target.result, {type: 'binary'});
                 let payload = {};
                 workbook.SheetNames.forEach(sheetName => {
                    payload[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]).map(r => {
                       let newRow = {};
                       for(let k in r) {
                          try { const parsed = JSON.parse(r[k]); newRow[k] = (typeof parsed === 'object' && parsed !== null) ? parsed : r[k]; } 
                          catch(err) { newRow[k] = r[k]; }
                       } return newRow;
                    });
                 });
                 const res = await API.request('restoreDB', payload);
                 localStorage.removeItem('booking_system_cache_v2');
                 Utils.showToast((res.message || '資料庫還原成功') + '！系統即將重新載入...');
                 setTimeout(() => { window.location.reload(); }, 2000);
              } catch(err) {
                 Utils.showToast("還原發生錯誤: " + err.message, true);
                 Utils.showLoading(false);
              }
           };
           reader.readAsBinaryString(file);
         });
         e.target.value = null;
      }
    };
