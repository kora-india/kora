# SchoolOS Desktop App & Offline Sync Architecture

This document details the complete specification for:

1. **Phase 1: Basic Desktop App** – Multi-platform Electron desktop distribution (macOS Apple Silicon, macOS Intel, and Windows).
2. **Phase 2: Offline Sync Queue** – Architectural blueprint for offline-first support and automatic background synchronization when internet connectivity drops and recovers.

---

# Part 1: Basic Desktop App (Cloud-Connected Electron)

## 1. Overview & Architecture

SchoolOS uses a monorepo structure (Turborepo + pnpm). The desktop app lives in `apps/desktop` as a lightweight Electron shell.

Instead of duplicating the full Next.js backend, the desktop app acts as an optimized, secure native window loading the hosted SchoolOS instance (in production) or `http://localhost:3000` (in local development).

```
┌─────────────────────────────────────────────────────────────┐
│                    SchoolOS Desktop App                     │
│  (macOS Apple Silicon arm64 | macOS Intel x64 | Windows x64)│
└──────────────────────────────┬──────────────────────────────┘
                               │ loads
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  SchoolOS Web Application                    │
│      (Hosted Next.js on Vercel / Cloud Infrastructure)      │
│                                                             │
│   • NextAuth (Admin & Staff Sessions)                       │
│   • Server Actions & API Routes                             │
│   • Prisma ORM ──▶ PostgreSQL Database                      │
└─────────────────────────────────────────────────────────────┘
```

### Key Advantages

- **Zero Backend Changes**: Uses existing Next.js routes, Prisma models, and auth flows.
- **Shared Live Data**: Teachers, accountants, and principals see real-time updates across devices.
- **Native OS Integration**: Dock/taskbar badge notifications, native window title bars, hardware acceleration, and application lifecycle controls.

---

## 2. Directory Structure in Monorepo

```
schoolos/
├── apps/
│   ├── admin-web/
│   ├── marketing/
│   ├── teacher-pwa/
│   └── desktop/                  <-- [NEW DESKTOP WORKSPACE]
│       ├── package.json
│       ├── electron-builder.yml
│       ├── tsconfig.json
│       ├── resources/
│       │   ├── icon.icns         (macOS Icon: 1024x1024)
│       │   ├── icon.ico          (Windows Icon: 256x256)
│       │   └── icon.png          (Linux / Fallback: 512x512)
│       └── src/
│           ├── main.ts           (Main process: lifecycle, window creation)
│           ├── preload.ts        (Secure context isolation bridge)
│           └── offline.html      (Built-in offline fallback page)
```

---

## 3. Configuration & Code Specifications

### 3.1 `apps/desktop/package.json`

```json
{
  "name": "@schoolos/desktop",
  "version": "1.0.0",
  "private": true,
  "main": "dist/main.js",
  "scripts": {
    "dev": "tsc -w & electron .",
    "build:tsc": "tsc",
    "build:mac": "tsc && electron-builder --mac --arm64 --x64",
    "build:mac:arm": "tsc && electron-builder --mac --arm64",
    "build:mac:intel": "tsc && electron-builder --mac --x64",
    "build:win": "tsc && electron-builder --win --x64",
    "build:all": "tsc && electron-builder -mw"
  },
  "dependencies": {
    "electron-updater": "^6.3.0"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.1.8",
    "typescript": "^5.4.0"
  }
}
```

### 3.2 `apps/desktop/electron-builder.yml`

```yaml
appId: com.schoolos.desktop
productName: SchoolOS
directories:
  output: release
  buildResources: resources

files:
  - dist/**/*
  - resources/**/*
  - src/offline.html

mac:
  category: public.app-category.education
  target:
    - target: dmg
      arch:
        - arm64 # Apple Silicon (M1/M2/M3/M4)
        - x64 # Intel Macs
  icon: resources/icon.icns
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: resources/entitlements.mac.plist

win:
  target:
    - target: nsis
      arch:
        - x64 # Windows 64-bit
  icon: resources/icon.ico

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: SchoolOS
```

### 3.3 `apps/desktop/src/main.ts`

