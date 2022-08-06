const { BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { doneDownload, sendPercent, ffmpegPath } = require("../index");
// External modules
const ytdl = require('ytdl-core');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require("path");

var ext = process.platform == "win32" ? ".exe" : "";
const ytDlpWrap = new YTDlpWrap(path.join(process.resourcesPath, "./yt-dlp" + ext));

module.exports = async function download (url, quality)
{
    var win = BrowserWindow.getAllWindows()[0];
    var videoInfo = (await ytdl.getBasicInfo(url));
    var videoName = videoInfo.videoDetails.title;
    quality = quality.split(":")

    var fileName = dialog.showSaveDialogSync(win, {
        title: 'Download to File…',
        defaultPath: videoName.replace(/[/\\?%*:|"<>]/g, '-').replace(/\./g, ""),
        filters: [
            { name: "."+quality[0], extensions: [quality[0]] },
        ]
    });

    if (!fileName)
    {
        doneDownload(false);
        return;
    }

    var hdrRating = quality[3] == "true" ? ",hdr" : ",+hdr"

    ytDlpWrap.exec([
        url,
        '-f', 'bestvideo',
        '-S', `vext:${quality[0]},res:${quality[1].replace("p","")},fps:${quality[2]}${hdrRating}`,
        '--force-overwrites',
        '--ffmpeg-location', ffmpegPath,
        '--no-mtime',
        '-o', fileName
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
        .on('close', async () =>
        {
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
        });
};