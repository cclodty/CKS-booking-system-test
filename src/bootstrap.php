<?php
declare(strict_types=1);

/**
 * 極簡 PSR-4 自動載入（App\ => src/），不需要 Composer。
 */
spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = __DIR__ . '/' . $relative . '.php';
    if (is_file($file)) {
        require_once $file;
    }
});

date_default_timezone_set(App\Config::get('timezone', 'Asia/Hong_Kong'));
