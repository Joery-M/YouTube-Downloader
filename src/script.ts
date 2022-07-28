import './index.html';
import './stylesheet.scss';
import './mdc.scss';
import { ripple, linearProgress, textField, select, circularProgress, dialog } from 'material-components-web';
import { Clipboard } from 'electron';
import * as ytdl from 'ytdl-core';

//@ts-ignore
var clipboard: Clipboard = window.clipboard;

interface ElectronMain
{
    validateURL: (string: string) => boolean;
    getBasicInfo: (url: string, options?: ytdl.getInfoOptions | undefined) => Promise<ytdl.videoInfo>;
    download: (...args: any[]) => void;
    onPercent: (ev: any) => void;
    doneDownload: (ev: any) => void;
    onFocus: (ev: any) => void;
    dialogResponse: (res: any) => void;
}
//@ts-ignore
var electron: ElectronMain = window.electron;

//@ts-ignore
var os: string = window.os;

document.addEventListener("DOMContentLoaded", () =>
{
    document.body.style.opacity = "1";
});

ripple.MDCRipple.attachTo(document.querySelector('#downloadButton'));
const progress = new linearProgress.MDCLinearProgress(document.querySelector("#progressBar"));
const textInput = new textField.MDCTextField(document.querySelector('#ytLink'));
const selectList = new select.MDCSelect(document.querySelector('.mdc-select'));
const iframeSpinner = new circularProgress.MDCCircularProgress(document.querySelector('.mdc-circular-progress'));
iframeSpinner.determinate = false;
(iframeSpinner.root as HTMLDivElement).style.display = "none";
const downloadButton: HTMLInputElement = document.querySelector("#downloadButton");

downloadButton.addEventListener("click", download);
(document.querySelector("#ytLink input") as HTMLInputElement).addEventListener("input", (ev)=>{
    var url = (document.querySelector("#ytLink input") as HTMLInputElement).value
    preview(url)
})

const endMsg = new dialog.MDCDialog(document.querySelector('.mdc-dialog'));
endMsg.listen("MDCDialog:closing", (ev: dialog.MDCDialogCloseEvent) =>
{
    electron.dialogResponse(ev.detail.action == "accept");
});


const iframe = document.querySelector("iframe");

var text = clipboard.readText();
if (electron.validateURL(text) && textInput.value !== text)
{
    textInput.value = text;
    preview(text);
}
electron.onFocus(() =>
{
    var text = clipboard.readText();
    if (electron.validateURL(text) && textInput.value !== text)
    {
        textInput.value = text;
        preview(text);
    }
});

async function preview (url: string)
{
    if (electron.validateURL(url))
    {
        iframe.style.opacity = "0";
        (iframeSpinner.root as HTMLDivElement).style.display = "initial";
        var info = await electron.getBasicInfo(url);
        console.log(info);

        iframe.src = "https://www.youtube.com/embed/" + info.player_response.videoDetails.videoId + "?rel=0";
        iframe.addEventListener("load", () =>
        {
            iframe.style.opacity = "1";
            (iframeSpinner.root as HTMLDivElement).style.display = "none";
            downloadButton.disabled = false;
        }, { once: true });
    } else
    {
        iframe.style.opacity = "0";
        setTimeout(() =>
        {
            if (iframe.style.opacity == "0")
            {
                iframe.src = "";
            }
        }, 200);
        downloadButton.disabled = true;
    }
}

document.querySelector("#demo-selected-text").innerHTML += " (Low)";

document.querySelectorAll(".mdc-list-item").forEach((elem) =>
{
    elem.addEventListener("click", () =>
    {
        setTimeout(() =>
        {
            if (selectList.selectedIndex == 0)
            {
                document.querySelector("#demo-selected-text").innerHTML += " (Low)";
            } else if (selectList.selectedIndex == 1)
            {
                document.querySelector("#demo-selected-text").innerHTML += " (High)";
            }
        }, 0);
    });
});

electron.onPercent((_ev, percent: number) =>
{
    progress.progress = percent / 100;
});

electron.doneDownload((_ev, wasSuccess: boolean) =>
{
    if (wasSuccess)
    {
        document.querySelector("#FileSystem").innerHTML = os == "darwin" ? "Finder" : "File Explorer";
        endMsg.open();
    }
    downloadButton.disabled = false;
    textInput.disabled = false;
    selectList.disabled = false;
    progress.progress = 0;
});


function download (): void
{
    var url = textInput.value;
    downloadButton.disabled = true;
    textInput.disabled = true;
    selectList.disabled = true;

    electron.download(url, selectList.value);
}