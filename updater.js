const ProgressBar = require("electron-progressbar");
const { dialog, app } = require("electron");
const { BrowserWindow } = require("electron/main");
const {autoUpdater} = require("electron-updater")

autoUpdater.checkForUpdates()

autoUpdater.on('update-available', async (ev) =>
{
    console.log(ev);
    var msg = dialog.showMessageBoxSync(BrowserWindow.getAllWindows()[0], {
        message: `Version: ${info.version}. You're running: ${app.getVersion()}`,
        title: "An update is available! Do you want to download?",
        buttons: ["Yes", "No"],
        noLink: true
    });

    if (msg == 1)
    {
        autoUpdater.downloadUpdateFromRelease(await autoUpdater.getLatestRelease());
        var progressBar = new ProgressBar({
            indeterminate: false,
            text: 'Preparing data...',
            detail: 'Wait...'
        });
        autoUpdater.on('download-progress', (progressObj) =>
        {
            let log_message = `Downloaded ${progressObj.percent}%`;
            progressBar.value += progressObj.transferred / progressObj.total * 100;
            progressBar.detail = log_message;
        });
        autoUpdater.on('update-downloaded', (info) =>
        {
            progressBar.close();
            autoUpdater.quitAndInstall();
        });
        autoUpdater.on('error', (err) =>
        {
            console.log(err);
            progressBar.detail = 'Error in auto-updater. ' + err;
            progressBar.setCompleted();
            progressBar.value = 0;
        });
    }
});

autoUpdater.on('update-not-available', (info) =>
{
    console.log('Update not available.');
});