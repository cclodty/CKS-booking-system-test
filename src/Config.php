<?php
declare(strict_types=1);

namespace App;

/**
 * 讀取設定：環境變數優先，其次 config/config.php，最後 config/config.example.php。
 */
final class Config
{
    private static ?array $data = null;

    public static function all(): array
    {
        if (self::$data !== null) {
            return self::$data;
        }

        $root = dirname(__DIR__);
        self::loadDotEnv($root . '/.env');

        $file = is_file($root . '/config/config.php')
            ? $root . '/config/config.php'
            : $root . '/config/config.example.php';
        $conf = require $file;

        $env = static fn(string $key, $default) => getenv($key) !== false && getenv($key) !== ''
            ? getenv($key)
            : $default;

        $conf['db']['host'] = (string) $env('DB_HOST', $conf['db']['host']);
        $conf['db']['port'] = (int) $env('DB_PORT', $conf['db']['port']);
        $conf['db']['name'] = (string) $env('DB_NAME', $conf['db']['name']);
        $conf['db']['user'] = (string) $env('DB_USER', $conf['db']['user']);
        $conf['db']['pass'] = (string) $env('DB_PASS', $conf['db']['pass']);
        $conf['timezone']   = (string) $env('APP_TIMEZONE', $conf['timezone'] ?? 'Asia/Hong_Kong');

        self::$data = $conf;
        return self::$data;
    }

    public static function get(string $key, $default = null)
    {
        $conf = self::all();
        return $conf[$key] ?? $default;
    }

    /** 極簡 .env 解析，只支援 KEY=VALUE 與 # 註解 */
    private static function loadDotEnv(string $path): void
    {
        if (!is_readable($path)) {
            return;
        }
        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim(trim($value), "\"'");
            if (getenv($key) === false) {
                putenv("$key=$value");
            }
        }
    }
}
