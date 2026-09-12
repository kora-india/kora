import { app, BrowserWindow, shell, ipcMain, Menu } from "electron";
import * as path from "path";
import * as http from "http";
import * as https from "https";

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

const IS_DEV = process.env.NODE_ENV === "development" || !app.isPackaged;
const BASE_URL =
  process.env.APP_URL ||
  (IS_DEV ? "http://localhost:3000" : "https://kora-admin-web.vercel.app");
// Direct to /login so the landing page is completely bypassed
const LOGIN_URL = `${BASE_URL}/login`;

const MIN_SPLASH_DISPLAY_MS = 1400; // Ensures smooth, non-flickering splash experience
const splashStartTime = Date.now();

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 340,
    frame: false,
    resizable: false,
    center: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: "#09090b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const splashPath = path.join(__dirname, "splash.html");
  splashWindow.loadFile(splashPath).catch(() => {
    splashWindow?.loadFile(path.join(__dirname, "../src/splash.html"));
  });

  splashWindow.once("ready-to-show", () => {
    splashWindow?.show();
  });

  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

function checkServerAvailability(urlStr: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(urlStr);
      const client = parsedUrl.protocol === "https:" ? https : http;
      const req = client.get(urlStr, { timeout: 3000 }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

async function connectToApp() {
  if (!mainWindow) return;

  let isOnline = await checkServerAvailability(LOGIN_URL);

  if (IS_DEV) {
    let retries = 0;
    while (!isOnline && retries < 60) {
      retries++;
      if (retries === 1 || retries % 5 === 0) {
        console.log(
          `[Kora Desktop] Waiting for Next.js server at ${LOGIN_URL}... (Make sure 'pnpm dev' is running)`,
        );
      }
      await new Promise((r) => setTimeout(r, 1500));
      isOnline = await checkServerAvailability(LOGIN_URL);
    }
  }

  if (!isOnline) {
    // Show offline page
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      const offlinePath = path.join(__dirname, "offline.html");
      mainWindow.loadFile(offlinePath).catch(() => {
        mainWindow?.loadFile(path.join(__dirname, "../src/offline.html"));
      });
      mainWindow.show();
    }
    return;
  }

  // Server is reachable! Load the app
  mainWindow.loadURL(LOGIN_URL);

  mainWindow.webContents.once("did-finish-load", () => {
    const elapsed = Date.now() - splashStartTime;
    const remainingDelay = Math.max(0, MIN_SPLASH_DISPLAY_MS - elapsed);

    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    }, remainingDelay);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: "Kora",
    show: false,
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      if (url.startsWith(BASE_URL)) {
        return { action: "allow" };
      }
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  connectToApp();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.on("app:reload", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(LOGIN_URL);
  }
});

ipcMain.handle("app:version", () => {
  return app.getVersion();
});

// App Lifecycle
app.whenReady().then(() => {
  createSplashWindow();
  createMainWindow();

  // Create Application Menu
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: "Kora",
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" as const },
        { role: "redo" as const },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        { role: "selectAll" as const },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" as const },
        { role: "forceReload" as const },
        ...(IS_DEV ? [{ role: "toggleDevTools" as const }] : []),
        { type: "separator" as const },
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" as const },
        { role: "zoom" as const },
        ...(process.platform === "darwin"
          ? [
              { type: "separator" as const },
              { role: "front" as const },
              { type: "separator" as const },
              { role: "window" as const },
            ]
          : [{ role: "close" as const }]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createSplashWindow();
    createMainWindow();
  }
});
