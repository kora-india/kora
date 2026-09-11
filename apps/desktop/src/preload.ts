import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("koraBridge", {
  isDesktop: true,
  platform: process.platform,
  reloadApp: () => ipcRenderer.send("app:reload"),
  getAppVersion: () => ipcRenderer.invoke("app:version"),
});
