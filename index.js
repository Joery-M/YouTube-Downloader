if (require('electron-squirrel-startup')) return app.quit();

const { app, BrowserWindow, dialog, ipcMain, shell, nativeTheme, webFrameMain } = require('electron');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');

const ffmpeg = require('fluent-ffmpeg');
const cp = require('child_process');

const ffmpegPath = require("ffmpeg-static-electron").path;

require("./updater");

function createWindow ()
{
    var win = new BrowserWindow({
        width: 800,
        height: 652,
        minHeight: 515,
        maximizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            devTools: true
        },
        icon: process.platform == "darwin" ? "./icon.icns" : "./icon.ico",
        title: "YouTube Downloader",
        maxHeight: 820,
        autoHideMenuBar: true,
        transparent: true
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
    win.setAspectRatio(1.2071651090342679);

    win.on("focus", () =>
    {
        win.webContents.send("winFocus");
    });

    nativeTheme.themeSource = "system";
}

app.whenReady().then(() =>
{
    createWindow();

    app.on('activate', () =>
    {
        if (BrowserWindow.getAllWindows().length === 0)
        {
            createWindow();
        }
    });
});

app.on('window-all-closed', () =>
{
    app.quit();
});

ipcMain.on("download", async (ev, url, type) =>
{
    var options = {};
    var filters = [
        { name: ".mp4", extensions: ["mp4"] },
    ];
    var win = BrowserWindow.getAllWindows()[0];
    if (type == "audioOnly")
    {
        options = { filter: 'audioonly', quality: "highestaudio" };
        filters = [
            { name: ".mp3", extensions: ["mp3"] },
            { name: ".wav", extensions: ["wav"] },
            { name: ".aac", extensions: ["aac"] },
            { name: ".aiff", extensions: ["aiff"] },
            { name: ".flac", extensions: ["flac"] },
            { name: ".m4a", extensions: ["m4a"] },
            { name: ".ogg, .oga, .mogg", extensions: ["ogg", "oga", "mogg"] },
            { name: ".opus", extensions: ["opus"] },
            { name: ".wma", extensions: ["wma"] },
            { name: ".webm", extensions: ["webm"] }
        ];
    } else if (type == "videoOnly")
    {
        options = { quality: "highestvideo", filter: 'videoonly' };
    } else if (type == "videoAudioHigh")
    {
        downloadVideoAndAudioHigh(ev, url, type, filters);
        return;
    }
    var videoName = (await ytdl.getBasicInfo(url)).videoDetails.title;
    var fileName = dialog.showSaveDialogSync(win, {
        title: 'Download to File…',
        defaultPath: videoName.replace(/[/\\?%*:|"<>]/g, ''),
        filters: filters
    });

    if (fileName)
    {
        const video = ytdl(url, options);

        var lastPercent;
        video.on('progress', async function (info, info2, info3)
        {
            var curPercent = Math.round((info2 / info3) * 100);
            if (lastPercent == curPercent)
            {
                return;
            }
            lastPercent = curPercent;
            sendPercent(curPercent);
        });


        if (type == "audioOnly")
        {
            var stream = fs.createWriteStream("./video.mp3");
        } else
        {
            var stream = fs.createWriteStream(fileName);
        }

        video.pipe(stream).on("finish", () =>
        {
            if (type == "audioOnly")
            {
                var ext = path.parse(fileName).ext;
                var extNoDot = ext.replace(".", "");
                ffmpeg(stream.path)
                    .setFfmpegPath(ffmpegPath)
                    .toFormat(extNoDot)
                    .on('error', (error) =>
                    {
                        console.log(error);

                        fs.rmSync(stream.path);
                    })
                    .on("end", () =>
                    {
                        fs.rmSync(stream.path);

                        if (!win.isFocused())
                        {
                            win.flashFrame(true);
                        }

                        doneDownload(true);

                        ipcMain.once("doneDialogRes", (ev, res) =>
                        {
                            if (res)
                            {
                                var fileLoc = path.parse(fileName).dir;
                                shell.openPath(fileLoc);
                            }
                        });
                    })
                    .on("progress", (progress) =>
                    {
                        sendPercent(Math.round(progress.percent));
                    })
                    .save(fileName);
                return;
            }

            doneDownload(true);

            ipcMain.once("doneDialogRes", (ev, res) =>
            {
                if (res)
                {
                    shell.showItemInFolder(fileName);
                }
            });
        });
    } else
    {
        doneDownload();
    }

});

async function downloadVideoAndAudioHigh (ev, url, type, filters)
{
    var win = BrowserWindow.getAllWindows()[0];
    var videoName = (await ytdl.getBasicInfo(url)).videoDetails.title;
    var fileName = dialog.showSaveDialogSync(win, {
        title: 'Download to File…',
        defaultPath: videoName.replace(/[/\\?%*:|"<>]/g, '-'),
        filters: filters
    });

    if (fileName)
    {
        var audioStream = ytdl(url, { filter: 'audioonly', quality: "highestaudio" });
        var videoStream = ytdl(url, { filter: 'videoonly', quality: "highestvideo" });
        var totalBytes = 0;
        var doneBytes = 0;

        function addToPercent (info)
        {
            doneBytes += info;
            sendPercent(Math.round(doneBytes / totalBytes * 100));
        }
        function setMax (a, b, info3)
        {
            totalBytes += info3;
        }
        audioStream.once("progress", setMax);
        videoStream.once("progress", setMax);
        audioStream.on("progress", addToPercent);
        videoStream.on("progress", addToPercent);

        audioStream.pipe(fs.createWriteStream("./audio.mp3")).on("finish", checkExport);
        videoStream.pipe(fs.createWriteStream("./video.mp4")).on("finish", checkExport);

        var amtDone = 0;
        async function checkExport ()
        {
            amtDone++;
            if (amtDone == 2)
            {
                let ext = path.parse(fileName).ext.replace(".", "");

                ffmpeg()
                    .setFfmpegPath(ffmpegPath)
                    .addInput(`./video.mp4`)
                    .addInput(`./audio.mp3`)
                    .videoCodec(process.platform == "darwin" ? "mpeg4" : "copy")
                    .audioCodec("aac")
                    .toFormat(ext)
                    .on('error', (error, stdout, stderr) =>
                    {
                        console.log(stderr);

                        fs.rmSync("./audio.mp3");
                        fs.rmSync("./video.mp4");

                        doneDownload();
                    })
                    .on('end', function ()
                    {
                        fs.rmSync("./audio.mp3");
                        fs.rmSync("./video.mp4");

                        doneDownload(true);

                        if (!win.isFocused())
                        {
                            win.flashFrame(true);
                        }

                        ipcMain.once("doneDialogRes", (ev, res) =>
                        {
                            if (res)
                            {
                                shell.showItemInFolder(fileName);
                            }
                        });
                    })
                    .on("progress", (progress) =>
                    {
                        sendPercent(Math.round(progress.percent));
                    })
                    .save(fileName);
            }
        }
    } else
    {
        doneDownload();
    }
}

function sendPercent (percent)
{
    var win = BrowserWindow.getAllWindows()[0];
    win.webContents.send("percent", percent);
    win.setProgressBar(percent / 100);
}

function doneDownload (isError)
{
    var win = BrowserWindow.getAllWindows()[0];
    win.setProgressBar(0);
    win.webContents.send("doneDownload", isError);
}