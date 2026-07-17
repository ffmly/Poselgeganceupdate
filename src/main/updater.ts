import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

export function setUpdater(window: BrowserWindow) {
  autoUpdater.logger = console;
  autoUpdater.checkForUpdates();

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version);
    window.webContents.send('update-available', { version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    window.webContents.send('update-download-progress', {
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[updater] Update downloaded, installing on quit');
    window.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message);
  });
}
