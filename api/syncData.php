<?php
declare(strict_types=1);

/**
 * 單一進入點 API，取代原本 Vercel + Firebase 的 api/syncData.js。
 * 請求格式維持不變：POST { action, payload }，回應 { success, ... }。
 */

require_once dirname(__DIR__) . '/src/bootstrap.php';

use App\Auth;
use App\BookingService;
use App\Config;
use App\Database;
use App\Repository;
use App\Schema;

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$allowedOrigins = Config::get('allowed_origins', []);
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Vary: Origin');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

/** 統一輸出 */
function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 200): never
{
    respond(['success' => false, 'error' => $message], $status);
}

/** 移除不該離開伺服器的欄位 */
function stripHidden(string $collection, array $rows): array
{
    $hidden = Schema::HIDDEN_FIELDS[$collection] ?? [];
    if ($hidden === []) {
        return $rows;
    }
    return array_map(static function (array $row) use ($hidden) {
        foreach ($hidden as $field) {
            unset($row[$field]);
        }
        return $row;
    }, $rows);
}

$raw = file_get_contents('php://input') ?: '';
$body = json_decode($raw, true);
if (!is_array($body)) {
    fail('請求內容不是有效的 JSON', 400);
}

$action  = (string) ($body['action'] ?? '');
$payload = is_array($body['payload'] ?? null) ? $body['payload'] : [];

Auth::start();

try {
    $pdo  = Database::pdo();
    $repo = new Repository($pdo);
    $bookings = new BookingService($pdo, $repo);

    switch ($action) {
        // ---------------------------------------------------------------
        // 讀取資料：訪客只拿得到公開資料表，users / authCodes 需登入
        // ---------------------------------------------------------------
        case 'getData': {
            // 帳號可能已被刪除或停權，每次讀取時重新確認 Session 是否仍有效
            if (Auth::isLoggedIn()) {
                $me = Auth::user();
                $fresh = $repo->find('users', (string) ($me['id'] ?? ''));
                if ($fresh === null) {
                    Auth::logout();
                } else {
                    unset($fresh['password']);
                    Auth::refresh($fresh);
                }
            }
            $isAdmin = Auth::isLoggedIn();
            $result = [];
            foreach (Schema::collections() as $collection) {
                if (!$isAdmin && in_array($collection, Schema::ADMIN_ONLY_COLLECTIONS, true)) {
                    $result[$collection] = [];
                    continue;
                }
                $result[$collection] = stripHidden($collection, $repo->all($collection));
            }
            respond(['success' => true, 'data' => $result, 'user' => Auth::user()]);
        }

        // ---------------------------------------------------------------
        // 登入 / 登出 / 取回目前登入狀態
        // ---------------------------------------------------------------
        case 'login': {
            $username = trim((string) ($payload['username'] ?? ''));
            $password = (string) ($payload['password'] ?? '');
            if ($username === '' || $password === '') {
                fail('請輸入帳號密碼');
            }

            // 稍作延遲，降低暴力破解效率
            usleep(200000);

            $user = $repo->findBy('users', 'username', $username);
            if ($user === null) {
                fail('帳號或密碼錯誤');
            }

            $verified = Auth::verifyClientPassword($password, (string) ($user['password'] ?? ''));
            if ($verified === false) {
                fail('帳號或密碼錯誤');
            }
            if (is_string($verified)) {
                // 舊格式雜湊，登入成功後自動升級
                $repo->save('users', ['id' => $user['id'], 'password' => $verified]);
            }

            unset($user['password']);
            Auth::login($user);

            respond([
                'success'   => true,
                'user'      => $user,
                'adminData' => [
                    'users'     => stripHidden('users', $repo->all('users')),
                    'authCodes' => $repo->all('authCodes'),
                ],
            ]);
        }

        case 'logout': {
            Auth::logout();
            respond(['success' => true]);
        }

        // ---------------------------------------------------------------
        // 訪客預約：所有規則改由伺服器把關
        // ---------------------------------------------------------------
        case 'createBookings': {
            $result = $bookings->create($payload);
            respond([
                'success'    => true,
                'bookings'   => $result['created'],
                'skipped'    => $result['skipped'],
                'cancelCode' => $result['cancelCode'],
            ]);
        }

        case 'cancelBooking': {
            $bookings->cancelByCode(
                (string) ($payload['id'] ?? ''),
                (string) ($payload['cancelCode'] ?? '')
            );
            respond(['success' => true]);
        }

        // ---------------------------------------------------------------
        // 後台寫入
        // ---------------------------------------------------------------
        case 'saveRow': {
            requireLogin();
            $table = (string) ($payload['table'] ?? '');
            Schema::assertCollection($table);
            $rows = $payload['data'] ?? [];
            $rows = array_is_list($rows) ? $rows : [$rows];

            $saved = [];
            $pdo->beginTransaction();
            try {
                foreach ($rows as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $saved[] = saveWithPermissions($repo, $table, $row);
                }
                $pdo->commit();
            } catch (\Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }

            respond(['success' => true, 'data' => stripHidden($table, $saved)]);
        }

        case 'deleteRow': {
            requireLogin();
            $table = (string) ($payload['table'] ?? '');
            Schema::assertCollection($table);
            $ids = $payload['id'] ?? [];
            $ids = is_array($ids) ? $ids : [$ids];

            foreach ($ids as $id) {
                assertCanDelete($repo, $table, (string) $id);
            }
            $count = $repo->delete($table, $ids);
            respond(['success' => true, 'deleted' => $count]);
        }

        case 'restoreDB': {
            requireSuperAdmin();

            // users 不參與還原：備份檔（由瀏覽器產生）不含密碼雜湊，
            // 若照著還原會把所有帳號洗掉而沒人能再登入。
            // 需要連帳號一起備份/還原時請使用 mysqldump，見 README。
            $order = ['rooms', 'timeSlots', 'classes', 'holidays', 'settings', 'authCodes', 'bookings'];
            $incoming = array_values(array_intersect($order, array_keys($payload)));
            $ignoredUsers = array_key_exists('users', $payload);

            // bookings 有指向 rooms 的外鍵，所以要先清空 bookings、最後才寫入 bookings，
            // 否則清空 rooms 時會連帶刪掉剛還原的預約。
            $pdo->beginTransaction();
            try {
                foreach (array_reverse($order) as $collection) {
                    if (in_array($collection, $incoming, true)) {
                        $repo->truncate($collection);
                    }
                }

                foreach ($order as $collection) {
                    if (!in_array($collection, $incoming, true) || !is_array($payload[$collection])) {
                        continue;
                    }
                    foreach ($payload[$collection] as $row) {
                        if (is_array($row) && !empty($row['id'])) {
                            $repo->save($collection, $row);
                        }
                    }
                }
                $pdo->commit();
            } catch (\Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }

            respond([
                'success' => true,
                'message' => $ignoredUsers
                    ? '還原完成（管理員帳號不在還原範圍內，維持原狀）'
                    : '還原完成',
            ]);
        }

        default:
            fail('未知的操作：' . $action, 400);
    }
} catch (\InvalidArgumentException $e) {
    fail($e->getMessage(), 400);
} catch (\RuntimeException $e) {
    fail($e->getMessage());
} catch (\Throwable $e) {
    error_log('[booking-api] ' . $e->getMessage());
    fail('伺服器發生錯誤，請聯絡管理員', 500);
}

