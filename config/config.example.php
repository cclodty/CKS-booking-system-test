<?php
/**
 * 系統設定範本。
 *
 * 請複製本檔案為 config/config.php 後修改，或改用環境變數
 * (DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASS / APP_TIMEZONE)。
 * config/config.php 已列入 .gitignore，不會被提交進版本庫。
 */
return [
    'db' => [
        'host'    => 'localhost',
        'port'    => 3306,
        'name'    => 'booking_system',
        'user'    => 'booking',
        'pass'    => 'booking',
        'charset' => 'utf8mb4',
    ],
    // 系統時區，影響「今天」的判斷與建立時間顯示
    'timezone' => 'Asia/Hong_Kong',
    // 允許跨網域呼叫 API 的來源；留空代表只允許同網域
    'allowed_origins' => [],
];
