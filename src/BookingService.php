<?php
declare(strict_types=1);

namespace App;

use PDO;
use RuntimeException;

/**
 * 預約的核心規則。原版本只在瀏覽器端檢查衝突，任何人改一行 JS 就能寫入重疊資料；
 * 這裡把假期、關閉時段、時段重疊、人數上限與授權碼全部改由伺服器驗證。
 */
final class BookingService
{
    public function __construct(private PDO $pdo, private Repository $repo)
    {
    }

    /**
     * @param array $payload roomId, slots[{date,slot}], userName, purpose,
     *                       participants, isStudent, className, cancelCode,
     *                       authCode, isRecurring, userId
     * @return array{created:array,skipped:int,cancelCode:string}
     */
    public function create(array $payload): array
    {
        $roomId = (string) ($payload['roomId'] ?? '');
        $room = $this->repo->find('rooms', $roomId);
        if ($room === null) {
            throw new RuntimeException('找不到指定的課室/功能室');
        }

        $userName = trim((string) ($payload['userName'] ?? ''));
        $purpose  = trim((string) ($payload['purpose'] ?? ''));
        $participants = (int) ($payload['participants'] ?? 0);
        $isStudent = !empty($payload['isStudent']);
        $className = $isStudent ? trim((string) ($payload['className'] ?? '')) : '';

        if ($userName === '') {
            throw new RuntimeException('請填寫預約人姓名');
        }
        if ($purpose === '') {
            throw new RuntimeException('請填寫預約用途');
        }
        if ($participants <= 0) {
            throw new RuntimeException('請填寫有效的預約人數');
        }
        if ($isStudent && $className === '') {
            throw new RuntimeException('請選擇班級');
        }
        if (!empty($room['capacity']) && $participants > (int) $room['capacity']) {
            throw new RuntimeException("人數超過課室上限 ({$room['capacity']}人)");
        }

        $cancelCode = trim((string) ($payload['cancelCode'] ?? ''));
        if ($cancelCode === '') {
            $cancelCode = (string) random_int(1000, 9999);
        } elseif (!preg_match('/^\d{4}$/', $cancelCode)) {
            throw new RuntimeException('請設定 4 位數字的取消預約碼');
        }

        $slots = $this->normalizeSlots($payload['slots'] ?? []);
        if ($slots === []) {
            throw new RuntimeException('沒有選擇任何時段');
        }

        $dates = array_unique(array_column($slots, 'date'));
        $isRecurring = !empty($payload['isRecurring']) || count($dates) > 1;
        $needsAuthCode = !empty($room['requiresAuthCode']) && $isRecurring;

        $this->pdo->beginTransaction();
        try {
            $authCodeRow = null;
            if ($needsAuthCode) {
                $code = trim((string) ($payload['authCode'] ?? ''));
                if ($code === '') {
                    throw new RuntimeException('此課室的連續預約必須提供授權碼');
                }
                $authCodeRow = $this->repo->findBy('authCodes', 'code', $code);
                if ($authCodeRow === null || !empty($authCodeRow['isUsed'])) {
                    throw new RuntimeException('授權碼無效或已被使用');
                }
            }

            $holidays  = $this->repo->all('holidays');
            $timeSlots = $this->repo->all('timeSlots');

            $created = [];
            $skipped = 0;
            $userId = (string) ($payload['userId'] ?? 'guest');
            $now = (int) round(microtime(true) * 1000);
            $index = 0;

            foreach ($slots as $slot) {
                if (!$this->isDateBookable($slot['date'], $holidays)) {
                    $skipped++;
                    continue;
                }
                if ($this->isSlotClosed($slot['slot'], $room, $timeSlots)) {
                    $skipped++;
                    continue;
                }
                if ($this->hasConflict($roomId, $slot['date'], $slot['slot'], $created)) {
                    $skipped++;
                    continue;
                }

                $booking = [
                    'id'           => sprintf('bk_%d_%d_%s', $now, $index++, bin2hex(random_bytes(3))),
                    'roomId'       => $roomId,
                    'date'         => $slot['date'],
                    'timeSlot'     => $slot['slot'],
                    'userId'       => $userId,
                    'userName'     => $userName,
                    'purpose'      => $purpose,
                    'participants' => $participants,
                    'isStudent'    => $isStudent,
                    'className'    => $className,
                    'isLocked'     => false,
                    'cancelCode'   => $cancelCode,
                    'createdAt'    => $now,
                ];
                $this->repo->save('bookings', $booking);
                unset($booking['cancelCode']);
                $created[] = $booking;
            }

            if ($created === []) {
                throw new RuntimeException('所選日期皆無法預約 (時段衝突、假期或不開放)');
            }

            if ($authCodeRow !== null) {
                $this->repo->save('authCodes', ['id' => $authCodeRow['id'], 'isUsed' => true]);
            }

            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return ['created' => $created, 'skipped' => $skipped, 'cancelCode' => $cancelCode];
    }

    /** 訪客憑 4 位數取消碼刪除自己的預約；取消碼永遠不會離開伺服器 */
    public function cancelByCode(string $bookingId, string $code): void
    {
        $stmt = $this->pdo->prepare('SELECT * FROM bookings WHERE id = ? LIMIT 1');
        $stmt->execute([$bookingId]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('找不到這筆預約');
        }
        if ((int) $row['is_locked'] === 1) {
            throw new RuntimeException('此預約已被管理員鎖定，無法取消');
        }
        $stored = (string) ($row['cancel_code'] ?? '');
        if ($stored === '') {
            throw new RuntimeException('此預約沒有設定取消密碼，請聯絡管理員處理');
        }
        if (!hash_equals($stored, trim($code))) {
            throw new RuntimeException('取消密碼錯誤！您無權刪除此預約。');
        }
        $this->repo->delete('bookings', $bookingId);
    }

    /** @return array<int,array{date:string,slot:string}> */
    private function normalizeSlots($raw): array
    {
        $out = [];
        $seen = [];
        foreach ((array) $raw as $item) {
            if (is_string($item) && str_contains($item, '|')) {
                [$date, $slot] = explode('|', $item, 2);
            } else {
                $date = (string) ($item['date'] ?? '');
                $slot = (string) ($item['slot'] ?? $item['timeSlot'] ?? '');
            }
            $date = trim($date);
            $slot = trim($slot);
            if ($date === '' || $slot === '' || !TimeHelper::isValidDate($date)) {
                continue;
            }
            $key = "$date|$slot";
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = ['date' => $date, 'slot' => $slot];
        }
        return $out;
    }

    private function isDateBookable(string $date, array $holidays): bool
    {
        foreach ($holidays as $h) {
            $start = $h['startDate'] ?: ($h['date'] ?? '');
            $end   = $h['endDate'] ?: $start;
            if ($start === '' || $date < $start || $date > $end) {
                continue;
            }
            return !empty($h['allowBooking']);
        }
        return true;
    }

    private function isSlotClosed(string $slotName, array $room, array $timeSlots): bool
    {
        $closed = $room['closedSlots'] ?? [];
        if (!is_array($closed) || $closed === []) {
            return false;
        }
        foreach ($timeSlots as $ts) {
            if (!in_array($ts['id'], $closed, true)) {
                continue;
            }
            if (TimeHelper::overlaps($slotName, (string) $ts['name'])) {
                return true;
            }
        }
        return false;
    }

    /** @param array $pending 本批次中尚未提交的預約 */
    private function hasConflict(string $roomId, string $date, string $slotName, array $pending): bool
    {
        foreach ($this->repo->bookingsForRoomDate($roomId, $date) as $b) {
            if (TimeHelper::overlaps($slotName, (string) $b['timeSlot'])) {
                return true;
            }
        }
        foreach ($pending as $b) {
            if ($b['date'] === $date && TimeHelper::overlaps($slotName, (string) $b['timeSlot'])) {
                return true;
            }
        }
        return false;
    }
}