// -------------------------------------------------------------------------
// 權限輔助函式
// -------------------------------------------------------------------------

function requireLogin(): void
{
    if (!Auth::isLoggedIn()) {
        fail('請先登入管理員帳號', 401);
    }
}

function requireSuperAdmin(): void
{
    requireLogin();
    if (!Auth::isSuperAdmin()) {
        fail('此操作僅限超級管理員', 403);
    }
}

/** 依資料表套用不同的寫入權限規則 */
function saveWithPermissions(Repository $repo, string $table, array $row): array
{
    $isSuper = Auth::isSuperAdmin();
    $me = Auth::user();
    $existing = !empty($row['id']) ? $repo->find($table, (string) $row['id']) : null;

    switch ($table) {
        case 'bookings':
            $roomId = (string) ($row['roomId'] ?? $existing['roomId'] ?? '');
            if (!Auth::canManageRoom($roomId)) {
                fail('無權限修改此課室的預約', 403);
            }
            // 取消碼只由訪客設定，後台編輯不得覆寫
            unset($row['cancelCode']);
            break;

        case 'rooms':
            if (!$isSuper) {
                if ($existing === null) {
                    fail('僅超級管理員可新增課室', 403);
                }
                if (!Auth::canManageRoom((string) $row['id'])) {
                    fail('無權限修改此課室', 403);
                }
            }
            break;

        case 'users':
            if (!$isSuper) {
                if ($existing === null || $existing['id'] !== ($me['id'] ?? null)) {
                    fail('一般管理員僅能修改自己的帳號', 403);
                }
                // 不得自行提權或改帳號、改所管理的課室
                $row['role'] = $existing['role'];
                $row['username'] = $existing['username'];
                unset($row['managedRooms']);
            }
            $row['password'] = normalizeUserPassword($repo, $row, $existing);
            if ($row['password'] === null) {
                unset($row['password']);
            }
            break;

        case 'authCodes':
            break;

        case 'timeSlots':
        case 'classes':
        case 'holidays':
        case 'settings':
            if (!$isSuper) {
                fail('此設定僅限超級管理員修改', 403);
            }
            break;
    }

    return $repo->save($table, $row);
}

/**
 * 密碼欄位處理：
 * - 空值 → 沿用原本密碼（回傳 null 代表不更新）
 * - 64 位十六進位（前端 SHA-256）→ 以 bcrypt 保存
 * - 已是 bcrypt → 原樣保存（還原備份用）
 */
function normalizeUserPassword(Repository $repo, array $row, ?array $existing): ?string
{
    $password = (string) ($row['password'] ?? '');
    if ($password === '') {
        if ($existing === null) {
            fail('新增帳號時密碼為必填');
        }
        return null;
    }
    if (str_starts_with($password, '$2y$') || str_starts_with($password, '$argon2')) {
        return $password;
    }
    return Auth::hashClientPassword($password);
}

function assertCanDelete(Repository $repo, string $table, string $id): void
{
    $isSuper = Auth::isSuperAdmin();
    $me = Auth::user();

    if ($table === 'bookings') {
        $booking = $repo->find('bookings', $id);
        if ($booking === null) {
            return;
        }
        if (!Auth::canManageRoom((string) $booking['roomId'])) {
            fail('無權限刪除此課室的預約', 403);
        }
        if (!empty($booking['isLocked'])) {
            fail('此預約已鎖定，請先解鎖再刪除');
        }
        return;
    }

    if ($table === 'users') {
        if (!$isSuper) {
            fail('僅超級管理員可刪除帳號', 403);
        }
        if ($id === (string) ($me['id'] ?? '')) {
            fail('無法刪除自己的帳號');
        }
        return;
    }

    if ($table === 'authCodes') {
        return;
    }

    if (!$isSuper) {
        fail('此操作僅限超級管理員', 403);
    }
}
