const { BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { doneDownload, sendPercent, ffmpegPath } = require("../index");
// External modules
const ytdl = require('ytdl-core');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require("path");

const formats = {
    "mp3": "mp3",
    "wav": "wav",
    "aac": "aac",
    "m4a": "m4a",
    "opus": "opus",
    "ogg": "vorbis",
    "flac": "flac",
    "alac": "alac"
};

module.exports = async function download (url)
{
    var win = BrowserWindow.getAllWindows()[0];
    var videoInfo = (await ytdl.getBasicInfo(url));
    var videoName = videoInfo.videoDetails.title;

    var fileName = dialog.showSaveDialogSync(win, {
        title: 'Download to File…',
        defaultPath: videoName.replace(/[/\\?%*:|"<>]/g, '-').replace(/[\.…]/g, ""),
        filters: [
            { name: "mp3", extensions: ["mp3"] },
            { name: "wav", extensions: ["wav"] },
            { name: "aac", extensions: ["aac"] },
            { name: "m4a", extensions: ["m4a"] },
            { name: "opus", extensions: ["opus"] },
            { name: "vorbis", extensions: ["ogg"] },
            { name: "flac", extensions: ["flac"] },
            { name: "alac", extensions: ["alac"] },
        ]
    });

    if (!fileName)
    {
        doneDownload(false);
        return;
    }
    var ext = process.platform == "win32" ? ".exe" : "";
    const ytDlpWrap = new YTDlpWrap(path.join(process.resourcesPath, "./yt-dlp" + ext));

    ytDlpWrap.exec([
        url,
        '-x',
        '-f',
        'bestaudio',
        '--ffmpeg-location', ffmpegPath,
        '--audio-format', formats[path.parse(fileName).ext.replace(".", "")],
        '--force-overwrites',
        '--no-mtime',
        '--embed-metadata',
        '-o',
        fileName,
    ])
        .on('progress', (progress) =>
        {
            sendPercent(progress.percent);
        }
        )
        .on('error', (error) =>
        {
            console.log(error);
            if (error.message.includes("another process")) {
                dialog.showErrorBox("This file is being used by another process", "Please close the program to continue")
            }
            doneDownload(false);
        })
        .on('close', () =>
        {
            doneDownload(true);

            if (!win.isFocused())
            {
                win.flashFrame(true);
                setTimeout(() => {
                    win.flashFrame(false)
                }, 2000);
            }

            ipcMain.once("doneDialogRes", (ev, res) =>
            {
                if (res)
                {
                    shell.showItemInFolder(fileName);
                }
            });
        });
};