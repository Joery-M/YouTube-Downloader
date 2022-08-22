// Preload (Isolated World)
const { contextBridge, ipcRenderer, clipboard } = require('electron');
const { validateURL, getBasicInfo } = require("ytdl-core");


contextBridge.exposeInMainWorld(
    'downloader',
    {
        validateURL,
        getBasicInfo,
        download: (...args) => ipcRenderer.send("download", ...args),
        onPercent: (ev) => { ipcRenderer.on("percent", ev); },
        doneDownload: (ev) => { ipcRenderer.on("doneDownload", ev); },
        onClipboard: (ev) => { ipcRenderer.on("clipboardChange", ev); },
        dialogResponse: (res) => ipcRenderer.send("doneDialogRes", res),
        barDeterminate: (func) => { ipcRenderer.on("barIndeterminate", func); },
        getFormats: (url) =>
        {
            return new Promise((resolve, reject) =>
            {
                ipcRenderer.send("getFormats", url);
                ipcRenderer.on("vidFormats", (ev, formats) =>
                {
                    resolve(formats);
                });
            });
        }
    }
);
contextBridge.exposeInMainWorld('clipboard', clipboard);

contextBridge.exposeInMainWorld('os', process.platform);

ipcRenderer.on("getHeight", ev =>
{
    if (!document.body)
    {
        document.addEventListener("load", () =>
        {
            ev.sender.send("resize", document.body.clientHeight - 32);
        }, { once: true });
    } else
    {
        ev.sender.send("resize", document.body.clientHeight - 32);
    }
});

contextBridge.exposeInMainWorld(
    'converter',
    {
        openVideo: () => { ipcRenderer.send("openVideo"); },
        openVideoDirect: (path) => { ipcRenderer.send("openVideo", path); },
        onVideoData: (func) =>
        {
            ipcRenderer.on("gotVideo", (ev, file) =>
            {
                func(file);
            });
        },
        convertVideo: (url, format) => { ipcRenderer.send("convertVideo", url, format); },
        onProgress: (ev) => { ipcRenderer.on("convertProgress", ev); },
        onDoneConvert: (ev) => { ipcRenderer.on("convertDone", ev); },
    }
);

ipcRenderer.on("openVideo", (ev, data)=>{
    ipcRenderer.send("openVideo", data)
})