```typescript
import { app, BrowserWindow, shell, ipcMain } from "electron";
import * as path from "path";

let mainWindow: BrowserWindow | null = null;

const IS_DEV = process.env.NODE_ENV === "development" || !app.isPackaged;
const APP_URL = IS_DEV ? "http://localhost:3000" : "https://app.schoolos.com"; // Replace with production URL

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: "SchoolOS",
    backgroundColor: "#09090b", // Matches theme background
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Handle external link clicks in standard browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Load app
  mainWindow.loadURL(APP_URL);

  // Fallback to offline page on load failure
  mainWindow.webContents.on("did-fail-load", () => {
    mainWindow?.loadFile(path.join(__dirname, "offline.html"));
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

### 3.4 `apps/desktop/src/offline.html`

A clean, modern offline screen shown when connection cannot be established:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>SchoolOS - Offline</title>
    <style>
      body {
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background-color: #09090b;
        color: #fafafa;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
      }
      .card {
        text-align: center;
        padding: 32px;
        border: 1px solid #27272a;
        border-radius: 16px;
        max-width: 400px;
      }
      h2 {
        font-size: 20px;
        margin-bottom: 8px;
      }
      p {
        color: #a1a1aa;
        font-size: 14px;
        margin-bottom: 24px;
      }
      button {
        background: #7c3aed;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }
      button:hover {
        background: #6d28d9;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Unable to reach SchoolOS</h2>
      <p>
        Please check your internet connection. The app will reconnect
        automatically once available.
      </p>
      <button onclick="window.location.reload()">Retry Connection</button>
    </div>
  </body>
</html>
```

---

## 4. Website Download Buttons & Platform Detection

Add a download section on your landing page (`apps/marketing` or `apps/admin-web/src/components/landing/`):

### Auto-Detection Logic (`useUserPlatform.ts`)

```typescript
export function useUserPlatform() {
  if (typeof window === "undefined") return { os: "windows", arch: "x64" };

  const ua = window.navigator.userAgent.toLowerCase();
  const isMac = /macintosh|mac os x/.test(ua);
  const isWin = /windows nt/.test(ua);

  // Apple Silicon detection: MacIntel platform with multi-touch or WebGL renderer string
  const isAppleSilicon =
    isMac &&
    (window.navigator.maxTouchPoints > 2 ||
      (window.navigator as any).userAgentData?.architecture === "arm");

  return {
    os: isMac ? "mac" : isWin ? "win" : "other",
    arch: isAppleSilicon ? "arm64" : "x64",
  };
}
```

### Download Button Options

1. **Primary Button**: Automatically matches user OS:
   - _"Download for Mac (Apple Silicon)"_
   - _"Download for Mac (Intel)"_
   - _"Download for Windows (.exe)"_
2. **Platform Dropdown Menu**:
   - 🍏 macOS Apple Silicon (`.dmg`)
   - 🍏 macOS Intel (`.dmg`)
   - 🪟 Windows 10/11 64-bit (`.exe`)

---

# Part 2: Future Plan – Offline Sync Queue (Outbox Pattern)

When teachers take attendance or record daily actions in classrooms, Wi-Fi may drop momentarily. Instead of losing data or throwing an error, SchoolOS will adopt an **Offline-First Outbox Pattern**.

---

## 1. The Offline Architecture

```
User Action (e.g. Mark Attendance)
                │
                ▼
      Is Internet Online?
        /            \
     [YES]           [NO]
      /                \
Execute Server Action   Save to IndexedDB Outbox
      │                 Update UI Optimistically: "Saved (Pending Sync 🟡)"
      │                 │
      │                 ▼
      │         Wait for Network 'online' Event
      │                 │
      │                 ▼
      └─────────▶ Background Sync Worker
                        │
                        ▼
                Send to Server API
                        │
                        ▼
                Clear from IndexedDB
                Update UI: "Synced to Cloud 🟢"
```

---

## 2. Technical Stack for Offline Sync

| Component                | Technology                                   | Purpose                                                                                     |
| :----------------------- | :------------------------------------------- | :------------------------------------------------------------------------------------------ |
| **Local Storage Engine** | **IndexedDB** (via `Dexie.js`)               | Persists queued actions safely across page reloads/closing the app.                         |
| **Network Listener**     | `navigator.onLine` + Periodic Heartbeat Ping | Detects when network connectivity is truly available (not just connected to a dead router). |
| **Outbox Manager**       | `@schoolos/sync-engine` (shared package)     | Shared library usable by both `admin-web`, `desktop`, and `teacher-pwa`.                    |
| **Server Idempotency**   | UUID Request Tokens                          | Prevents duplicate records if a sync request is retried multiple times.                     |

---

## 3. Outbox Data Schema (IndexedDB)

