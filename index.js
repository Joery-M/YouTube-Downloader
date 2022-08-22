const { app, BrowserWindow, ipcMain, nativeTheme, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const YTDlpWrap = require('yt-dlp-wrap').default;
const clipboardListener = require('clipboard-event');

if (require('electron-squirrel-startup')) return app.quit();

const ffmpeg = require('fluent-ffmpeg');
const ytdl = require('ytdl-core');

if (process.platform == "darwin" && process.mainModule.filename.indexOf('app.asar') == -1)
{
    app.disableHardwareAcceleration();
    console.log("Disabled hardware acceleration");
}

var ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace('app.asar', 'app.asar.unpacked');
var ffprobePath = require('@ffprobe-installer/ffprobe').path.replace('app.asar', 'app.asar.unpacked');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

require("./updater");
clipboardListener.startListening();

function createWindow ()
{
    var win = new BrowserWindow({
        width: 800,
        height: 652,
        minHeight: 566,
        maximizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            devTools: true,
            backgroundThrottling: false,
            sandbox: false,
        },
        backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1c1c' : "#ffffff",
        icon: process.platform == "darwin" ? "./icon.icns" : "./icon.ico",
        title: "YouTube Downloader",
        autoHideMenuBar: true
    });

    win.loadFile('./app/index.html').then(() =>
    {
        win.on('show', () =>
        {
            setTimeout(() =>
            {
                win.focus();
            }, 200);
        });
        win.show();
    });

    win.on("resize", () =>
    {
        win.webContents.send("getHeight");
    });
    win.setAspectRatio(785 / 660);

    clipboardListener.on('change', () =>
    {
        win.webContents.send("clipboardChange");
    });

    if (process.platform == "darwin")
    {
        win.on("focus", () =>
        {
            win.webContents.send("clipboardChange");
        });
    }

    nativeTheme.themeSource = "system";
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock)
{
    app.quit();
} else
{
    app.on('second-instance', () =>
    {
        // Someone tried to run a second instance, we should focus our window.
        var myWindow = BrowserWindow.getAllWindows()[0];
        if (myWindow)
        {
            if (myWindow.isMinimized()) myWindow.restore();
            myWindow.focus();
        }
    });

    // Create myWindow, load the rest of the app, etc...
    app.whenReady().then(() =>
    {
        createWindow();

        // Start convert handler script
        require("./downloaders/convertHandler");

        // Download yt-dlp
        var ext = process.platform == "win32" ? ".exe" : "";
        if (!fs.existsSync(path.join(process.resourcesPath, "./yt-dlp" + ext)))
        {
            YTDlpWrap.downloadFromGithub(path.join(process.resourcesPath, "./yt-dlp" + ext)).then(() =>
            {
            }).catch((err) =>
            {
                console.log(err.statusMessage);
                dialog.showErrorBox("An error occured downloading yt-dlp!", err.statusCode + ": " + err.statusMessage);
            });
        }

        app.on('activate', () =>
        {
            if (BrowserWindow.getAllWindows().length === 0)
            {
                createWindow();
            }
        });
    });
}

app.on('window-all-closed', () =>
{
    app.quit();
});

ipcMain.on("download", async (ev, url, type, quality) =>
{
    if (type == "audioOnly")
    {
        require("./downloaders/audioDownloader")(url);
    } else if (type == "videoOnly")
    {
        require("./downloaders/videoDownloader")(url, quality);
    } else if (type == "videoAudio")
    {
        require("./downloaders/VAdownloader")(url, quality);
        return;
    }

});

ipcMain.on("getFormats", async (ev, url) =>
{
    var formatList = [];

    ytdl.getInfo(url).then((info) =>
    {
        var audioFormats = info.formats.filter((format) =>
        {
            return !format.hasVideo && format.hasAudio && format.contentLength;
        });
        audioFormats = audioFormats.sort((a, b) =>
        {
            var aQ = a.audioBitrate;
            var bQ = b.audioBitrate;
            return bQ - aQ;
        });

        var formats = info.formats.filter((format) =>
        {
            return format.hasVideo && !format.hasAudio && !format.isDashMPD && !format.videoCodec.includes("avc1") && !format.videoCodec.includes("av01");
        });
        formats = formats.sort((a, b) =>
        {
            var aHDR = a.colorInfo ? parseFloat((a.colorInfo.primaries ?? "0").replace("COLOR_PRIMARIES_BT", "")) : 0;
            var bHDR = b.colorInfo ? parseFloat((b.colorInfo.primaries ?? "0").replace("COLOR_PRIMARIES_BT", "")) : 0;
            var aQ = parseFloat(a.bitrate);
            var bQ = parseFloat(b.bitrate);
            return bHDR - aHDR || bQ - aQ;
        });
        formats.forEach((format) =>
        {
            formatList.push({
                format: format.container,
                resolution: format.qualityLabel.replace(/p.*/, "p"),
                fps: format.fps,
                hdr: format.qualityLabel.includes("HDR"),
                size: format.contentLength,
                audioSize: audioFormats[0].contentLength
            });
        });
        ev.sender.send("vidFormats", formatList);
    });

});

function sendPercent (percent)
{
    var win = BrowserWindow.getAllWindows()[0];
    win.webContents.send("percent", percent);
    win.setProgressBar(percent / 100);
}

function doneDownload (isError)
{
    var win = BrowserWindow.getAllWindows()[0];
    win.setProgressBar(-1);
    win.webContents.send("doneDownload", isError);
}
module.exports = {
    sendPercent,
    doneDownload,
    ffmpegPath,
    ffprobePath
};