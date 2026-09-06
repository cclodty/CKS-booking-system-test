# 課室 / 功能室預約系統（PHP + MySQL 版）

原專案是「純前端 JS + Vercel Serverless + Firebase Firestore（並以 Google Apps Script 作備援）」的架構。
本版本把後端整個換成 **PHP + MySQL**，可直接放在一般虛擬主機、校內伺服器或 Docker 上執行，
不再需要 Vercel、Firebase 或 Google Apps Script。

前端介面與操作流程維持原樣（Vanilla JS ES Modules + Tailwind），API 的請求格式
（`POST { action, payload }` → `{ success, ... }`）也刻意保持一致，方便對照原始碼。

---

## 功能

- **預約**：單日 / 整週檢視、依名稱或室號搜尋課室、多時段一次選取、自訂連續時間段、重複（每週）預約
- **我的預約**：以姓名查詢今天及未來的預約，憑 4 位數取消密碼自行取消
- **時間表**：以「週一起算 6 天」產生各課室時間表，可列印或匯出 PDF
- **後台管理**：預約管理（搜尋 / 分頁 / 編輯 / 鎖定 / 批量刪除）、課室、時間段、班級、假期、
  帳號、權限分配、列印欄位設定、連續預約授權碼、自選日期區間的時間表報表
- **匯入匯出**：預約記錄匯出 Excel、以範本批次匯入、資料備份與還原

---

## 系統需求

- PHP 8.0 以上，需啟用 `pdo_mysql`、`json`、`session`、`mbstring`
- MySQL 5.7+ 或 MariaDB 10.3+
- Apache / Nginx，或開發用的 PHP 內建伺服器

## 基線驗收

目前版本以舊有前端的資料結構、操作流程及 API 合約作逆向工程，先建立可操作的 PHP + MySQL
功能基線；介面與效能優化留待基線驗收後再進行。毋須連接資料庫的快速檢查可用來確認核心時段規則、
日期驗證、API 資料集合，以及頁面引用的本機資源均完整：

```bash
php tests/smoke.php
```

完整驗收則依下方 Docker 安裝步驟啟動系統，再測試預約、取消及管理員操作流程。

---

## 安裝

### 即開即用 Demo（毋須資料庫）

只需在專案目錄啟動靜態伺服器：

```bash
php -S 0.0.0.0:8080 -t .
```

然後開啟 `http://localhost:8080/`；如果後端資料庫尚未設定，頁面會自動進入 Demo。也可用
`http://localhost:8080/?demo=1` 明確啟用。Demo 會載入課室、時段及預約範例，新增或修改的內容只會
保存在目前瀏覽器的 `localStorage`，不會寫入伺服器。按頁面上的「重設示範資料」即可回復初始狀態。
示範管理員帳號為 `demo`，密碼可任意填寫；正式模式不受影響，仍會使用 PHP + MySQL API。
如要在資料庫離線時檢查正式模式的錯誤畫面，可開啟 `http://localhost:8080/?live=1` 停用自動 fallback。

### 方式一：Docker（最快，適合先試玩）

```bash
docker compose up -d
docker compose exec app php database/install.php
# 開啟 http://localhost:8080
```

### 方式二：本機 PHP 內建伺服器

```bash
# 1. 設定連線
cp config/config.example.php config/config.php
$EDITOR config/config.php          # 或改用 .env / 環境變數

# 2. 建立資料表與初始資料
php database/install.php

# 3. 啟動
php -S localhost:8080 -t .
# 開啟 http://localhost:8080
```

### 方式三：一般虛擬主機 / 校內伺服器

1. 將整個專案上傳到網站根目錄。
2. 用 phpMyAdmin 之類的工具建立資料庫（字集 `utf8mb4`），依序匯入
   `database/schema.sql` 與 `database/seed.sql`。
3. 複製 `config/config.example.php` 為 `config/config.php` 並填入連線資訊。
4. 確認 `config/`、`src/`、`database/` 三個目錄無法被瀏覽器直接存取
   （已附 `.htaccess`；Apache 需開啟 `AllowOverride All`，Nginx 請參考下方設定）。

Nginx 範例：

```nginx
location ~ ^/(config|src|database)/ { deny all; return 404; }
location ~ \.php$ { fastcgi_pass unix:/run/php/php8.2-fpm.sock; include fastcgi_params;
                    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name; }
```

### 預設帳號

| 帳號 | 密碼 | 角色 |
|---|---|---|
| `admin` | `admin123` | 超級管理員 |

> ⚠️ **請在上線前立即登入後台 →「帳號管理」修改密碼。**

---

## 設定

連線設定的優先順序為：**環境變數 → `config/config.php` → `config/config.example.php`**。

| 環境變數 | 說明 | 預設 |
|---|---|---|
| `DB_HOST` | 資料庫主機 | `localhost` |
| `DB_PORT` | 連接埠 | `3306` |
| `DB_NAME` | 資料庫名稱 | `booking_system` |
| `DB_USER` / `DB_PASS` | 帳號密碼 | `booking` / `booking` |
| `APP_TIMEZONE` | 系統時區 | `Asia/Hong_Kong` |

也可以複製 `.env.example` 為 `.env`。`config/config.php` 與 `.env` 都已列入 `.gitignore`。

