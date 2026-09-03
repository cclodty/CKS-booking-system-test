// 匯入所有模組並掛到 window，讓 HTML 內的 onclick 可以呼叫
import { Constants } from './constants.js';
import { State } from './state.js';
import { Utils } from './utils.js';
import { API } from './api.js';
import { Auth } from './auth.js';
import { Nav } from './nav.js';
import { Booking } from './booking.js';
import { MyBookings } from './my_bookings.js';
import { Print } from './print.js';
import { Admin } from './admin.js';

const modules = { Constants, State, Utils, API, Auth, Nav, Booking, MyBookings, Print, Admin };
window.App = modules;
// 相容舊版樣板中未加 App. 前綴的行內事件
Object.assign(window, modules);

document.addEventListener('DOMContentLoaded', async () => {
  const todayStr = new Date().toISOString().split('T')[0];

  const dateInput = document.getElementById('bookingDateInput');
  if (dateInput) {
    dateInput.min = todayStr;
    dateInput.value = State.selectedDate;
  }

  const printDateInput = document.getElementById('printDateInput');
  if (printDateInput) printDateInput.value = Utils.getMonday(State.selectedDate);

  // getData 會一併回傳目前 Session 的登入者與其可見的資料
  await API.loadInitialData();
  if (State.systemUser) Auth.applyUser(State.systemUser, false);

  Nav.switchTab(State.activeTab);
});
