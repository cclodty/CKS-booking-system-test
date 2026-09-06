/**
 * 無需 PHP / MySQL 的瀏覽器示範資料層。
 * 加上 ?demo=1 時，所有變更只保存在目前瀏覽器的 localStorage。
 */
const pad = value => String(value).padStart(2, '0');

const dateFromToday = offset => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const initialData = () => ({
  rooms: [
    { id: 'rm_1', name: '1A 課室', roomNumber: '101', type: '課室', order: 1, capacity: 40, requiresAuthCode: false, customNotices: {}, closedSlots: [] },
    { id: 'rm_2', name: '1B 課室', roomNumber: '102', type: '課室', order: 2, capacity: 40, requiresAuthCode: false, customNotices: {}, closedSlots: [] },
    { id: 'rm_3', name: '電腦室', roomNumber: '201', type: '功能室', order: 3, capacity: 30, requiresAuthCode: false, customNotices: { ts_7: '放學後保養' }, closedSlots: ['ts_7'] },
    { id: 'rm_4', name: '禮堂', roomNumber: 'H1', type: '功能室', order: 4, capacity: 300, requiresAuthCode: true, customNotices: {}, closedSlots: [] }
  ],
  timeSlots: [
    { id: 'ts_1', name: '08:00-09:00', order: 1 }, { id: 'ts_2', name: '09:00-10:00', order: 2 },
    { id: 'ts_3', name: '10:20-11:20', order: 3 }, { id: 'ts_4', name: '11:20-12:20', order: 4 },
    { id: 'ts_5', name: '13:30-14:30', order: 5 }, { id: 'ts_6', name: '14:30-15:30', order: 6 },
    { id: 'ts_7', name: '15:45-16:45', order: 7 }
  ],
  classes: ['1A', '1B', '2A', '2B'].map((name, index) => ({ id: `c_${index + 1}`, name, order: index + 1 })),
  holidays: [],
  bookings: [
    { id: 'demo_b1', roomId: 'rm_1', date: dateFromToday(0), timeSlot: '09:00-10:00', userId: 'demo_guest', userName: '陳老師', purpose: '班務會議', participants: 8, isStudent: false, className: '', isLocked: false, createdAt: Date.now() },
    { id: 'demo_b2', roomId: 'rm_3', date: dateFromToday(1), timeSlot: '10:20-11:20', userId: 'demo_guest', userName: '李同學', purpose: '專題製作', participants: 4, isStudent: true, className: '2A', isLocked: false, createdAt: Date.now() }
  ],
  authCodes: [{ id: 'demo_code', code: 'DEMO2026', description: '禮堂示範授權碼' }],
  settings: [
    ['s1', 'print_show_name', 'true'], ['o1', 'print_order_name', '1'],
    ['s2', 'print_show_class', 'true'], ['o2', 'print_order_class', '2'],
    ['s4', 'print_show_participants', 'true'], ['o4', 'print_order_participants', '3'],
    ['s3', 'print_show_purpose', 'true'], ['o3', 'print_order_purpose', '4']
  ].map(([id, settingKey, settingValue]) => ({ id, settingKey, settingValue })),
  users: []
});

const STORAGE_KEY = 'booking_system_demo_v1';
const ADMIN = { id: 'demo_admin', username: 'demo', name: '示範管理員', role: 'superadmin', managedRooms: [] };

const readData = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || initialData();
  } catch (error) {
    return initialData();
  }
};

const writeData = data => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

export const Demo = {
  enabled: new URLSearchParams(window.location.search).get('demo') === '1' || window.location.protocol === 'file:',
  allowFallback: new URLSearchParams(window.location.search).get('live') !== '1',

  activate: () => {
    Demo.enabled = true;
  },

  request: async (action, payload = {}) => {
    const data = readData();

    if (action === 'getData') return { success: true, data, user: null };
    if (action === 'login') {
      if (payload.username !== 'demo') throw new Error('示範帳號是 demo（密碼可任意填寫）');
      return { success: true, user: ADMIN, adminData: { users: [ADMIN], authCodes: data.authCodes } };
    }
    if (action === 'logout') return { success: true };
    if (action === 'createBookings') {
      const created = (payload.slots || []).map((item, index) => ({
        ...payload,
        id: `demo_${Date.now()}_${index}`,
        date: item.date,
        timeSlot: item.slot,
        isLocked: false,
        createdAt: Date.now()
      }));
      data.bookings.push(...created);
      writeData(data);
      return { success: true, bookings: created, cancelCode: payload.cancelCode, skipped: 0 };
    }
    if (action === 'cancelBooking') {
      data.bookings = data.bookings.filter(item => item.id !== payload.id);
      writeData(data);
      return { success: true };
    }
    if (action === 'saveRow') {
      const items = Array.isArray(payload.data) ? payload.data : [payload.data];
      if (!data[payload.table]) data[payload.table] = [];
      const saved = items.map((item, index) => ({ ...item, id: item.id || `demo_${Date.now()}_${index}` }));
      saved.forEach(item => {
        const existing = data[payload.table].findIndex(row => row.id === item.id);
        if (existing >= 0) data[payload.table][existing] = { ...data[payload.table][existing], ...item };
        else data[payload.table].push(item);
      });
      writeData(data);
      return { success: true, data: Array.isArray(payload.data) ? saved : saved[0] };
    }
    if (action === 'deleteRow') {
      const ids = Array.isArray(payload.id) ? payload.id : [payload.id];
      data[payload.table] = (data[payload.table] || []).filter(item => !ids.includes(item.id));
      writeData(data);
      return { success: true };
    }

    throw new Error(`示範模式暫不支援 ${action}`);
  },

  reset: () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }
};
