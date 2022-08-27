const { BrowserWindow, dialog, ipcMain, protocol, shell } = require('electron');
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { graphics } = require("systeminformation");
const Stream = require('stream');

var win = BrowserWindow.getAllWindows()[0];

var CanUseGPU;

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
    } else
    {
        var file = [directPath];
    }
    if (file)
    {
        var fileName = path.parse(file[0]).base;
        filePaths[fileName] = file[0];

        ffmpeg.ffprobe(file[0], ['-show_streams'], async (err, data) =>
        {
            if (err)
            {
                win.webContents.send("gotVideo", undefined);
            }

            var videoStream = data.streams.find((vid) => vid.codec_type == "video");

            if (CanUseGPU == undefined)
            {
                CanUseGPU = await testGPU(file[0], videoStream.pix_fmt.replace("yuv420p", "").length > 0);
            }

            var fpss = videoStream.avg_frame_rate.split("/");
            var fps = Math.round(fpss[0] / fpss[1]);

            win.webContents.send("gotVideo", {
                path: "video://" + fileName,
                resolution: [videoStream.width, videoStream.height],
                audio: data.streams.find((strm) => strm.codec_type == "audio") !== undefined,
                GPUusable: CanUseGPU,
                isHDR: videoStream.pix_fmt.replace("yuv420p", "").length > 0,
                fps
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
        var vidCodec = "vp9"
        var aspectRatio = 16/9

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
                    vidCodec = vidStream.codec_name

                    var aspects = vidStream.display_aspect_ratio.split(":");
                    aspectRatio = aspects[0] / aspects[1];

                    resolve(vidStream.pix_fmt.replace("yuv420p", "").length > 0 ? vidStream.pix_fmt : undefined);
                });
            });
        })();


        var gpuInfo = await graphics();
        var hasNvidia = gpuInfo.controllers.find((gpu) => gpu.vendor == "NVIDIA") !== undefined;
        var x264Quality = ["ultrafast", "superfast", "faster", "fast", "medium", "slow", "slower"][options.encodeQuality - 1];

        var converter = ffmpeg(videoPath);

        converter.stream;

        if (isHDR)
        {
            converter.addOptions([
                "-pix_fmt", isHDR
            ]);
        }

        var startTime = Date.now()

        if (process.platform == "win32" && hasNvidia)
        {
            if (CanUseGPU == undefined)
            {
                CanUseGPU = await testGPU(videoPath, isHDR);
            }

            if (CanUseGPU)
            {
                if (vidCodec == "vp9") {
                    converter.addInputOptions(["-c:v", "vp9_cuvid"]);
                }else{
                    converter.addInputOptions(["-c:v", "h264_cuvid"]);
                }

                converter.videoCodec((isHDR) ? "hevc_nvenc" : "h264_nvenc");
                if (options.encodeQuality == 1) {
                    converter.addOptions(["-preset", "hq", "-b:v", "1000K", "-maxrate", "2500K"]);
                }else if(options.encodeQuality == 1){
                    // https://video.stackexchange.com/questions/29659/is-there-a-way-to-improve-h264-nvenc-output-quality
                    converter.addOptions(["-preset", "hq", "-b:v", "2500K", "-maxrate", "1M"]);
                }else{
                    converter.addOptions(["-preset", "hq", "-b:v", "0", "-maxrate", "15M"]);
                }

                if (isHDR) {
                    converter.addOption("-profile:v:0", "main10")
                    converter.addOutputOptions('-metadata:s:v:0', 'master-display="G(13248,34499)B(7500,2999)R(34000,15999)WP(15700,17550)L(10000000,100)"', '-color_range', '1', '-color_trc', 'smpte2084', '-color_primaries', 'bt2020', '-colorspace', '9')
                }
            } else
            {
                converter.videoCodec(isHDR ? "libx265" : "libx264");
                converter.addOptions(["-preset", x264Quality]);
            }
        } else
        {
            converter.videoCodec(isHDR ? "libx265" : "libx264");
            converter.addOptions(["-preset", x264Quality]);
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
            if (CanUseGPU && hasNvidia) {
                var height = resolution * aspectRatio
                converter.addInputOptions(["-resize", `${height}x${resolution}`])
            }else{
                //? Scale to res, fit width. but make width divisable by 2 (required for cpu encoding)
                converter.videoFilters([
                    `scale=w=-2:h=${resolution}`,
                    // "pad=ceil(iw/2)*2:ceil(ih/2)*2"
                ]);
            }
        }

        converter
            .on("end", (...args) =>
            {
                var endTime = Date.now()
                console.log(new Date(endTime - startTime).toLocaleTimeString("nl-NL") + "." + ((endTime - startTime)%1000));
                doneConvert(true);
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
                        shell.showItemInFolder(fileLoc);
                    }
                });
            })
            .on("error", (...args) =>
            {
                console.log(...args);
                doneConvert(false, "An error occured:\n");
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

function doneConvert (success, reason)
{
    var win = BrowserWindow.getAllWindows()[0];
    win.setProgressBar(-1);
    win.webContents.send("convertDone", success, reason);
}

function testGPU (url, isHDR)
{
    //? I test to see if a GPU can be used by encoding 0.1 seconds of the video
    return new Promise((resolve, reject) =>
    {
        const stream = new Stream.Writable();
        stream._write = stream.write;
        ffmpeg(url)
            .inputOptions(["-t", "0.01",/* "-hwaccel", "cuvid",  */"-c:v", "vp9_cuvid"])
            .videoCodec(isHDR ? "hevc_nvenc" : "h264_nvenc")
            .addOptions(isHDR ? ["-pix_fmt", "yuv420p10le"] : [])
            .on("end", (...args) =>
            {
                console.log("b");
                resolve(true);
                stream.destroy();
            })
            .on("error", (...args) =>
            {
                resolve(false);
                stream.destroy();
            })
            .on("progress", (...args) =>
            {
                console.log("a");
                resolve(true);
                stream.destroy();
            })
            .format("avi")
            .stream(stream);
    });
}