---

## 目錄結構

```
├── index.html                前端頁面（原本壓縮檔內沒有 HTML，此版本依 JS 需求重建）
├── assets/
│   ├── css/app.css           hidden-view、列印樣式等 Tailwind 涵蓋不到的部分
│   ├── js/                   前端模組（由原始 js/ 移植）
│   └── vendor/README.md      離線 / 內網部署時如何改用本機套件
├── api/syncData.php          單一進入點 API（取代原本的 Vercel Function）
├── src/
│   ├── bootstrap.php         PSR-4 自動載入（不需要 Composer）
│   ├── Config.php            設定讀取
│   ├── Database.php          PDO 連線
│   ├── Schema.php            前端 camelCase 欄位 ↔ 資料表 snake_case 欄位對應
│   ├── Repository.php        通用讀寫（含 Firestore 式的 merge 更新）
│   ├── BookingService.php    預約規則（假期、關閉時段、重疊、人數、授權碼）
│   ├── Auth.php              Session 登入與密碼雜湊
│   └── TimeHelper.php        時段字串解析與重疊判斷
├── config/                   設定檔
├── database/                 schema.sql / seed.sql / install.php
└── docker/, docker-compose.yml
```

---

## API

全部走 `POST api/syncData.php`，內容為 `{ "action": "...", "payload": { ... } }`。

| action | 權限 | 說明 |
|---|---|---|
| `getData` | 公開 | 取回所有公開資料；已登入時另含 `users`、`authCodes` |
| `login` / `logout` | 公開 | 管理員登入 / 登出（PHP Session） |
| `createBookings` | 公開 | 建立預約，伺服器完整驗證所有規則 |
| `cancelBooking` | 公開 | 以 4 位數取消密碼刪除自己的預約 |
| `saveRow` | 管理員 | 新增 / 更新任一資料表（依角色再檢查） |
| `deleteRow` | 管理員 | 刪除資料（依角色再檢查） |
| `restoreDB` | 超級管理員 | 由 Excel 備份還原（不含帳號，見下） |

權限規則：

- **超級管理員**：全部功能。
- **一般管理員**：只能管理被分配到的課室及其預約；可修改自己的密碼，但不能改自己的角色、
  帳號或所管轄課室；時間段 / 班級 / 假期 / 列印設定與帳號刪除均不開放。
- **訪客**：只能讀取公開資料、建立預約、以取消密碼取消自己的預約。

---

## 與原版的差異

移植過程中修正了幾個原本會影響正確性或安全性的問題：

1. **預約規則改由伺服器驗證。** 原版的假期、關閉時段、時段重疊、人數上限、授權碼全部只在瀏覽器檢查，
   直接呼叫 API 就能寫入重疊資料。現在這些規則都在 `BookingService` 內於同一個交易中重新驗證。
2. **取消密碼不再下發到瀏覽器。** 原版把整張 `bookings`（含 `cancelCode`）送給所有人，
   前端再自行比對。現在取消密碼永遠留在伺服器，改由 `cancelBooking` 驗證。
3. **帳號資料只給已登入者。** 原版把 `users`（含密碼雜湊）與 `authCodes` 一併回傳給訪客。
4. **密碼儲存方式。** 前端一樣先做 SHA-256 再送出（維持相容），伺服器再以 `password_hash()`
   加上 bcrypt 保存；舊資料若是純 SHA-256，第一次登入成功後會自動升級。
5. **登入狀態改用 PHP Session。** 原版只把使用者物件存在 `localStorage`，改一個值就能變成超級管理員。
6. **輸出全面逸出。** 姓名、用途、班級、課室名稱等使用者輸入在插入畫面前都會經過 `Utils.esc()`。
7. **修正的既有錯誤**：登入失敗時 `err` 變數被 catch 參數覆蓋導致無法顯示訊息；
   `nav.js` 少匯入 `Utils`；多處行內事件少了 `App.` 前綴（時間段刪除、權限勾選、自訂時段開關）；
   後台列印分頁與公開時間表共用同一組 `id`／`class` 導致勾選框畫錯位置；
   後台呼叫但不存在的 `Print.renderPrintView`；`admin.js` 中重複定義的三個函式。
8. **還原備份不再包含帳號。** 備份檔由瀏覽器產生、不含密碼雜湊，若照著還原會把所有帳號清空。
   帳號請以 `mysqldump` 備份：

   ```bash
   mysqldump -u booking -p booking_system > backup.sql
   ```

9. **移除 Google Apps Script 相關程式碼**（`forceSyncFromGAS`、`fixDatabase` 等），本版本不再需要。

---

## 注意事項

- `index.html` 預設從 CDN 載入 Tailwind、Font Awesome、SheetJS、html2pdf。
  若伺服器連不到外網，請依 `assets/vendor/README.md` 改為本機檔案。
- 時間段名稱請使用 `08:00-09:00` 這種格式，系統才能判斷時段是否重疊；
  若使用「第一節」這類名稱，只會做完全相同的字串比對。
- 建議以 HTTPS 提供服務。若只能用 `http://` 的內網位址，瀏覽器的 `crypto.subtle` 會停用，
  系統會自動改用內建的 SHA-256 實作，登入仍可正常運作。
