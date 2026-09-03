<?php
declare(strict_types=1);

/**
 * 一鍵建立資料表與初始資料。
 *
 *   php database/install.php            # 建立資料表 + 匯入示範資料
 *   php database/install.php --no-seed  # 只建立資料表
 *   php database/install.php --force    # 先刪除既有資料表再重建（會清空資料！）
 *
 * 連線設定取自 config/config.php 或環境變數，詳見 README。
 */

require_once dirname(__DIR__) . '/src/bootstrap.php';

use App\Config;

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("此腳本只能在命令列執行。\n");
}

$args    = array_slice($argv, 1);
$noSeed  = in_array('--no-seed', $args, true);
$force   = in_array('--force', $args, true);

$db  = Config::all()['db'];
$dsn = sprintf('mysql:host=%s;port=%d;charset=%s', $db['host'], $db['port'], $db['charset'] ?? 'utf8mb4');

try {
    $pdo = new PDO($dsn, $db['user'], $db['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (PDOException $e) {
    exit("無法連線至 MySQL：{$e->getMessage()}\n");
}

$name = $db['name'];
echo "→ 連線成功（{$db['host']}:{$db['port']}）\n";

$pdo->exec("CREATE DATABASE IF NOT EXISTS `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$pdo->exec("USE `{$name}`");
echo "→ 資料庫 `{$name}` 就緒\n";

if ($force) {
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach (['bookings', 'auth_codes', 'users', 'settings', 'holidays', 'classes', 'time_slots', 'rooms'] as $table) {
        $pdo->exec("DROP TABLE IF EXISTS `{$table}`");
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    echo "→ 已刪除既有資料表 (--force)\n";
}

runSqlFile($pdo, __DIR__ . '/schema.sql');
echo "→ 資料表建立完成\n";

if (!$noSeed) {
    runSqlFile($pdo, __DIR__ . '/seed.sql');
    echo "→ 初始資料匯入完成（帳號 admin / 密碼 admin123）\n";
    echo "  ⚠ 請立即登入後台修改預設密碼。\n";
}

echo "完成。\n";

/** 逐段執行 SQL 檔（本專案的 SQL 不含預存程序，以分號切分即可） */
function runSqlFile(PDO $pdo, string $path): void
{
    $sql = file_get_contents($path);
    if ($sql === false) {
        exit("讀取失敗：{$path}\n");
    }
    // 移除整行註解，避免切分時誤判
    $sql = preg_replace('/^\s*--.*$/m', '', $sql) ?? $sql;
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
        $pdo->exec($statement);
    }
}
