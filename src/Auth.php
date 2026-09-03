<?php
declare(strict_types=1);

namespace App;

/**
 * 以 PHP Session 取代原本「把使用者物件存在 localStorage 就算登入」的做法。
 *
 * 前端沿用原本流程：密碼先在瀏覽器以 SHA-256 雜湊後才送出，
 * 伺服器再以 password_hash()/password_verify() 保存與驗證，
 * 因此資料庫外洩時也拿不到可直接重放的憑證。
 */
final class Auth
{
    public const SESSION_KEY = 'booking_admin';

    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        session_set_cookie_params([
            'httponly' => true,
            'samesite' => 'Lax',
            'secure'   => (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off'),
        ]);
        session_start();
    }

    public static function user(): ?array
    {
        self::start();
        return $_SESSION[self::SESSION_KEY] ?? null;
    }

    public static function isLoggedIn(): bool
    {
        return self::user() !== null;
    }

    public static function isSuperAdmin(): bool
    {
        $u = self::user();
        return $u !== null && ($u['role'] ?? '') === 'superadmin';
    }

    public static function login(array $user): void
    {
        self::start();
        session_regenerate_id(true);
        unset($user['password']);
        $_SESSION[self::SESSION_KEY] = $user;
    }

    public static function refresh(array $user): void
    {
        self::start();
        unset($user['password']);
        $_SESSION[self::SESSION_KEY] = $user;
    }

    public static function logout(): void
    {
        self::start();
        unset($_SESSION[self::SESSION_KEY]);
        session_regenerate_id(true);
    }

    /** 判斷登入者是否有權管理指定課室 */
    public static function canManageRoom(?string $roomId): bool
    {
        $u = self::user();
        if ($u === null) {
            return false;
        }
        if (($u['role'] ?? '') === 'superadmin') {
            return true;
        }
        if ($roomId === null || $roomId === '') {
            return false;
        }
        return in_array($roomId, $u['managedRooms'] ?? [], true);
    }

    /** 儲存密碼：前端傳來的是 SHA-256 十六進位字串，這裡再包一層 bcrypt */
    public static function hashClientPassword(string $clientHash): string
    {
        return password_hash($clientHash, PASSWORD_DEFAULT);
    }

    /**
     * 驗證密碼，同時相容舊資料（資料庫直接存 SHA-256 明文雜湊）。
     * @return bool|string 驗證成功時回傳 true，若需要升級雜湊則回傳新的 hash 字串
     */
    public static function verifyClientPassword(string $clientHash, string $stored): bool|string
    {
        if ($stored === '') {
            return false;
        }
        if (str_starts_with($stored, '$2y$') || str_starts_with($stored, '$argon2')) {
            return password_verify($clientHash, $stored);
        }
        // 舊格式：直接比對 SHA-256，成功後回傳新雜湊供呼叫端升級
        if (hash_equals(strtolower($stored), strtolower($clientHash))) {
            return self::hashClientPassword($clientHash);
        }
        return false;
    }
}
