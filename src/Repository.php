<?php
declare(strict_types=1);

namespace App;

use InvalidArgumentException;
use PDO;

/**
 * 以 Schema::MAP 為基礎的通用資料存取層，
 * 對前端維持與原本 Firestore 版本完全一致的 JSON 結構。
 */
final class Repository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** 讀取整張表並轉成前端格式 */
    public function all(string $collection): array
    {
        $meta = Schema::assertCollection($collection);
        $rows = $this->pdo->query("SELECT * FROM `{$meta['table']}`")->fetchAll();
        return array_map(fn(array $row) => $this->toJson($collection, $row), $rows);
    }

    public function find(string $collection, string $id): ?array
    {
        $meta = Schema::assertCollection($collection);
        $stmt = $this->pdo->prepare("SELECT * FROM `{$meta['table']}` WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ? $this->toJson($collection, $row) : null;
    }

    public function findBy(string $collection, string $jsonField, $value): ?array
    {
        $meta = Schema::assertCollection($collection);
        if (!isset($meta['fields'][$jsonField])) {
            throw new InvalidArgumentException("未知欄位：{$jsonField}");
        }
        $col = $meta['fields'][$jsonField][0];
        $stmt = $this->pdo->prepare("SELECT * FROM `{$meta['table']}` WHERE `{$col}` = ? LIMIT 1");
        $stmt->execute([$value]);
        $row = $stmt->fetch();
        return $row ? $this->toJson($collection, $row) : null;
    }

    /**
     * 新增或更新（等同原本 Firestore 的 set({merge:true})）：
     * 只更新 payload 中有出現的欄位，其餘保持原值。
     */
    public function save(string $collection, array $item): array
    {
        $meta = Schema::assertCollection($collection);
        $id = isset($item['id']) ? (string) $item['id'] : '';
        if ($id === '') {
            throw new InvalidArgumentException('資料缺少 id 欄位');
        }

        $columns = [];
        foreach ($meta['fields'] as $jsonKey => [$col, $type]) {
            if ($jsonKey === 'id' || !array_key_exists($jsonKey, $item)) {
                continue;
            }
            $columns[$col] = $this->toColumn($type, $item[$jsonKey]);
        }

        $exists = $this->exists($meta['table'], $id);

        if ($exists && $columns !== []) {
            $sets = implode(', ', array_map(fn($c) => "`{$c}` = ?", array_keys($columns)));
            $stmt = $this->pdo->prepare("UPDATE `{$meta['table']}` SET {$sets} WHERE id = ?");
            $stmt->execute([...array_values($columns), $id]);
        } elseif (!$exists) {
            $columns['id'] = $id;
            $cols = implode(', ', array_map(fn($c) => "`{$c}`", array_keys($columns)));
            $placeholders = implode(', ', array_fill(0, count($columns), '?'));
            $stmt = $this->pdo->prepare("INSERT INTO `{$meta['table']}` ({$cols}) VALUES ({$placeholders})");
            $stmt->execute(array_values($columns));
        }

        return $this->find($collection, $id) ?? $item;
    }

    /** @param string[]|string $ids */
    public function delete(string $collection, array|string $ids): int
    {
        $meta = Schema::assertCollection($collection);
        $ids = array_values(array_filter(array_map('strval', (array) $ids), fn($v) => $v !== ''));
        if ($ids === []) {
            return 0;
        }
        $placeholders = implode(', ', array_fill(0, count($ids), '?'));
        $stmt = $this->pdo->prepare("DELETE FROM `{$meta['table']}` WHERE id IN ({$placeholders})");
        $stmt->execute($ids);
        return $stmt->rowCount();
    }

    public function truncate(string $collection): void
    {
        $meta = Schema::assertCollection($collection);
        $this->pdo->exec("DELETE FROM `{$meta['table']}`");
    }

    /** 依 room + date 取回當日預約，供衝突檢查使用 */
    public function bookingsForRoomDate(string $roomId, string $date): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM bookings WHERE room_id = ? AND booking_date = ?'
        );
        $stmt->execute([$roomId, $date]);
        return array_map(fn(array $r) => $this->toJson('bookings', $r), $stmt->fetchAll());
    }

    private function exists(string $table, string $id): bool
    {
        $stmt = $this->pdo->prepare("SELECT 1 FROM `{$table}` WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        return (bool) $stmt->fetchColumn();
    }

    /** 資料庫列 -> 前端 JSON 物件 */
    public function toJson(string $collection, array $row): array
    {
        $meta = Schema::assertCollection($collection);
        $out = [];
        foreach ($meta['fields'] as $jsonKey => [$col, $type]) {
            if (!array_key_exists($col, $row)) {
                continue;
            }
            $out[$jsonKey] = $this->fromColumn($type, $row[$col]);
        }
        return $out;
    }

    private function toColumn(string $type, $value)
    {
        return match ($type) {
            'int'   => $value === null || $value === '' ? 0 : (int) $value,
            'float' => $value === null || $value === '' ? 0.0 : (float) $value,
            'bool'  => $this->truthy($value) ? 1 : 0,
            'json'  => json_encode(
                $value === null || $value === '' ? [] : $value,
                JSON_UNESCAPED_UNICODE
            ),
            'date'  => $this->normalizeDate($value),
            default => $value === null ? null : (string) $value,
        };
    }

    private function fromColumn(string $type, $value)
    {
        if ($value === null) {
            return match ($type) {
                'int' => 0, 'float' => 0.0, 'bool' => false, 'json' => [], default => '',
            };
        }
        return match ($type) {
            'int'   => (int) $value,
            'float' => (float) $value,
            'bool'  => (bool) (int) $value,
            'json'  => json_decode((string) $value, true) ?? [],
            'date'  => substr((string) $value, 0, 10),
            default => (string) $value,
        };
    }

    private function truthy($value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if (is_numeric($value)) {
            return (float) $value != 0.0;
        }
        return in_array(strtolower(trim((string) $value)), ['true', 'yes', '是', 'on', '1'], true);
    }

    /** 接受 2024-05-01 或 2024-05-01T00:00:00Z，一律存成 Y-m-d */
    private function normalizeDate($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $str = (string) $value;
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $str, $m)) {
            return "{$m[1]}-{$m[2]}-{$m[3]}";
        }
        $ts = strtotime($str);
        return $ts === false ? null : date('Y-m-d', $ts);
    }
}
