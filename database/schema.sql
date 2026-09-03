-- ---------------------------------------------------------------------------
-- 課室 / 功能室預約系統  資料庫結構 (MySQL 5.7+ / MariaDB 10.3+)
-- ---------------------------------------------------------------------------
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS rooms (
  id                 VARCHAR(64)  NOT NULL,
  name               VARCHAR(120) NOT NULL,
  room_number        VARCHAR(60)      NULL DEFAULT '',
  type               VARCHAR(40)  NOT NULL DEFAULT '課室',
  sort_order         INT          NOT NULL DEFAULT 0,
  capacity           INT          NOT NULL DEFAULT 0,
  requires_auth_code TINYINT(1)   NOT NULL DEFAULT 0,
  custom_notices     LONGTEXT         NULL,   -- JSON: { timeSlotId: "提示文字" }
  closed_slots       LONGTEXT         NULL,   -- JSON: [ timeSlotId, ... ]
  PRIMARY KEY (id),
  KEY idx_rooms_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS time_slots (
  id         VARCHAR(64)  NOT NULL,
  name       VARCHAR(120) NOT NULL,   -- 例如 08:00-09:00
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_time_slots_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS classes (
  id         VARCHAR(64)  NOT NULL,
  name       VARCHAR(120) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_classes_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS holidays (
  id            VARCHAR(64)  NOT NULL,
  start_date    DATE             NULL,
  end_date      DATE             NULL,
  description   VARCHAR(255) NOT NULL DEFAULT '',
  sort_order    INT          NOT NULL DEFAULT 0,
  allow_booking TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_holidays_range (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  id            VARCHAR(64)  NOT NULL,
  setting_key   VARCHAR(120) NOT NULL,
  setting_value TEXT             NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(64)  NOT NULL,
  username      VARCHAR(120) NOT NULL,
  display_name  VARCHAR(120)     NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,          -- bcrypt(前端送出的 SHA-256)
  role          VARCHAR(20)  NOT NULL DEFAULT 'admin',  -- admin | superadmin
  managed_rooms LONGTEXT         NULL,          -- JSON: [ roomId, ... ]
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_codes (
  id         VARCHAR(64) NOT NULL,
  code       VARCHAR(32) NOT NULL,
  is_used    TINYINT(1)  NOT NULL DEFAULT 0,
  created_by VARCHAR(120)    NULL DEFAULT '',
  created_at BIGINT      NOT NULL DEFAULT 0,    -- 毫秒 timestamp
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_codes_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id           VARCHAR(64)  NOT NULL,
  room_id      VARCHAR(64)  NOT NULL,
  booking_date DATE         NOT NULL,
  time_slot    VARCHAR(120) NOT NULL,
  user_id      VARCHAR(64)      NULL DEFAULT '',
  user_name    VARCHAR(120) NOT NULL DEFAULT '',
  purpose      VARCHAR(500) NOT NULL DEFAULT '',
  participants INT          NOT NULL DEFAULT 0,
  is_student   TINYINT(1)   NOT NULL DEFAULT 0,
  class_name   VARCHAR(120)     NULL DEFAULT '',
  is_locked    TINYINT(1)   NOT NULL DEFAULT 0,
  cancel_code  VARCHAR(16)      NULL DEFAULT '',
  created_at   BIGINT       NOT NULL DEFAULT 0, -- 毫秒 timestamp
  PRIMARY KEY (id),
  KEY idx_bookings_room_date (room_id, booking_date),
  KEY idx_bookings_date (booking_date),
  KEY idx_bookings_user_name (user_name),
  CONSTRAINT fk_bookings_room FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
