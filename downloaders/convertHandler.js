const { BrowserWindow, dialog, ipcMain, protocol, shell } = require('electron');
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { graphics } = require("systeminformation");

var win = BrowserWindow.getAllWindows()[0];

var filePaths = {};

ipcMain.on("openVideo", (ev, directPath) =>
{
    if (!directPath)
    {
        var file = dialog.showOpenDialogSync(win, {
            filters: [
                { name: "Downloaded YouTube video", extensions: ["mkv", "webm", "m4a"] }
            ]
        });
    }else{
        var file = [directPath]
    }
    if (file)
    {
        var fileName = path.parse(file[0]).base;
        filePaths[fileName] = file[0];

        ffmpeg.ffprobe(file[0], ['-show_streams'], (err, data) =>
        {
            if (err)
            {
                win.webContents.send("gotVideo", undefined);
            }

            var videoStream = data.streams.find((vid) => vid.codec_type == "video");

            win.webContents.send("gotVideo", {
                path: "video://" + fileName,
                resolution: [videoStream.width, videoStream.height],
                audio: data.streams.find((strm) => strm.codec_type == "audio") !== undefined
            });
        });
    } else
    {
        win.webContents.send("gotVideo", undefined);
    }
});

ipcMain.on("convertVideo", async (ev, vidFile, options) =>
{
    var origExt = path.parse(vidFile).ext;
    var fileLoc = dialog.showSaveDialogSync(win, {
        defaultPath: vidFile.substring(7).replace(origExt, ".mp4"),
        filters: [
            { name: ".mp4", extensions: ["mp4"] },
            { name: ".mov", extensions: ["mov"] },
            { name: ".mkv", extensions: ["mkv"] }
        ]
    });

    if (fileLoc)
    {

        var resolution = options.resolution;
        var audio = options.audio;
        var videoPath = filePaths[vidFile.substring(8)];

        var fps = 0;

        var isHDR = await (() =>
        {
            return new Promise((resolve, reject) =>
            {
                ffmpeg.ffprobe(videoPath, (err, data) =>
                {
                    var vidStream = data.streams.find((strm) => strm.codec_type == "video");

                    //? ffprobe displays framerates as 25/1 or 60/1
                    var fpss = vidStream.avg_frame_rate.split("/");
                    fps = fpss[0] / fpss[1];
                    resolve(vidStream.pix_fmt.replace("yuv420p", "").length > 0);
                });
            });
        })();


        var gpuInfo = await graphics();
        var hasNvidia = gpuInfo.controllers.find((gpu) => gpu.vendor == "NVIDIA") !== undefined;

        var converter = ffmpeg(videoPath);

        converter.stream;

        if (isHDR)
        {
            converter.addOptions([
                "-pix_fmt", "yuv420p10le"
            ]);
        }

        if (process.platform == "win32" && hasNvidia)
        {
            converter.videoCodec(isHDR ? "hevc_nvenc" : "h264_nvenc");
        } else if (process.platform == "darwin")
        {
            converter.videoCodec("h264_videotoolbox");
        } else
        {
            converter.videoCodec("libx264");
        }

        if (!audio)
        {
            converter.noAudio();
        } else
        {
            converter.audioCodec("aac");
        }

        if (resolution > 0)
        {
            converter.videoFilter("scale=-1:" + resolution);
        }

        converter
            .on("end", () =>
            {
                doneConvert(true);
                if (!win.isFocused())
                {
                    win.flashFrame(true);
                }

                ipcMain.once("doneDialogRes", (ev, res) =>
                {
                    if (res)
                    {
                        shell.showItemInFolder(fileLoc);
                    }
                });
            })
            .on("error", (...args) =>
            {
                console.log(...args);
                doneConvert(false);
            })
            .on("progress", (progress) =>
            {
                win.webContents.send("convertProgress", progress.percent, progress.frames, fps);
                win.setProgressBar(progress.percent / 100);
            });

        converter.save(fileLoc);
    } else
    {
        doneConvert(false);
    }

});

protocol.registerFileProtocol('video', (request, callback) =>
{
    const url = filePaths[request.url.substring(8)];
    callback({ path: path.normalize(url) });
});

function doneConvert (success)
{
    var win = BrowserWindow.getAllWindows()[0];
    win.setProgressBar(-1);
    win.webContents.send("convertDone", success);
}