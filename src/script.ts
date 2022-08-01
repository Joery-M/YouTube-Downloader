import './index.html';
import './stylesheet.scss';
import './mdc.scss';
import { Clipboard } from 'electron';
import { getInfoOptions, videoInfo } from 'ytdl-core';

import { MDCCircularProgress } from "@material/circular-progress";
import { MDCDialog, MDCDialogCloseEvent } from "@material/dialog";
import { MDCLinearProgress } from "@material/linear-progress";
import { MDCRipple } from "@material/ripple";
import { MDCSelect } from "@material/select";
import { MDCTextField } from "@material/textfield";

//@ts-ignore
var clipboard: Clipboard = window.clipboard;

interface formatList
{
    format: string;
    resolution: string;
    fps: string | number;
    hdr: boolean;
}

interface ElectronMain
{
    validateURL: (string: string) => boolean;
    getBasicInfo: (url: string, options?: getInfoOptions | undefined) => Promise<videoInfo>;
    download: (...args: any[]) => void;
    onPercent: (ev: any) => void;
    doneDownload: (ev: any) => void;
    onClipboard: (ev: any) => void;
    dialogResponse: (res: any) => void;
    barDeterminate: (func: Function) => void;
    isDarkMode: () => boolean;
    getFormats: (url: any) => Promise<formatList[]>;
}
//@ts-ignore
var electron: ElectronMain = window.electron;

//@ts-ignore
var os: string = window.os;

document.addEventListener("DOMContentLoaded", () =>
{
    document.body.style.opacity = "1";

    var text = clipboard.readText();
    if (electron.validateURL(text) && textInput.value !== text)
    {
        textInput.value = text;
        preview(text);
    }
});

MDCRipple.attachTo(document.querySelector('#downloadButton'));
const progress = new MDCLinearProgress(document.querySelector("#progressBar"));
const textInput = new MDCTextField(document.querySelector('#ytLink'));
const selectList = new MDCSelect(document.querySelector('#downloadType'));
const qualityList = new MDCSelect(document.querySelector('#qualityType'));
qualityList.disabled = true;
const iframeSpinner = new MDCCircularProgress(document.querySelector('.mdc-circular-progress'));
iframeSpinner.determinate = false;
(iframeSpinner.root as HTMLDivElement).style.display = "none";
const downloadButton: HTMLInputElement = document.querySelector("#downloadButton");

downloadButton.addEventListener("click", download);
(document.querySelector("#ytLink input") as HTMLInputElement).addEventListener("input", (ev) =>
{
    var url = (document.querySelector("#ytLink input") as HTMLInputElement).value;
    preview(url);
});

const endMsg = new MDCDialog(document.querySelector('.mdc-dialog'));
endMsg.listen("MDCDialog:closing", (ev: MDCDialogCloseEvent) =>
{
    electron.dialogResponse(ev.detail.action == "accept");
});


const iframe = document.querySelector("iframe");

electron.onClipboard(() =>
{
    var text = clipboard.readText();
    setTimeout(() =>
    {
        if (electron.validateURL(text) && textInput.value !== text)
        {
            textInput.value = text;
            preview(text);
        }
    }, 100);
});

async function preview (url: string)
{
    if (electron.validateURL(url))
    {
        qualityList.disabled = true;
        downloadButton.disabled = true
        iframe.style.opacity = "0";
        (iframeSpinner.root as HTMLDivElement).style.display = "initial";
        var info = await electron.getBasicInfo(url);
        console.log(info);

        iframe.src = "https://www.youtube.com/embed/" + info.player_response.videoDetails.videoId + "?rel=0";

        await (new Promise<void>((resolve, reject) =>
        {
            var count = 0;
            iframe.addEventListener("load", () =>
            {
                count++;
                if (count == 2)
                {
                    resolve();
                }
            }, { once: true });
            electron.getFormats(url).then((list) =>
            {
                var listElem = qualityList.root.querySelector(".mdc-list");
                listElem.innerHTML = "";
                list.forEach((format, i) =>
                {
                    listElem.innerHTML +=
                        `
                    <li class="mdc-list-item" aria-selected="false" data-value="${format.format}:${format.resolution}:${format.fps}:${format.hdr}" role="option">
                        <span class="mdc-list-item__ripple"></span>
                        <span class="mdc-list-item__text">${format.resolution}</span>
                        <span class="mdc-list-item__secondary-text">&nbsp;${format.fps}fps${format.hdr ? ", HDR" : ""}</span>
                    </li>
                    `;
                });
                qualityList.layoutOptions();
                qualityList.setSelectedIndex(0);
                qualityList.setValue(`${list[0].format}:${list[0].resolution}:${list[0].fps}:${list[0].hdr}`)
                if (selectList.selectedIndex < 2)
                {
                    qualityList.disabled = false;
                }
                count++;
                if (count == 2)
                {
                    resolve();
                }
            });
        }));

        iframe.style.opacity = "1";
        (iframeSpinner.root as HTMLDivElement).style.display = "none";
        downloadButton.disabled = false;
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
        qualityList.disabled = true;
    }
}

selectList.listen("MDCSelect:change", () =>
{
    if (selectList.selectedIndex < 2)
    {
        qualityList.disabled = false;
    } else
    {
        qualityList.disabled = true;
    }
});

var isHandling = false;
var qualityLabel = qualityList.root.querySelector(".mdc-select__selected-text") as HTMLSpanElement
qualityLabel.addEventListener("DOMSubtreeModified", () =>
{
    if (isHandling) {
        return
    }
    isHandling = true;
    var curVal = qualityList.value.split(":")
    var fps = curVal[2]
    var hdr = curVal[3]

    console.log(qualityList.value);
    qualityLabel.innerHTML += ` ${fps}fps`
    if (hdr == "true") {
        qualityLabel.innerHTML += ` HDR`
    }
    isHandling = false;
});

electron.onPercent((_ev, percent: number) =>
{
    progress.determinate = true;
    progress.progress = percent / 100;
});

electron.barDeterminate((ev, isIndeterminate) =>
{
    progress.determinate = !isIndeterminate;
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
    qualityList.disabled = false;
    progress.progress = 0;
});


function download (): void
{
    var url = textInput.value;
    downloadButton.disabled = true;
    textInput.disabled = true;
    selectList.disabled = true;
    qualityList.disabled = true;

    electron.download(url, selectList.value, qualityList.value);
    console.log(qualityList.value);
}