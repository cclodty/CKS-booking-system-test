<?php
declare(strict_types=1);

namespace App;

use InvalidArgumentException;

/**
 * 前端使用 Firestore 時代的 camelCase 欄位名，資料庫使用 snake_case 欄位。
 * 這裡集中定義兩者的對應與型別，讓 Repository 可以通用地讀寫。
 */
final class Schema
{
    /**
     * collection => [table, fields => [jsonKey => [col, type]]]
     * type: string | int | float | bool | json | date
     */
    public const MAP = [
        'rooms' => [
            'table'  => 'rooms',
            'fields' => [
                'id'               => ['id', 'string'],
                'name'             => ['name', 'string'],
                'roomNumber'       => ['room_number', 'string'],
                'type'             => ['type', 'string'],
                'order'            => ['sort_order', 'int'],
                'capacity'         => ['capacity', 'int'],
                'requiresAuthCode' => ['requires_auth_code', 'bool'],
                'customNotices'    => ['custom_notices', 'json'],
                'closedSlots'      => ['closed_slots', 'json'],
            ],
        ],
        'timeSlots' => [
            'table'  => 'time_slots',
            'fields' => [
                'id'    => ['id', 'string'],
                'name'  => ['name', 'string'],
                'order' => ['sort_order', 'int'],
            ],
        ],
        'classes' => [
            'table'  => 'classes',
            'fields' => [
                'id'    => ['id', 'string'],
                'name'  => ['name', 'string'],
                'order' => ['sort_order', 'int'],
            ],
        ],
        'holidays' => [
            'table'  => 'holidays',
            'fields' => [
                'id'           => ['id', 'string'],
                'startDate'    => ['start_date', 'date'],
                'endDate'      => ['end_date', 'date'],
                'date'         => ['start_date', 'date'],
                'description'  => ['description', 'string'],
                'order'        => ['sort_order', 'int'],
                'allowBooking' => ['allow_booking', 'bool'],
            ],
        ],
        'settings' => [
            'table'  => 'settings',
            'fields' => [
                'id'           => ['id', 'string'],
                'settingKey'   => ['setting_key', 'string'],
                'settingValue' => ['setting_value', 'string'],
            ],
        ],
        'bookings' => [
            'table'  => 'bookings',
            'fields' => [
                'id'           => ['id', 'string'],
                'roomId'       => ['room_id', 'string'],
                'date'         => ['booking_date', 'date'],
                'timeSlot'     => ['time_slot', 'string'],
                'userId'       => ['user_id', 'string'],
                'userName'     => ['user_name', 'string'],
                'purpose'      => ['purpose', 'string'],
                'participants' => ['participants', 'int'],
                'isStudent'    => ['is_student', 'bool'],
                'className'    => ['class_name', 'string'],
                'isLocked'     => ['is_locked', 'bool'],
                'cancelCode'   => ['cancel_code', 'string'],
                'createdAt'    => ['created_at', 'int'],
            ],
        ],
        'users' => [
            'table'  => 'users',
            'fields' => [
                'id'           => ['id', 'string'],
                'username'     => ['username', 'string'],
                'name'         => ['display_name', 'string'],
                'password'     => ['password_hash', 'string'],
                'role'         => ['role', 'string'],
                'managedRooms' => ['managed_rooms', 'json'],
            ],
        ],
        'authCodes' => [
            'table'  => 'auth_codes',
            'fields' => [
                'id'        => ['id', 'string'],
                'code'      => ['code', 'string'],
                'isUsed'    => ['is_used', 'bool'],
                'createdBy' => ['created_by', 'string'],
                'createdAt' => ['created_at', 'int'],
            ],
        ],
    ];

    /** 不會回傳給前端的敏感欄位 */
    public const HIDDEN_FIELDS = [
        'users'    => ['password'],
        'bookings' => ['cancelCode'],
    ];

    /** 只有管理員登入後才能讀取的資料表 */
    public const ADMIN_ONLY_COLLECTIONS = ['users', 'authCodes'];

    public static function collections(): array
    {
        return array_keys(self::MAP);
    }

    public static function assertCollection(string $collection): array
    {
        if (!isset(self::MAP[$collection])) {
            throw new InvalidArgumentException("未知的資料表：{$collection}");
        }
        return self::MAP[$collection];
    }
}
