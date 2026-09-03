import { State } from './state.js';
import { Utils } from './utils.js';

// ==========================================
//  列印 / 時間表視圖
// ==========================================
const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export const Print = {
  // -------------------------------------------------
  // 公開頁面：以「週一起算 6 天」為單位的時間表
  // -------------------------------------------------
  renderCheckboxes: () => {
    const container = document.getElementById('printRoomCheckboxes');
    if (!container) return;

    let printRooms = Utils.getSortedRooms();
    if (State.systemUser && State.systemUser.role !== 'superadmin') {
      const managed = State.systemUser.managedRooms || [];
      printRooms = printRooms.filter(r => managed.includes(r.id));
    }

    const currentChecked = Array.from(document.querySelectorAll('#printRoomCheckboxes .print-room-cb:checked')).map(cb => cb.value);
    const isFirstRender = container.innerHTML.trim() === '';

    if (printRooms.length === 0) {
      container.innerHTML = '<span class="text-sm text-gray-500 p-2">尚無課室可列印 (或無權限)</span>';
      return;
    }

    container.innerHTML = printRooms.map(r => {
      const isChecked = isFirstRender ? false : currentChecked.includes(r.id);
      return `<label class="flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors shadow-sm text-sm">
        <input type="checkbox" value="${Utils.esc(r.id)}" class="print-room-cb w-4 h-4 text-blue-600 rounded" ${isChecked ? 'checked' : ''} onchange="App.Print.render()">
        <span class="font-medium">${Utils.esc(r.name)} ${r.roomNumber ? `<span class="text-xs text-gray-500 font-normal">(${Utils.esc(r.roomNumber)})</span>` : ''}</span>
      </label>`;
    }).join('');

    if (isFirstRender) Print.render();
  },

  toggleAllRooms: (check) => {
    document.querySelectorAll('#printRoomCheckboxes .print-room-cb').forEach(cb => { cb.checked = check; });
    Print.render();
  },

  onDateChange: () => {
    const el = document.getElementById('printDateInput');
    if (el && el.value) {
      el.value = Utils.getMonday(el.value);
      Print.render();
    }
  },

  changeWeek: (dir) => {
    const el = document.getElementById('printDateInput');
    if (!el || !el.value) return;
    const parts = el.value.split('-');
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + (dir * 7));
    el.value = Print.toDateStr(d);
    Print.render();
  },

  render: () => {
    const container = document.getElementById('printContainer');
    if (!container) return;

    const startDateStr = document.getElementById('printDateInput').value;
    if (!startDateStr) return;

    const dates = Print.dateRange(startDateStr, 6);
    const selectedRoomIds = Array.from(document.querySelectorAll('#printRoomCheckboxes .print-room-cb:checked')).map(cb => cb.value);
    const roomsToPrint = Utils.getSortedRooms().filter(r => selectedRoomIds.includes(r.id));

    if (roomsToPrint.length === 0) {
      container.innerHTML = '<div class="text-center p-12 text-gray-500 border-2 border-dashed rounded-xl">請至少勾選一個課室進行預覽與列印</div>';
      return;
    }
    container.innerHTML = Print.buildTables(roomsToPrint, dates);
  },

  // -------------------------------------------------
  // 後台「時間表列印」分頁：自由選擇日期區間
  // -------------------------------------------------
  renderPrintView: (startDate, endDate, roomIds) => {
    const target = document.getElementById('print-report-content');
    if (!target) return;

    if (!startDate || !endDate || startDate > endDate) {
      target.innerHTML = '<div class="text-center p-8 text-red-500">日期區間無效，結束日期必須大於或等於開始日期</div>';
      return;
    }

    const dates = [];
    const parts = startDate.split('-');
    const cursor = new Date(parts[0], parts[1] - 1, parts[2]);
    // 上限 31 天，避免一次產生過大的報表
    while (Print.toDateStr(cursor) <= endDate && dates.length < 31) {
      dates.push(Print.toDateStr(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const rooms = Utils.getSortedRooms().filter(r => roomIds.includes(r.id));
    if (rooms.length === 0) {
      target.innerHTML = '<div class="text-center p-8 text-gray-500">請至少選擇一間課室</div>';
      return;
    }
    target.innerHTML = Print.buildTables(rooms, dates);
  },

  // -------------------------------------------------
  // 共用：依課室與日期陣列產生時間表 HTML
  // -------------------------------------------------
  buildTables: (rooms, dates) => {
    const data = State.db;
    const baseTimeSlots = Utils.getSortedTimeSlots().map(ts => ts.name);
    const weekBookings = (data.bookings || []).filter(
      b => rooms.some(r => r.id === b.roomId) && dates.includes(b.date)
    );

    // 除了固定時段外，也把「自訂時段」補進列印的列中
    const uniqueSlotsSet = new Set(baseTimeSlots);
    weekBookings.forEach(b => {
      if (baseTimeSlots.includes(b.timeSlot)) return;
      const overlapsBase = baseTimeSlots.some(baseSlot => Utils.isTimeOverlap(b.timeSlot, baseSlot));
      if (!overlapsBase) uniqueSlotsSet.add(b.timeSlot);
    });

    const getMin = (str) => {
      const m = String(str).match(/(\d{1,2}):(\d{2})/);
      return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 9999;
    };
    const printSlots = Array.from(uniqueSlotsSet).sort((a, b) => getMin(a) - getMin(b));

    if (printSlots.length === 0) {
      return '<div class="text-center p-12 text-gray-500 border-2 border-dashed rounded-xl">尚無任何時間段設定或預約</div>';
    }

    const displayDates = dates.map(d => {
      const p = d.split('-');
      const dow = new Date(p[0], p[1] - 1, p[2]).getDay();
      return `${d}<br><span class="text-xs font-normal text-gray-500">(星期${DAY_NAMES[dow]})</span>`;
    });

    const showName = Utils.getSetting('print_show_name', true);
    const orderName = parseInt(Utils.getSettingStr('print_order_name', '1')) || 1;
    const showClass = Utils.getSetting('print_show_class', true);
    const orderClass = parseInt(Utils.getSettingStr('print_order_class', '2')) || 2;
    const showParti = Utils.getSetting('print_show_participants', true);
    const orderParti = parseInt(Utils.getSettingStr('print_order_participants', '3')) || 3;
    const showPurpose = Utils.getSetting('print_show_purpose', true);
    const orderPurpose = parseInt(Utils.getSettingStr('print_order_purpose', '4')) || 4;

    return rooms.map(room => `
      <div class="print-page-break mb-8 print:mb-0 w-full" style="page-break-inside: avoid;">
        <div class="text-center mb-2 shrink-0">
          <h1 class="text-xl print:text-sm font-bold text-gray-800 leading-tight">${Utils.esc(room.name)} ${room.roomNumber ? `(${Utils.esc(room.roomNumber)})` : ''} - 預約時間表</h1>
          <p class="text-gray-600 mt-1 print:mt-0 font-medium print:text-[9px] leading-tight">日期範圍：${dates[0]} 至 ${dates[dates.length - 1]}</p>
        </div>
        <div class="w-full overflow-x-auto pb-4 custom-scrollbar">
          <table class="w-full min-w-[900px] border-collapse table-fixed">
            <thead class="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th class="border-r border-gray-300 p-2 w-20 print:w-16 bg-gray-200 font-bold text-gray-700 align-middle print-tiny-text">時間 \\ 日期</th>
                ${displayDates.map(disp => `<th class="border-r border-gray-300 p-2 font-bold text-center text-gray-700 leading-tight align-middle print-tiny-text">${disp}</th>`).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              ${printSlots.map(slotName => `
                <tr>
                  <td class="border-r border-gray-300 p-2 font-bold text-center bg-gray-50 text-gray-700 break-words whitespace-normal print-tiny-text">${Utils.esc(slotName)}</td>
                  ${dates.map(d => Print.buildCell(room, slotName, d, {
                    showName, orderName, showClass, orderClass, showParti, orderParti, showPurpose, orderPurpose
                  })).join('')}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`).join('');
  },

  buildCell: (room, slotName, date, opts) => {
    const data = State.db;
    const tsObj = (data.timeSlots || []).find(t => t.name === slotName);
    const isClosed = tsObj && room.closedSlots && room.closedSlots.includes(tsObj.id);

    if (isClosed) {
      const noticeText = tsObj && room.customNotices && room.customNotices[tsObj.id]
        ? room.customNotices[tsObj.id]
        : '不開放預約';
      return `<td class="border-r border-b border-gray-300 px-1 py-2 align-middle bg-gray-100/50 text-center">
                <div class="text-gray-500 font-bold opacity-80 print-tiny-text">
                  <i class="fa-solid fa-ban text-[9px] mb-0.5"></i><br/>
                  <span class="leading-none whitespace-normal break-words">${Utils.esc(noticeText)}</span>
                </div>
              </td>`;
    }

    const cellBookings = (data.bookings || []).filter(bk =>
      bk.roomId === room.id && bk.date === date && Utils.isTimeOverlap(bk.timeSlot, slotName)
    );
    if (cellBookings.length === 0) {
      return `<td class="border-r border-b border-gray-300 px-1 py-2 align-middle text-center"></td>`;
    }

    const b = cellBookings[0];
    const uName = b.userName || (data.users || []).find(u => u.id === b.userId)?.username || '訪客';
    const actualTimeStr = (b.timeSlot !== slotName)
      ? `<div class="print-tiny-text text-red-600 font-bold mb-1 bg-red-50 rounded px-1 w-max mx-auto leading-tight">[自訂] ${Utils.esc(b.timeSlot)}</div>`
      : '';
    const isStudent = b.isStudent === true || b.isStudent === 'true';

    const parts = [];
    if (opts.showClass && isStudent && b.className) {
      parts.push({ order: opts.orderClass, html: `<span class="print-tiny-text font-bold text-indigo-700 bg-indigo-50 px-1 rounded inline-block mx-0.5 mb-1 leading-tight">${Utils.esc(b.className)}</span>` });
    }
    if (opts.showName) {
      parts.push({ order: opts.orderName, html: `<span class="font-bold text-blue-800 print-tiny-text inline-block mx-0.5 mb-1 max-w-[90px] whitespace-normal break-words leading-tight">${Utils.esc(uName)}</span>` });
    }
    if (opts.showParti && b.participants) {
      parts.push({ order: opts.orderParti, html: `<span class="print-tiny-text text-gray-500 inline-block mx-0.5 mb-1 leading-tight">(${Number(b.participants)}人)</span>` });
    }
    if (opts.showPurpose && b.purpose) {
      parts.push({ order: opts.orderPurpose, html: `<div class="print-tiny-text text-gray-600 leading-tight whitespace-normal break-words w-full mt-0.5 text-center">${Utils.esc(b.purpose)}</div>` });
    }
    parts.sort((x, y) => x.order - y.order);

    return `<td class="border-r border-b border-blue-200 px-1 py-2 align-middle text-center bg-[#EBF5FF] shadow-inner">
              <div class="flex flex-col justify-center min-h-[40px]">
                ${actualTimeStr}
                <div class="w-full text-center leading-tight">${parts.map(p => p.html).join('')}</div>
              </div>
            </td>`;
  },

  // -------------------------------------------------
  // 匯出 PDF（html2pdf）
  // -------------------------------------------------
  exportPDF: (targetElement) => {
    if (typeof html2pdf === 'undefined') {
      alert('PDF 轉換套件尚未載入完成，請檢查網路連線或重新整理網頁！');
      return;
    }

    const element = targetElement instanceof HTMLElement
      ? targetElement
      : document.getElementById('printContainer');

    if (!element || !element.querySelector('.print-page-break')) {
      alert('請先選擇課室並產生預覽內容！');
      return;
    }

    const scrollWrappers = element.querySelectorAll('.overflow-x-auto');
    scrollWrappers.forEach(el => el.classList.remove('overflow-x-auto'));
    const tables = element.querySelectorAll('table');
    tables.forEach(table => {
      table.classList.remove('min-w-[900px]');
      table.style.width = '100%';
    });

    const originalStyle = element.getAttribute('style') || '';
    const originalBodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'visible';
    element.style.width = '1600px';
    element.style.maxWidth = '1600px';
    element.style.backgroundColor = '#ffffff';

    const restore = () => {
      element.setAttribute('style', originalStyle);
      document.body.style.overflow = originalBodyOverflow;
      scrollWrappers.forEach(el => el.classList.add('overflow-x-auto'));
      tables.forEach(table => table.classList.add('min-w-[900px]'));
    };

    const opt = {
      margin: [5, 5, 5, 5],
      filename: `預約時間表_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      pagebreak: { mode: ['css', 'legacy'], avoid: '.print-page-break' },
      html2canvas: { scale: 2, useCORS: true, windowWidth: 1600, width: 1600, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save()
      .then(restore)
      .catch(err => {
        console.error('PDF 匯出失敗:', err);
        alert('PDF 匯出發生錯誤，請檢查主控台訊息。');
        restore();
      });
  },

  // -------------------------------------------------
  // 小工具
  // -------------------------------------------------
  toDateStr: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,

  dateRange: (startStr, days) => {
    const parts = startStr.split('-');
    const start = new Date(parts[0], parts[1] - 1, parts[2]);
    const out = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      out.push(Print.toDateStr(d));
    }
    return out;
  }
};
