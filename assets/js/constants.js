export const Constants = {
  // PHP + MySQL 版本的單一 API 進入點（與前端同網域，使用相對路徑即可）
  API_BASE_URL: 'api/syncData.php',

  // 本機快取的 key；資料結構改變時可調整版本號讓舊快取失效
  CACHE_KEY: 'booking_system_cache_v2'
};