```typescript
// packages/sync-engine/src/types.ts

export interface OutboxItem {
  id: string; // Client-generated UUID (idempotency key)
  entityType: "ATTENDANCE" | "FEE_ENTRY" | "STUDENT_NOTE";
  action: "CREATE" | "UPDATE";
  payload: Record<string, any>;
  timestamp: number; // UTC timestamp when action was created
  schoolId: string;
  userId: string;
  status: "PENDING" | "SYNCING" | "FAILED";
  retryCount: number;
  lastError?: string;
}
```

---

## 4. Sync Engine Implementation Plan

### Step 1: IndexedDB Setup with `Dexie.js`

Create a database table `offlineOutbox`:

```typescript
import Dexie, { Table } from "dexie";
import { OutboxItem } from "./types";

export class SchoolOSDatabase extends Dexie {
  outbox!: Table<OutboxItem, string>;

  constructor() {
    super("SchoolOSOfflineDB");
    this.version(1).stores({
      outbox: "id, entityType, timestamp, status",
    });
  }
}

export const localDb = new SchoolOSDatabase();
```

### Step 2: Outbox Dispatcher

Wrap mutations with outbox fallback:

```typescript
export async function submitAttendanceWithSync(records: AttendanceRecord[]) {
  const syncItem: OutboxItem = {
    id: crypto.randomUUID(),
    entityType: "ATTENDANCE",
    action: "CREATE",
    payload: { records },
    timestamp: Date.now(),
    schoolId: currentSchoolId,
    userId: currentUserId,
    status: "PENDING",
    retryCount: 0,
  };

  if (!navigator.onLine) {
    // Save to local IndexedDB
    await localDb.outbox.add(syncItem);
    toast.warning("Saved locally. Will sync when back online.");
    return { success: true, offline: true };
  }

  try {
    // Try sending online
    await sendAttendanceToServer(syncItem);
    return { success: true, offline: false };
  } catch (error) {
    // Network failed mid-request: save to outbox
    await localDb.outbox.add(syncItem);
    toast.warning("Network issue. Saved to offline sync queue.");
    return { success: true, offline: true };
  }
}
```

### Step 3: Background Worker & Event Listener

Runs automatically whenever connection recovers:

```typescript
export function initBackgroundSync() {
  async function flushOutbox() {
    if (!navigator.onLine) return;

    const pendingItems = await localDb.outbox
      .where("status")
      .equals("PENDING")
      .toArray();

    if (pendingItems.length === 0) return;

    for (const item of pendingItems) {
      try {
        await localDb.outbox.update(item.id, { status: "SYNCING" });
        await sendAttendanceToServer(item);
        // Remove once successfully synced
        await localDb.outbox.delete(item.id);
      } catch (err) {
        await localDb.outbox.update(item.id, {
          status: "PENDING",
          retryCount: item.retryCount + 1,
          lastError: String(err),
        });
      }
    }

    toast.success("Offline records synced to cloud!");
  }

  window.addEventListener("online", flushOutbox);
  // Periodic poll every 60 seconds if online
  setInterval(flushOutbox, 60_000);
}
```

---

## 5. Conflict Resolution Guidelines

When data is edited offline and synced later:

1. **Attendance**:
   - **Rule**: _Last-Write-Wins (LWW) by timestamp_.
   - Because attendance is recorded per day, if a record already exists on the server, the newer timestamp replaces the older one.
2. **Fee Receipts**:
   - **Rule**: _Draft Mode_.
   - Offline fee collection saves as `DRAFT_RECEIPT` until validated against invoice balance on the server to prevent over-collection.
3. **Idempotency**:
   - Server endpoint checks `id` (the client UUID). If an attendance record with that UUID was already inserted, it safely ignores duplicate submissions.

---

## 6. Phased Roadmap

| Milestone                     | Scope                         | Deliverables                                                                                                                                     |
| :---------------------------- | :---------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1 (Basic Desktop)**   | Electron Shell & Distribution | • `apps/desktop` setup<br>• Mac Intel, Mac Silicon, Windows builds<br>• Download page buttons with OS detection                                  |
| **Phase 2 (Sync Foundation)** | Offline detection & Outbox UI | • Online/Offline visual indicator badge in UI<br>• Offline fallback screen in Electron<br>• Shared `@schoolos/sync-engine` package with Dexie.js |
| **Phase 3 (Attendance Sync)** | Full Attendance Offline Queue | • Offline attendance submission<br>• Auto-sync on connection restore<br>• Works across Desktop and `teacher-pwa`                                 |
| **Phase 4 (Enterprise Sync)** | Fee Drafts & Local Caching    | • Offline draft fee collection<br>• Local student directory caching for fast search                                                              |
