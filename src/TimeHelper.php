<?php
declare(strict_types=1);

namespace App;

use DateTimeImmutable;

/**
 * 時段字串處理，與前端 js/utils.js 的 isTimeOverlap 邏輯保持一致。
 * 時段格式為 "08:00-09:00"，也可能是自訂名稱（例如「第一節」）。
 */
final class TimeHelper
{
    public static function parseMinutes(string $value): ?int
    {
        if (preg_match('/(\d{1,2}):(\d{2})/', $value, $m)) {
            return ((int) $m[1]) * 60 + (int) $m[2];
        }
        return null;
    }

    /** @return array{0:int,1:int}|null */
    public static function range(string $slot): ?array
    {
        $parts = explode('-', $slot);
        if (count($parts) !== 2) {
            return null;
        }
        $start = self::parseMinutes($parts[0]);
        $end   = self::parseMinutes($parts[1]);
        if ($start === null || $end === null || $start >= $end) {
            return null;
        }
        return [$start, $end];
    }

    /** 兩個時段是否重疊；無法解析時退回字串比對（與前端一致） */
    public static function overlaps(string $slotA, string $slotB): bool
    {
        $a = self::range($slotA);
        $b = self::range($slotB);
        if ($a === null || $b === null) {
            return $slotA === $slotB;
        }
        return $a[0] < $b[1] && $a[1] > $b[0];
    }

    public static function isValidDate(string $date): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return false;
        }

        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        $errors = DateTimeImmutable::getLastErrors();

        // getLastErrors() returns false when parsing completed without warnings.
        return $parsed !== false
            && $parsed->format('Y-m-d') === $date
            && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0));
    }
}
