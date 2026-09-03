import { State } from './state.js';
import { Utils } from './utils.js';
import { API } from './api.js';
import { Nav } from './nav.js';

export const Booking = {
      setViewMode: (mode) => {
        State.bookingViewMode = mode;
        State.selectedSlots = [];
        document.getElementById('btnViewDay').className = mode === 'day' ? 'px-4 py-1.5 rounded-md text-sm font-bold bg-white shadow-sm text-blue-600 transition-all' : 'px-4 py-1.5 rounded-md text-sm font-bold text-gray-500 hover:text-gray-700 transition-all';
        document.getElementById('btnViewWeek').className = mode === 'week' ? 'px-4 py-1.5 rounded-md text-sm font-bold bg-white shadow-sm text-blue-600 transition-all' : 'px-4 py-1.5 rounded-md text-sm font-bold text-gray-500 hover:text-gray-700 transition-all';
        Booking.renderTimeSlots();
      },
      onDateChange: () => {
        State.selectedDate = document.getElementById('bookingDateInput').value;
        State.selectedSlots = [];
        Booking.render();
      },
      changeWeek: (dir) => {
        const d = new Date(State.selectedDate);
        d.setDate(d.getDate() + (dir * 7));
        State.selectedDate = d.toISOString().split('T')[0];
        document.getElementById('bookingDateInput').value = State.selectedDate;
        State.selectedSlots = [];
        Booking.render();
      },
      onRoomSearch: (val) => {
        State.roomSearchKeyword = String(val || '').toLowerCase();
        State.selectedSlots = [];
        Booking.renderRoomList();
        Booking.renderTimeSlots();
      },
      filterRoomType: (type) => {
        State.roomFilterType = type;
        State.selectedSlots = [];
        const btns = { 'all': 'btnFilterAll', '課室': 'btnFilterClassroom', '功能室': 'btnFilterFunction' };
        for (const k in btns) {
           const el = document.getElementById(btns[k]);
           if (k === type) el.className = "flex-1 py-1.5 rounded-md bg-blue-600 text-white shadow-sm transition-colors";
           else el.className = "flex-1 py-1.5 rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors";
        }
        Booking.renderRoomList();
        Booking.renderTimeSlots();
      },
      selectRoom: (roomId) => {
        State.selectedRoomId = roomId;
        State.selectedSlots = [];
        Booking.renderRoomList();
        Booking.renderTimeSlots();
        if(window.innerWidth < 768) document.getElementById('timeSlotsContainer').scrollIntoView({ behavior: 'smooth' });
      },
      toggleSlotSelection: (slotName, dateStr = State.selectedDate) => {
        const selectedRoom = State.db.rooms.find(r => r.id === State.selectedRoomId);
        const isHoliday = Utils.getSortedHolidays().find(h => {
          const start = Utils.formatLocalDate(h.startDate || h.date);
          const end = Utils.formatLocalDate(h.endDate || h.date || start);
          return dateStr >= start && dateStr <= end;
        });
        
        if (isHoliday && !(isHoliday.allowBooking === true || isHoliday.allowBooking === 'true')) {
           return Utils.showToast("此日期為不可預約的假期！", true);
        }
        if (Utils.isSlotClosed(slotName, selectedRoom, State.db.timeSlots)) {
           return Utils.showToast("包含不開放預約的時段！", true);
        }
        if (Utils.checkOverlap(slotName, State.selectedRoomId, dateStr)) {
           return Utils.showToast("此時段與已有預約重疊，無法預約！", true);
        }
        const exact = State.db.bookings.find(b => b.roomId === State.selectedRoomId && b.date === dateStr && b.timeSlot === slotName);
        if (exact) return Utils.showToast("此時段已被預約！", true);

        const slotKey = `${dateStr}|${slotName}`;
        if (State.selectedSlots.includes(slotKey)) {
            State.selectedSlots = State.selectedSlots.filter(s => s !== slotKey);
        } else {
            State.selectedSlots.push(slotKey);
        }
        Booking.renderTimeSlots();
      },
      render: () => {
        Booking.renderRoomList();
        Booking.renderTimeSlots();
      },
      renderRoomList: () => {
        const data = State.db;
        const isHoliday = Utils.getSortedHolidays().find(h => {
          const start = Utils.formatLocalDate(h.startDate || h.date);
          const end = Utils.formatLocalDate(h.endDate || h.date || start);
          return State.selectedDate >= start && State.selectedDate <= end;
        });

        const gridContainer = document.getElementById('bookingGridContainer');
        const holidayAlert = document.getElementById('holidayAlert');

        if(isHoliday) {
          const isBookable = isHoliday.allowBooking === true || isHoliday.allowBooking === 'true';
          if (!isBookable) {
              gridContainer.classList.add('hidden-view');
              holidayAlert.classList.remove('hidden-view');
              holidayAlert.className = "bg-red-50 text-red-700 p-6 rounded-xl border border-red-200 flex items-start sm:items-center gap-4 mb-6";
              document.getElementById('holidayAlertIcon').className = "fa-solid fa-circle-exclamation text-3xl shrink-0 mt-1 sm:mt-0";
              document.getElementById('holidayAlertTitle').textContent = "不可預約";
              document.getElementById('holidayAlertText').textContent = `您選擇的日期落在系統設定的假期內（${isHoliday.description}），暫不開放預約。`;
              return;
          } else {
              gridContainer.classList.remove('hidden-view');
              holidayAlert.classList.remove('hidden-view');
              holidayAlert.className = "bg-yellow-50 text-yellow-700 p-6 rounded-xl border border-yellow-200 flex items-start sm:items-center gap-4 mb-6";
              document.getElementById('holidayAlertIcon').className = "fa-solid fa-circle-info text-3xl shrink-0 mt-1 sm:mt-0 text-yellow-600";
              document.getElementById('holidayAlertTitle').textContent = "特別日期提示";
              document.getElementById('holidayAlertText').textContent = `您選擇的日期為「${isHoliday.description}」，但目前仍開放預約。`;
          }
        } else {
          gridContainer.classList.remove('hidden-view');
          holidayAlert.classList.add('hidden-view');
        }

        const roomListContainer = document.getElementById('roomListContainer');
        let filteredRooms = Utils.getSortedRooms();
        
        if (State.roomFilterType !== 'all') {
          filteredRooms = filteredRooms.filter(r => r.type === State.roomFilterType);
        }
        if (State.roomSearchKeyword) {
          filteredRooms = filteredRooms.filter(r => 
            String(r.name || '').toLowerCase().includes(State.roomSearchKeyword) || 
            (r.roomNumber && String(r.roomNumber).toLowerCase().includes(State.roomSearchKeyword))
          );
        }
        
        document.getElementById('roomCountBadge').textContent = filteredRooms.length;
        
        if(filteredRooms.length === 0) {
            roomListContainer.innerHTML = '<div class="p-6 text-center text-gray-500 text-sm">找不到符合的課室/功能室</div>';
        } else {
          roomListContainer.innerHTML = filteredRooms.map(r => {
            const isActive = r.id === State.selectedRoomId;
            const bgClass = isActive ? 'bg-blue-600 text-white shadow-md border-blue-600' : 'bg-white hover:bg-blue-50 text-gray-700 border-gray-200';
            const typeClass = isActive ? 'text-blue-200 bg-blue-700' : 'text-gray-500 bg-gray-100';
            const rNumTxt = r.roomNumber ? `• ${Utils.esc(r.roomNumber)}` : '';
            return `
              <button onclick="App.Booking.selectRoom('${Utils.escAttr(r.id)}')" class="w-full text-left p-3 rounded-xl transition-all border flex flex-col gap-1.5 ${bgClass}">
                <div class="font-bold flex justify-between items-center w-full">
                  <span class="truncate">${Utils.esc(r.name)}</span>
                  ${isActive ? '<i class="fa-solid fa-circle-check text-white"></i>' : ''}
                </div>
                <div class="text-[11px] font-medium px-2 py-0.5 rounded w-max ${typeClass}">${Utils.esc(r.type)} ${rNumTxt}</div>
              </button>
            `;
          }).join('');
        }
      },
      renderTimeSlots: () => {
        const timeContainer = document.getElementById('timeSlotsContainer');
        const selectedRoom = State.db.rooms.find(r => r.id === State.selectedRoomId);
        const timeSlots = Utils.getSortedTimeSlots();
        const data = State.db;
        
        if(!selectedRoom) {
          timeContainer.innerHTML = `
            <div class="bg-slate-50 p-12 rounded-xl border border-slate-200 border-dashed text-center text-gray-400 flex flex-col items-center justify-center h-full min-h-[400px]">
              <i class="fa-regular fa-hand-pointer text-5xl mb-4 text-blue-200"></i>
              <p class="text-lg font-medium text-gray-500">請先從列表選擇一個課室或功能室</p>
            </div>`;
          return;
        } 

        let slotsHtml = '';
        const viewMode = State.bookingViewMode || 'day';

        if (viewMode === 'week') {
            const monStr = Utils.getMonday(State.selectedDate);
            const monDate = new Date(monStr);
            const weekDates = [];
            const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
            for(let i=0; i<6; i++) {
               const d = new Date(monDate);
               d.setDate(d.getDate() + i);
               const y = d.getFullYear();
               const m = String(d.getMonth() + 1).padStart(2, '0');
               const dd = String(d.getDate()).padStart(2, '0');
               weekDates.push({ date: `${y}-${m}-${dd}`, dayName: dayNames[i] });
            }

            let tableHtml = `<div class="overflow-x-auto pb-2"><table class="w-full border-collapse text-sm min-w-[800px] table-fixed">
                <thead class="bg-gray-50 border-b border-gray-200">
                    <tr>
                       <th class="p-2 w-24 border-r border-gray-200 text-gray-600 font-bold text-center align-middle">時段</th>
                       ${weekDates.map(wd => `<th class="p-2 w-[12%] border-r border-gray-200 text-center ${wd.date === State.selectedDate ? 'bg-blue-100 text-blue-800' : 'text-gray-600'} font-bold">
                           <div class="text-[10px] font-normal">${wd.date}</div>
                           <div class="text-sm">星期${wd.dayName}</div>
                       </th>`).join('')}
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">`;

            timeSlots.forEach(slot => {
                 tableHtml += `<tr><td class="p-2 border-r border-gray-200 text-center font-bold text-gray-700 bg-gray-50 text-xs">${Utils.esc(slot.name)}</td>`;
                 weekDates.forEach(wd => {
                      const d = wd.date;
                      const isClosed = selectedRoom.closedSlots && selectedRoom.closedSlots.includes(slot.id);
                      
                      if (isClosed) {
                          const closedNotice = Utils.esc(selectedRoom.customNotices?.[slot.id] || '不開放預約');
                          tableHtml += `<td class="p-1.5 border-r border-gray-200 align-middle"><div class="bg-red-50/50 border border-red-100 h-full min-h-[64px] flex flex-col items-center justify-center text-[10px] text-red-400 rounded-lg cursor-not-allowed shadow-sm"><i class="fa-solid fa-ban text-red-300 mb-1"></i><span class="text-center font-bold leading-tight px-1 break-words line-clamp-2" title="${closedNotice}">${Utils.esc(selectedRoom.customNotices?.[slot.id] || '不開放')}</span></div></td>`;
                          return;
                      }

                      let bookedInfo = null;
                      const dayB = data.bookings.filter(b => b.roomId === selectedRoom.id && b.date === d);
                      for(let b of dayB) {
                        if (Utils.isTimeOverlap(slot.name, b.timeSlot)) { bookedInfo = b; break; }
                      }

                      if (bookedInfo) {
                          const uName = Utils.esc(bookedInfo.userName || data.users.find(u=>u.id===bookedInfo.userId)?.username || '訪客');
                          const isStudent = bookedInfo.isStudent === true || bookedInfo.isStudent === 'true';
                          const classStr = isStudent && bookedInfo.className ? `[${Utils.esc(bookedInfo.className)}] ` : '';
                          const purpStr = Utils.esc(bookedInfo.purpose || '');
                          
                          tableHtml += `<td class="p-1.5 border-r border-gray-200 align-middle">
                              <div class="bg-slate-200 border border-slate-300 rounded-lg p-2 h-full min-h-[64px] flex flex-col items-center justify-center cursor-not-allowed shadow-inner text-center">
                                 <div class="flex items-center gap-1 mb-1">
                                   <i class="fa-solid fa-lock text-slate-500 text-[10px]"></i>
                                   <span class="text-[10px] text-slate-600 font-bold leading-none">已預約</span>
                                 </div>
                                 <div class="w-full bg-white/60 rounded p-1 flex flex-col items-center justify-center shadow-sm">
                                   <div class="font-bold text-slate-800 text-[11px] leading-tight w-full break-words line-clamp-2">${classStr}${uName}</div>
                                   <div class="text-[9px] text-slate-600 leading-tight mt-0.5 w-full truncate" title="${purpStr}">${purpStr}</div>
                                 </div>
                              </div>
                          </td>`;
                      } else {
                          const slotKey = `${d}|${slot.name}`;
                          const isSelected = State.selectedSlots.includes(slotKey);
                          const btnClass = isSelected 
                              ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm transform scale-105 ring-1 ring-blue-400' 
                              : 'bg-white border-gray-200 hover:border-green-400 hover:bg-green-50 text-gray-400 hover:text-green-600 hover:shadow-sm';

                          tableHtml += `<td class="p-1.5 border-r border-gray-200 align-middle h-full">
                              <button onclick="App.Booking.toggleSlotSelection('${Utils.escAttr(slot.name)}', '${d}')" class="w-full h-full min-h-[64px] rounded-lg border transition-all flex flex-col items-center justify-center p-1 ${btnClass}">
                                 <i class="fa-regular ${isSelected ? 'fa-circle-check' : 'fa-clock'} text-sm mb-1"></i>
                                 <span class="text-[10px] font-bold">${isSelected ? '已選' : '可預約'}</span>
                              </button>
                          </td>`;
                      }
                 });
                 tableHtml += `</tr>`;
            });
            tableHtml += `</tbody></table></div>`;
            slotsHtml = tableHtml;

        } else {
            slotsHtml = `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 content-start">` + timeSlots.map(slot => {
              const isClosed = selectedRoom.closedSlots && selectedRoom.closedSlots.includes(slot.id);
              const noticeText = selectedRoom.customNotices ? Utils.esc(selectedRoom.customNotices[slot.id]) : '';

              if (isClosed) {
                 return `<div class="relative p-3 md:p-4 rounded-xl border flex flex-col items-center justify-center gap-1 bg-red-50 text-red-500 border-red-200 cursor-not-allowed shadow-inner text-center h-full">
                  <div class="flex items-center gap-1.5">
                    <i class="fa-solid fa-ban text-lg"></i>
                    <span class="font-bold text-sm">${Utils.esc(slot.name)}</span>
                  </div>
                  <div class="text-[11px] font-bold w-full truncate mt-1 bg-red-100/50 rounded px-2 py-1" title="${noticeText || '不開放預約'}">${noticeText || '不開放預約'}</div>
                </div>`;
              }

              let bookedInfo = null;
              const dayB = data.bookings.filter(b => b.roomId === selectedRoom.id && b.date === State.selectedDate);
              for(let b of dayB) {
                if (Utils.isTimeOverlap(slot.name, b.timeSlot)) { bookedInfo = b; break; }
              }
              
              const noticeIcon = noticeText ? `<div class="absolute -top-2 -right-2 bg-yellow-400 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow" title="${noticeText}"><i class="fa-solid fa-info"></i></div>` : '';

              if(bookedInfo) {
                const uName = Utils.esc(bookedInfo.userName || data.users.find(u=>u.id===bookedInfo.userId)?.username || '訪客');
                const isStudent = bookedInfo.isStudent === true || bookedInfo.isStudent === 'true';
                const classStr = isStudent && bookedInfo.className ? `[${Utils.esc(bookedInfo.className)}] ` : '';

                return `<div class="relative p-3 md:p-4 rounded-xl border text-sm font-medium flex flex-col items-center justify-center gap-1.5 bg-slate-200 text-slate-600 border-slate-300 cursor-not-allowed shadow-inner text-center overflow-hidden h-full">
                  ${noticeIcon}
                  <div class="flex items-center gap-1.5 text-slate-500">
                    <i class="fa-solid fa-lock text-sm"></i>
                    <span class="font-bold text-sm">${Utils.esc(slot.name)}</span>
                  </div>
                  <div class="w-full flex flex-col items-center justify-center bg-white/60 rounded-lg p-2 mt-1 shadow-sm">
                     <span class="font-bold text-slate-800 text-sm truncate w-full">${classStr}${uName}</span>
                     <span class="text-xs text-slate-600 truncate w-full mt-0.5" title="${Utils.esc(bookedInfo.purpose || '已被預約')}">${Utils.esc(bookedInfo.purpose || '已被預約')}</span>
                  </div>
                </div>`;
              } else {
                const slotKey = `${State.selectedDate}|${slot.name}`;
                const isSelected = State.selectedSlots.includes(slotKey);
                const btnClass = isSelected 
                  ? 'relative p-3 md:p-4 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center justify-center gap-1.5 bg-blue-50 text-blue-700 border-blue-500 shadow-md transform scale-105 h-full'
                  : 'relative p-3 md:p-4 rounded-xl border text-sm font-bold transition-all flex flex-col items-center justify-center gap-1.5 bg-white text-green-600 border-green-200 hover:bg-green-50 hover:border-green-400 hover:shadow-md cursor-pointer active:scale-95 h-full';
                
                return `<button onclick="App.Booking.toggleSlotSelection('${Utils.escAttr(slot.name)}', '${State.selectedDate}')" class="${btnClass}">
                  ${noticeIcon}
                  <div class="flex items-center gap-1.5">
                    <i class="fa-regular ${isSelected ? 'fa-circle-check' : 'fa-clock'} text-lg"></i>
                    <span class="text-center">${Utils.esc(slot.name)}</span>
                  </div>
                  <span class="text-xs mt-1 ${isSelected ? 'bg-blue-200 text-blue-800' : 'bg-green-100 text-green-700'} px-2 py-0.5 rounded font-medium w-max mx-auto">${isSelected ? '已選取' : '點擊選取'}</span>
                </button>`;
              }
            }).join('') + `</div>`;
        }
        
        if (timeSlots.length === 0) slotsHtml = `<div class="col-span-full text-center text-gray-400 p-6">後台尚未設定任何固定時間段</div>`;

        const rNumLabel = selectedRoom.roomNumber ? `<span class="text-xs font-normal text-gray-500 bg-gray-100 border border-gray-200 px-2 py-1 rounded-md">${Utils.esc(selectedRoom.roomNumber)}</span>` : '';
        const rCapLabel = selectedRoom.capacity && selectedRoom.capacity > 0 ? `<span class="text-xs font-normal text-gray-500 bg-gray-100 border border-gray-200 px-2 py-1 rounded-md"><i class="fa-solid fa-user-group mr-1"></i>上限 ${selectedRoom.capacity} 人</span>` : '';

        const multiSelectBarHtml = `
            <div class="mt-6 flex flex-col sm:flex-row justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-200 gap-4 transition-all ${State.selectedSlots.length === 0 ? 'opacity-50 grayscale select-none pointer-events-none' : ''}">
                <div class="text-blue-800 font-bold flex items-center gap-2"><i class="fa-solid fa-check-double text-xl"></i> 已選擇 ${State.selectedSlots.length} 個時段</div>
                <button onclick="App.Booking.attemptMultiModal()" class="w-full sm:w-auto bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm text-lg" ${State.selectedSlots.length === 0 ? 'disabled' : ''}>
                    預約所選時段
                </button>
            </div>
        `;

        timeContainer.innerHTML = `
          <div class="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-100 h-full flex flex-col">
            <h3 class="text-xl font-bold mb-5 text-gray-800 border-b pb-3 flex flex-wrap items-center gap-3">
               <i class="fa-solid fa-door-open text-blue-500"></i> ${Utils.esc(selectedRoom.name)} ${rNumLabel} ${rCapLabel}
            </h3>
            
            ${slotsHtml}
            
            ${multiSelectBarHtml}

            <div class="mt-8 border-t border-gray-100 pt-6">
              <div class="flex items-center justify-between mb-4">
                  <h4 class="text-base font-bold text-gray-800 flex items-center gap-2"><i class="fa-solid fa-clock-rotate-left text-blue-500"></i> 自訂連續時間段預約</h4>
                  <label class="flex items-center gap-2 cursor-pointer bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition">
                      <input type="checkbox" id="toggleCustomSlot" class="w-4 h-4 text-blue-600 rounded" onchange="App.Booking.toggleCustomSlotView()">
                      <span class="text-sm text-gray-600 font-bold">啟用</span>
                  </label>
              </div>
              <div id="customSlotContainer" class="hidden-view flex flex-wrap items-center gap-3 bg-slate-50 p-4 md:p-5 rounded-xl border border-slate-200 shadow-inner">
                <div class="flex items-center gap-2 w-full sm:w-auto">
                  <label class="text-sm font-bold text-gray-700 w-12 sm:w-auto">開始</label>
                  <input type="time" id="customStartTime" class="flex-1 sm:w-auto p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                </div>
                <span class="text-gray-400 hidden sm:inline"><i class="fa-solid fa-arrow-right"></i></span>
                <div class="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <label class="text-sm font-bold text-gray-700 w-12 sm:w-auto">結束</label>
                  <input type="time" id="customEndTime" class="flex-1 sm:w-auto p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                </div>
                <button onclick="App.Booking.handleCustomBooking()" class="w-full lg:w-auto ml-auto bg-gray-800 hover:bg-black text-white px-5 py-2.5 rounded-lg font-bold transition-colors shadow-sm mt-3 lg:mt-0 flex items-center justify-center gap-2">
                  <i class="fa-solid fa-calendar-check"></i> 自訂預約送出
                </button>
              </div>
            </div>
          </div>`;
      },
      toggleCustomSlotView: () => {
         const isChecked = document.getElementById('toggleCustomSlot').checked;
         const container = document.getElementById('customSlotContainer');
         if (isChecked) container.classList.remove('hidden-view');
         else container.classList.add('hidden-view');
      },
      toggleRecurringUI: () => {
        const type = document.getElementById('bookingType').value;
        const room = State.db.rooms.find(r => r.id === State.selectedRoomId);
        const reqAuth = room && (room.requiresAuthCode === true || room.requiresAuthCode === 'true');

        if (type === 'recurring') {
           document.getElementById('recurringUI').classList.remove('hidden-view');
           if (reqAuth) {
             document.getElementById('authCodeSection').classList.remove('hidden-view');
           } else {
             document.getElementById('authCodeSection').classList.add('hidden-view');
           }
        } else {
           document.getElementById('recurringUI').classList.add('hidden-view');
        }
      },
      toggleStudentFields: () => {
        const isStudentNode = document.querySelector('input[name="isStudent"]:checked');
        if(!isStudentNode) return;
        const isStudent = isStudentNode.value === 'true';
        const classSection = document.getElementById('studentClassSection');
        if (classSection) {
           if (isStudent) classSection.classList.remove('hidden-view');
           else classSection.classList.add('hidden-view');
        }
      },
      populateClassSelect: () => {
        const sel = document.getElementById('bookingClassName');
        if(!sel) return;
        const classes = Utils.getSortedClasses();
        if (classes.length === 0) {
           sel.innerHTML = '<option value="">(無可用班級)</option>';
        } else {
           sel.innerHTML = classes.map(c => `<option value="${Utils.esc(c.name)}">${Utils.esc(c.name)}</option>`).join('');
        }
      },
      attemptMultiModal: () => {
         if (State.selectedSlots.length === 0) return;
         State.bookingModalSlots = [...State.selectedSlots];
         
         const selectedRoom = State.db.rooms.find(r => r.id === State.selectedRoomId);
         let noticeMessages = new Set();

         State.bookingModalSlots.forEach(slotKey => {
             const slotName = slotKey.split('|')[1];
             const tsObj = State.db.timeSlots.find(t => t.name === slotName);
             if (tsObj && selectedRoom && selectedRoom.customNotices && selectedRoom.customNotices[tsObj.id]) {
                 noticeMessages.add(selectedRoom.customNotices[tsObj.id]);
             }
         });

         if (noticeMessages.size > 0) {
            const noticesStr = Array.from(noticeMessages).join('\n');
            Utils.customConfirm(`【所選時段特別提示】\n\n${noticesStr}\n\n確定要繼續預約這些時段嗎？`, () => {
                Booking.openModal();
            });
            return;
         }
         Booking.openModal();
      },
      handleCustomBooking: () => {
        const start = document.getElementById('customStartTime').value;
        const end = document.getElementById('customEndTime').value;
        if(!start || !end) return Utils.showToast("請選擇完整的開始與結束時間", true);
        if(start >= end) return Utils.showToast("結束時間必須大於開始時間", true);
        
        const slotName = `${start}-${end}`;
        
        const isHoliday = Utils.getSortedHolidays().find(h => {
          const startD = Utils.formatLocalDate(h.startDate || h.date);
          const endD = Utils.formatLocalDate(h.endDate || h.date || startD);
          return State.selectedDate >= startD && State.selectedDate <= endD;
        });
        if (isHoliday && !(isHoliday.allowBooking === true || isHoliday.allowBooking === 'true')) {
           return Utils.showToast("此日期為不可預約的假期！", true);
        }
        
        const selectedRoom = State.db.rooms.find(r => r.id === State.selectedRoomId);
        if (Utils.isSlotClosed(slotName, selectedRoom, State.db.timeSlots)) {
           return Utils.showToast("此自訂時間段包含了不開放預約的時段！", true);
        }
        if (Utils.checkOverlap(slotName, State.selectedRoomId, State.selectedDate)) {
           return Utils.showToast("此自訂時段與已有預約重疊，無法預約！", true);
        }
        
        State.bookingModalSlots = [`${State.selectedDate}|${slotName}`];
        Booking.openModal();
      },
      openModal: () => {
        if(State.bookingModalSlots.length === 0) return;
        const room = State.db.rooms.find(r => r.id === State.selectedRoomId);
        const rNum = room.roomNumber ? `(${room.roomNumber})` : '';
        
        const uniqueDates = [...new Set(State.bookingModalSlots.map(k => k.split('|')[0]))].sort();
        const uniqueSlots = [...new Set(State.bookingModalSlots.map(k => k.split('|')[1]))].sort();
        
        const dateStr = uniqueDates.length > 1 ? `${uniqueDates[0]} (等多個日期)` : uniqueDates[0];
        const slotStr = uniqueSlots.length > 1 ? `${uniqueSlots[0]} (等 ${uniqueSlots.length} 個時段)` : uniqueSlots.join(', ');
        
        document.getElementById('modalBookingInfo').innerHTML = `
          <p class="flex justify-between items-center border-b border-gray-200 pb-2 mb-2"><span class="text-gray-500">起始預約日期</span> <span class="font-bold text-base text-blue-700">${dateStr}</span></p>
          <p class="flex justify-between items-center border-b border-gray-200 pb-2 mb-2"><span class="text-gray-500">選擇時段</span> <span class="font-bold text-base text-blue-700 max-w-[200px] text-right truncate" title="${Utils.esc(uniqueSlots.join(', '))}">${Utils.esc(slotStr)}</span></p>
          <p class="flex justify-between items-center"><span class="text-gray-500">課室名稱</span> <span class="font-bold text-base">${Utils.esc(room.name)} <span class="text-sm font-normal text-gray-500">${Utils.esc(rNum)}</span></span></p>
        `;
        
        document.getElementById('bookingType').value = 'single';
        Booking.toggleRecurringUI();
        
        const selDateObj = new Date(uniqueDates[0]);
        const dayOfWeek = selDateObj.getDay();
        document.querySelectorAll('.recurring-day-cb').forEach(cb => {
           cb.checked = (parseInt(cb.value) === dayOfWeek);
        });
        document.getElementById('recurringEndDate').value = '';

        document.querySelector('input[name="isStudent"][value="false"]').checked = true;
        Booking.toggleStudentFields();
        Booking.populateClassSelect();

        document.getElementById('bookingUserName').value = '';
        document.getElementById('bookingPurpose').value = '';
        document.getElementById('bookingParticipants').value = '';
        document.getElementById('bookingAuthCode').value = '';
        document.getElementById('bookingCancelCode').value = '';
        document.getElementById('bookingModal').classList.remove('hidden-view');
      },
      closeModal: () => { document.getElementById('bookingModal').classList.add('hidden-view'); },
      confirm: () => {
        const userName = document.getElementById('bookingUserName').value.trim();
        const purpose = document.getElementById('bookingPurpose').value.trim();
        const participantsStr = document.getElementById('bookingParticipants').value;
        const participants = parseInt(participantsStr) || 0;
        //const cancelCode = document.getElementById('bookingCancelCode').value.trim();
        const cancelCodeInput = document.getElementById('bookingCancelCode');
        const cancelCodeRaw = cancelCodeInput ? cancelCodeInput.value.trim() : '';
            
        const isStudent = document.querySelector('input[name="isStudent"]:checked').value === 'true';
        const className = isStudent ? document.getElementById('bookingClassName').value : '';

        const room = State.db.rooms.find(r => r.id === State.selectedRoomId);
        const isRecurring = document.getElementById('bookingType').value === 'recurring';
        const reqAuth = room && (room.requiresAuthCode === true || room.requiresAuthCode === 'true');
        let authCodeValue = '';

        if(isStudent && !className) return Utils.showToast("請選擇班級", true);
        if(!userName) return Utils.showToast("請填寫預約人姓名", true);
        if(participants <= 0) return Utils.showToast("請填寫有效的預約人數", true);
        
        if(room.capacity && room.capacity > 0 && participants > room.capacity) {
           return Utils.showToast(`人數超過課室上限 (${room.capacity}人)`, true);
        }

        if(!purpose) return Utils.showToast("請填寫預約用途", true);

        // 取消密碼為選填；留空時由伺服器產生一組 4 位數並回傳
        if (cancelCodeRaw && !/^\d{4}$/.test(cancelCodeRaw)) {
          return Utils.showToast("請設定 4 位數字的取消預約碼", true);
        }
        
        if (isRecurring && reqAuth) {
           authCodeValue = document.getElementById('bookingAuthCode').value.trim();
           // 授權碼是否有效由後端判斷，前端只確認有填寫
           if (!authCodeValue) return Utils.showToast("此課室的連續預約必須提供授權碼", true);
        }
        
        let targetBookings = [];

        if (!isRecurring) {
          targetBookings = State.bookingModalSlots.map(k => {
             const [d, s] = k.split('|');
             return { date: d, slot: s };
          });
        } else {
          const uniqueDates = [...new Set(State.bookingModalSlots.map(k => k.split('|')[0]))].sort();
          const baseDate = uniqueDates[0];
          
          const endDate = document.getElementById('recurringEndDate').value;
          if (!endDate || endDate < baseDate) return Utils.showToast("結束日期無效", true);
          const selectedDays = Array.from(document.querySelectorAll('.recurring-day-cb:checked')).map(cb => parseInt(cb.value));
          if (selectedDays.length === 0) return Utils.showToast("請選擇至少一個重複的星期", true);

          let curr = new Date(baseDate);
          const limit = new Date(endDate);
          const datesToBook = [];
          while (curr <= limit) {
             if (selectedDays.includes(curr.getDay())) {
                const y = curr.getFullYear();
                const m = String(curr.getMonth()+1).padStart(2, '0');
                const d = String(curr.getDate()).padStart(2, '0');
                datesToBook.push(`${y}-${m}-${d}`);
             }
             curr.setDate(curr.getDate() + 1);
          }
          
          if (datesToBook.length === 0) return Utils.showToast("選擇的區間內沒有符合的日期", true);

          const uniqueSlots = [...new Set(State.bookingModalSlots.map(k => k.split('|')[1]))];
          datesToBook.forEach(d => {
             uniqueSlots.forEach(s => {
                targetBookings.push({ date: d, slot: s });
             });
          });
        }

        let validBookings = [];
        let conflictCount = 0;

        for (const tb of targetBookings) {
          const isHoliday = Utils.getSortedHolidays().find(h => {
            const start = Utils.formatLocalDate(h.startDate || h.date);
            const end = Utils.formatLocalDate(h.endDate || h.date || start);
            return tb.date >= start && tb.date <= end;
          });
          if (isHoliday && !(isHoliday.allowBooking === true || isHoliday.allowBooking === 'true')) {
             conflictCount++; continue;
          }
          
          if (Utils.isSlotClosed(tb.slot, room, State.db.timeSlots)) {
             conflictCount++; continue;
          }
          if (Utils.checkOverlap(tb.slot, State.selectedRoomId, tb.date)) {
             conflictCount++; continue;
          }
          const exact = State.db.bookings.find(b => b.roomId === State.selectedRoomId && b.date === tb.date && b.timeSlot === tb.slot);
          if (exact) {
             conflictCount++; continue;
          }
          validBookings.push(tb);
        }

        if (validBookings.length === 0) {
          return Utils.showToast("所選日期皆無法預約 (時段衝突、假期或不開放)", true);
        }

        const totalNewBookings = validBookings.length;

        if (conflictCount > 0) {
          Utils.customConfirm(`有 ${conflictCount} 筆因時段衝突、假期或不開放無法預約。\n剩餘 ${validBookings.length} 筆可正常預約 (共產生 ${totalNewBookings} 筆預約記錄)，確定要送出嗎？`, () => {
              Booking.execute(validBookings, isRecurring, userName, purpose, isStudent, className, participants, authCodeValue, cancelCodeRaw);
          });
          return;
        }
        
        Booking.execute(validBookings, isRecurring, userName, purpose, isStudent, className, participants, authCodeValue, cancelCodeRaw);
      },
      /**
       * 送出預約。所有規則（假期、關閉時段、重疊、人數上限、授權碼）
       * 都會在 PHP 端重新驗證一次，前端的檢查只是為了即時提示。
       */
      execute: async (validBookings, isRecurring, userName, purpose, isStudent, className, participants, authCode, cancelCode) => {
        const btn = document.getElementById('confirmBookingBtn');
        btn.disabled = true;
        Utils.showLoading(true, "預約資料寫入中，請稍候...");

        try {
          const res = await API.request('createBookings', {
            roomId: State.selectedRoomId,
            slots: validBookings.map(tb => ({ date: tb.date, slot: tb.slot })),
            userName, purpose, participants, isStudent, className,
            cancelCode, authCode,
            isRecurring: !!isRecurring,
            userId: State.systemUser ? State.systemUser.id : State.guestId
          });

          API.updateLocalData('bookings', res.bookings || []);
          Booking.closeModal();
          State.selectedSlots = [];

          let msg = `🎉成功預約 ${(res.bookings || []).length} 筆時段！\n 取消密碼：${res.cancelCode} \n請務必記下此密碼，以便日後取消或修改預約。`;
          if (res.skipped > 0) msg += `\n\n(另有 ${res.skipped} 筆因時段衝突、假期或不開放而未建立)`;
          Utils.customConfirm(msg, () => { Nav.renderActiveScreen(); });
        } catch (e) {
          Utils.showToast("預約失敗: " + e.message, true);
          console.error(e);
        } finally {
          Utils.showLoading(false);
          btn.disabled = false;
        }
      }
    };
