-- ---------------------------------------------------------------------------
-- 初始示範資料：一組超級管理員 + 基本課室 / 時段 / 班級 / 列印設定
--
-- 預設帳號：admin  密碼：admin123
-- password_hash 這裡先放前端 SHA-256 的舊格式；第一次登入成功後
-- 系統會自動改存成 bcrypt。請務必於上線前登入後台修改密碼。
-- ---------------------------------------------------------------------------
SET NAMES utf8mb4;

INSERT INTO users (id, username, display_name, password_hash, role, managed_rooms) VALUES
  ('admin', 'admin', '系統管理員',
   '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
   'superadmin', '[]')
ON DUPLICATE KEY UPDATE username = VALUES(username);

INSERT INTO time_slots (id, name, sort_order) VALUES
  ('ts_1', '08:00-09:00', 1),
  ('ts_2', '09:00-10:00', 2),
  ('ts_3', '10:20-11:20', 3),
  ('ts_4', '11:20-12:20', 4),
  ('ts_5', '13:30-14:30', 5),
  ('ts_6', '14:30-15:30', 6),
  ('ts_7', '15:45-16:45', 7)
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order);

INSERT INTO rooms (id, name, room_number, type, sort_order, capacity, requires_auth_code, custom_notices, closed_slots) VALUES
  ('rm_1', '1A 課室',  '101', '課室',   1, 40, 0, '{}', '[]'),
  ('rm_2', '1B 課室',  '102', '課室',   2, 40, 0, '{}', '[]'),
  ('rm_3', '電腦室',    '201', '功能室', 3, 30, 0, '{}', '[]'),
  ('rm_4', '禮堂',      'H1',  '功能室', 4, 300, 1, '{}', '[]')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO classes (id, name, sort_order) VALUES
  ('c_1', '1A', 1), ('c_2', '1B', 2), ('c_3', '2A', 3), ('c_4', '2B', 4)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO settings (id, setting_key, setting_value) VALUES
  ('s1', 'print_show_name',          'true'),
  ('o1', 'print_order_name',         '1'),
  ('s2', 'print_show_class',         'true'),
  ('o2', 'print_order_class',        '2'),
  ('s4', 'print_show_participants',  'true'),
  ('o4', 'print_order_participants', '3'),
  ('s3', 'print_show_purpose',       'true'),
  ('o3', 'print_order_purpose',      '4')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
