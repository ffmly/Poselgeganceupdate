import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

let mainWindow: BrowserWindow | null = null;
let updateCheckInProgress = false;

export function setUpdater(window: BrowserWindow) {
  mainWindow = window;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes || '',
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] No update available');
    updateCheckInProgress = false;
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available');
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message);
    updateCheckInProgress = false;
    if (mainWindow) {
      mainWindow.webContents.send('update-error', err.message);
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-download-progress', {
        percent: Math.round(progress.percent),
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    }
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[updater] Update downloaded');
    updateCheckInProgress = false;
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded');
    }
  });
}

export async function checkForUpdates(): Promise<{ success: boolean; message: string }> {
  if (updateCheckInProgress) return { success: true, message: 'Already checking' };
  updateCheckInProgress = true;
  try {
    autoUpdater.checkForUpdates();
    return { success: true, message: 'Checking...' };
  } catch (e: any) {
    updateCheckInProgress = false;
    return { success: false, message: e.message };
  }
}

export async function downloadUpdate(): Promise<{ success: boolean; message: string }> {
  try {
    autoUpdater.downloadUpdate();
    return { success: true, message: 'Downloading...' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export function quitAndInstall() {
  setImmediate(() => {
    autoUpdater.quitAndInstall();
  });
}
