import { State } from './state.js';

export const Utils = {
      /**
       * 所有使用者輸入（姓名、用途、班級、課室名稱…）在插入樣板字串前都必須先逸出，
       * 否則含有 < > " 的內容會破壞版面，甚至造成 XSS。
       */
      esc: (val) => {
        if (val === null || val === undefined) return '';
        return String(val)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      },
      /**
       * 用於 onclick="App.X.y('...')" 這類行內事件的字串參數：
       * 先逸出 JS 字串（反斜線、單引號），再逸出 HTML 屬性。
       */
      escAttr: (val) => {
        if (val === null || val === undefined) return '';
        return String(val)
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      },
      /**
       * 密碼在送出前先做 SHA-256（與原版本相同的傳輸格式）。
       * crypto.subtle 只在 HTTPS 或 localhost 可用，若系統架在校內 http:// 位址，
       * 就改用下方的純 JS 實作，避免登入功能整個失效。
       */
      hashPassword: async (password) => {
        const bytes = new TextEncoder().encode(password);
        if (window.crypto && window.crypto.subtle && window.isSecureContext) {
          const hash = await window.crypto.subtle.digest('SHA-256', bytes);
          return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        return Utils.sha256Fallback(bytes);
      },
      /** SHA-256 純 JS 實作（僅在無法使用 crypto.subtle 時採用） */
      sha256Fallback: (bytes) => {
        const K = [
          0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
          0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
          0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
          0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
          0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
          0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
          0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
          0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
        ];
        const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
        const rotr = (x, n) => (x >>> n) | (x << (32 - n));

        const bitLen = bytes.length * 8;
        const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) * 64);
        padded.set(bytes);
        padded[bytes.length] = 0x80;
        new DataView(padded.buffer).setUint32(padded.length - 4, bitLen >>> 0, false);
        new DataView(padded.buffer).setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), false);

        const view = new DataView(padded.buffer);
        const w = new Uint32Array(64);
        for (let i = 0; i < padded.length; i += 64) {
          for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4, false);
          for (let t = 16; t < 64; t++) {
            const s0 = rotr(w[t-15], 7) ^ rotr(w[t-15], 18) ^ (w[t-15] >>> 3);
            const s1 = rotr(w[t-2], 17) ^ rotr(w[t-2], 19) ^ (w[t-2] >>> 10);
            w[t] = (w[t-16] + s0 + w[t-7] + s1) >>> 0;
          }
          let [a,b,c,d,e,f,g,h] = H;
          for (let t = 0; t < 64; t++) {
            const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
            const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) >>> 0;
            h = g; g = f; f = e; e = (d + temp1) >>> 0;
            d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
          }
          H[0]=(H[0]+a)>>>0; H[1]=(H[1]+b)>>>0; H[2]=(H[2]+c)>>>0; H[3]=(H[3]+d)>>>0;
          H[4]=(H[4]+e)>>>0; H[5]=(H[5]+f)>>>0; H[6]=(H[6]+g)>>>0; H[7]=(H[7]+h)>>>0;
        }
        return H.map(x => x.toString(16).padStart(8, '0')).join('');
      },
      showToast: (msg, isError = false) => {
        const t = document.getElementById('toastMessage');
        if(!t) return;
        t.innerHTML = `<i class="fa-solid ${isError ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i> ${msg}`;
        t.className = `fixed top-20 right-4 ${isError ? 'bg-red-600' : 'bg-green-600'} text-white px-5 py-3 rounded-lg shadow-xl z-[100] fade-in transition-all font-medium flex items-center gap-2`;
        t.classList.remove('hidden-view');
        setTimeout(() => t.classList.add('hidden-view'), 3000);
      },
      customConfirm: (msg, callback) => {
        document.getElementById('confirmMessage').textContent = msg;
        const btn = document.getElementById('confirmBtn');
        btn.onclick = () => {
            document.getElementById('confirmModal').classList.add('hidden-view');
            callback();
        };
        document.getElementById('confirmModal').classList.remove('hidden-view');
      },
      showLoading: (show, text = '系統處理中...') => {
        const el = document.getElementById('globalLoadingOverlay');
        const textEl = document.getElementById('globalLoadingText');
        if(el && textEl) {
           if(show) {
               textEl.textContent = text;
               el.classList.remove('hidden-view');
           } else {
               el.classList.add('hidden-view');
           }
        }
      },
      formatLocalDate: (val) => {
        if (!val) return '';
        const strVal = String(val);
        if (strVal.includes('T') && strVal.endsWith('Z')) {
          const d = new Date(strVal);
          if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          }
        }
        return strVal.split('T')[0];
      },
      getMonday: (dateStr) => {
        const parts = dateStr.split('-');
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      },
      maskUsername: (name) => {
        if (!name) return "***";
        if (name.length <= 1) return "*";
        if (name.length === 2) return name[0] + "*";
        return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
      },
      isTimeOverlap: (slot1, slot2) => {
        const parseTime = (str) => {
          if(!str) return null;
          const m = str.match(/(\d{1,2}):(\d{2})/);
          return m ? parseInt(m[1])*60 + parseInt(m[2]) : null;
        };
        const getSE = (str) => {
          const p = str.split('-');
          if(p.length !== 2) return null;
          const s = parseTime(p[0]), e = parseTime(p[1]);
          return (s !== null && e !== null && s < e) ? {s, e} : null;
        };
        const a = getSE(slot1), b = getSE(slot2);
        if (!a || !b) return slot1 === slot2; 
        return a.s < b.e && a.e > b.s;
      },
      getSetting: (key, defaultVal) => {
         const data = State.db;
         if(!data || !data.settings) return defaultVal;
         const s = data.settings.find(x => x.settingKey === key);
         return s ? (String(s.settingValue).toLowerCase() === 'true') : defaultVal;
      },
      getSettingStr: (key, defaultVal) => {
         const data = State.db;
         if(!data || !data.settings) return defaultVal;
         const s = data.settings.find(x => x.settingKey === key);
         return s ? s.settingValue : defaultVal;
      },
      getSortedRooms: () => [...(State.db.rooms || [])].sort((a, b) => (a.order || 0) - (b.order || 0)),
      getSortedHolidays: () => [...(State.db.holidays || [])].sort((a, b) => (a.order || 0) - (b.order || 0)),
      getSortedTimeSlots: () => [...(State.db.timeSlots || [])].sort((a, b) => (a.order || 0) - (b.order || 0)),
      getSortedAuthCodes: () => [...(State.db.authCodes || [])].sort((a, b) => b.createdAt - a.createdAt),
      getSortedClasses: () => [...(State.db.classes || [])].sort((a, b) => (a.order || 0) - (b.order || 0)),
      isSlotClosed: (slotNameToCheck, roomObj, allTimeSlots) => {
          if (!roomObj || !roomObj.closedSlots || roomObj.closedSlots.length === 0) return false;
          const closedTsObjects = allTimeSlots.filter(ts => roomObj.closedSlots.includes(ts.id));
          for (const ts of closedTsObjects) {
              if (Utils.isTimeOverlap(slotNameToCheck, ts.name)) return true;
          }
          return false;
      },
      checkOverlap: (newSlotName, roomId, date) => {
          const dayB = State.db.bookings.filter(b => b.roomId === roomId && b.date === date);
          for(let b of dayB) {
              if (Utils.isTimeOverlap(newSlotName, b.timeSlot)) return true;
          }
          return false;
      }
    };
