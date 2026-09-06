<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/src/bootstrap.php';

use App\Schema;
use App\TimeHelper;

$failures = [];
$checks = 0;

$assert = static function (bool $condition, string $message) use (&$failures, &$checks): void {
    $checks++;
    if (!$condition) {
        $failures[] = $message;
    }
};

// Core slot semantics recovered from the original browser implementation.
$assert(TimeHelper::overlaps('08:00-09:00', '08:30-09:30'), 'overlapping ranges must conflict');
$assert(!TimeHelper::overlaps('08:00-09:00', '09:00-10:00'), 'adjacent ranges must not conflict');
$assert(TimeHelper::overlaps('第一節', '第一節'), 'identical named slots must conflict');
$assert(!TimeHelper::overlaps('第一節', '第二節'), 'different named slots must not conflict');
$assert(TimeHelper::isValidDate('2024-02-29'), 'leap day must be accepted');
$assert(!TimeHelper::isValidDate('2023-02-29'), 'invalid leap day must be rejected');
$assert(!TimeHelper::isValidDate('2024-02-30'), 'normalized calendar dates must be rejected');
$assert(!TimeHelper::isValidDate('2024-2-01'), 'date input must retain YYYY-MM-DD format');

// Verify the reconstructed page can load every repository-owned asset it references.
$root = dirname(__DIR__);
$html = file_get_contents($root . '/index.html');
$assert($html !== false, 'index.html must be readable');
if ($html !== false) {
    preg_match_all('/(?:src|href)="((?!https?:|data:|#)[^"]+)"/', $html, $matches);
    foreach (array_unique($matches[1]) as $asset) {
        $assert(is_file($root . '/' . $asset), "missing local page asset: {$asset}");
    }
}

foreach (['rooms', 'timeSlots', 'classes', 'holidays', 'settings', 'bookings', 'users', 'authCodes'] as $collection) {
    $assert(in_array($collection, Schema::collections(), true), "missing API collection: {$collection}");
}

if ($failures !== []) {
    fwrite(STDERR, "Smoke checks failed:\n - " . implode("\n - ", $failures) . "\n");
    exit(1);
}

fwrite(STDOUT, "Smoke checks passed ({$checks} assertions).\n");
