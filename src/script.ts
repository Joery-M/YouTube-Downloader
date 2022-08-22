import './index.html';
import './stylesheet.scss';
import './mdc.scss';
import './convert';
import { Clipboard } from 'electron';
import { getInfoOptions, videoInfo } from 'ytdl-core';

import { MDCCircularProgress } from "@material/circular-progress";
import { MDCDialog, MDCDialogCloseEvent } from "@material/dialog";
import { MDCLinearProgress } from "@material/linear-progress";
import { MDCRipple } from "@material/ripple";
import { MDCSelect } from "@material/select";
import { MDCTextField } from "@material/textfield";
import { MDCTabBar } from '@material/tab-bar';
import { MDCTopAppBar } from '@material/top-app-bar';

//@ts-ignore
var clipboard: Clipboard = window.clipboard;

interface formatList
{
    format: string;
    resolution: string;
    fps: string | number;
    hdr: boolean;
    size?: number;
    audioSize?: number
}

interface DownloaderInterface
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
var downloader: DownloaderInterface = window.downloader;

//@ts-ignore
var os: string = window.os;

document.querySelector("#FileSystem").innerHTML = os == "darwin" ? "Finder" : "File Explorer";

document.addEventListener("DOMContentLoaded", () =>
{
    document.body.style.opacity = "1";

    var text = clipboard.readText();
    if (downloader.validateURL(text) && textInput.value !== text)
    {
        textInput.value = text;
        preview(text);
    }
});


export const tabBar = new MDCTabBar(document.querySelector('.mdc-tab-bar'));
const topAppBarElement = document.querySelector('.mdc-top-app-bar');
const topAppBar = new MDCTopAppBar(topAppBarElement);

MDCRipple.attachTo(document.querySelector('#downloadButton'));
const progress = new MDCLinearProgress(document.querySelector("#progressBar"));
const textInput = new MDCTextField(document.querySelector('#ytLink'));
const selectList = new MDCSelect(document.querySelector('#downloadType'));
const qualityList = new MDCSelect(document.querySelector('#qualityType'));
qualityList.disabled = true;
const iframeSpinner = new MDCCircularProgress(document.querySelector('.mdc-circular-progress'));
iframeSpinner.determinate = false;
(iframeSpinner.root as HTMLDivElement).style.display = "none";
const downloadButton: HTMLButtonElement = document.querySelector("#downloadButton");

downloadButton.addEventListener("click", download);
(document.querySelector("#ytLink input") as HTMLInputElement).addEventListener("input", (ev) =>
{
    var url = (document.querySelector("#ytLink input") as HTMLInputElement).value;
    preview(url);
});

export const endMsg = new MDCDialog(document.querySelector('.mdc-dialog'));
endMsg.listen("MDCDialog:closing", (ev: MDCDialogCloseEvent) =>
{
    if (ev.detail.action == "OpenVid") {
        downloader.dialogResponse("OpenVid")
        endMsg.close()
        tabBar.activateTab(1);
        return
    }
    downloader.dialogResponse(ev.detail.action == "accept");
});

const iframe = document.querySelector("iframe");

downloader.onClipboard(() =>
{
    var text = clipboard.readText();
    setTimeout(() =>
    {
        if (downloader.validateURL(text) && textInput.value !== text)
        {
            textInput.value = text;
            preview(text);
        }
    }, 100);
});

async function preview (url: string)
{
    if (downloader.validateURL(url))
    {
        //? Move tab
        tabBar.activateTab(0)

        qualityList.disabled = true;
        downloadButton.disabled = true;
        iframe.style.opacity = "0";
        (iframeSpinner.root as HTMLDivElement).style.display = "initial";

        var info = await downloader.getBasicInfo(url);

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
            downloader.getFormats(url).then((list) =>
            {
                if (list.length == 0)
                {
                    (iframeSpinner.root as HTMLDivElement).style.display = "none";
                    return;
                }

                var Audiosize = parseFloat(list[0].audioSize.toString()) ?? 0;
                var listElem = qualityList.root.querySelector(".mdc-list");
                listElem.innerHTML = "";
                list.forEach((format, i) =>
                {
                    var combinedSize = parseFloat(format.size.toString() ?? "0") + Audiosize
                    var size = format.size ? `<span class="sizeWithoutAudio" style="display:none;">${bytesToSize(format.size)}</span> <span class="sizeWithAudio">${bytesToSize(combinedSize)}</span>` : "";
                    listElem.innerHTML +=
                        `
                    <li class="mdc-list-item" aria-selected="false" data-value="${format.format}:${format.resolution}:${format.fps}:${format.hdr}" role="option">
                        <span class="mdc-list-item__ripple"></span>
                        <span class="mdc-list-item__text">${format.resolution}</span>
                        <span class="mdc-list-item__secondary-text">${format.fps}fps${format.hdr ? ", HDR" : ""}</span>
                        <span class="mdc-list-item__secondary-text">${size}</span>
                    </li>
                    `;
                });
                qualityList.layoutOptions();
                qualityList.setSelectedIndex(0);
                qualityList.setValue(`${list[0].format}:${list[0].resolution}:${list[0].fps}:${list[0].hdr}`);
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
    if (downloadButton.disabled)
    {
        return;
    }
    if (selectList.selectedIndex < 2)
    {
        qualityList.disabled = false;

        //? file size preview
        if (selectList.selectedIndex == 0) {
            document.querySelectorAll(".sizeWithoutAudio").forEach((elem: HTMLSpanElement)=>{
                elem.style.display = "none"
            })
            document.querySelectorAll(".sizeWithAudio").forEach((elem: HTMLSpanElement)=>{
                elem.style.display = "initial"
            })
        }else{
            document.querySelectorAll(".sizeWithoutAudio").forEach((elem: HTMLSpanElement)=>{
                elem.style.display = "initial"
            })
            document.querySelectorAll(".sizeWithAudio").forEach((elem: HTMLSpanElement)=>{
                elem.style.display = "none"
            })
        }
    } else
    {
        qualityList.disabled = true;
    }
});

var isHandling = false;
var qualityLabel = qualityList.root.querySelector(".mdc-select__selected-text") as HTMLSpanElement;
qualityLabel.addEventListener("DOMSubtreeModified", () =>
{
    if (isHandling)
    {
        return;
    }
    isHandling = true;
    var curVal = qualityList.value.split(":");
    var fps = curVal[2];
    var hdr = curVal[3];

    qualityLabel.innerHTML += ` ${fps}fps`;
    if (hdr == "true")
    {
        qualityLabel.innerHTML += ` HDR`;
    }
    isHandling = false;
});

var secondPage = localStorage.getItem("page") == "1" || false;
var wrapper = document.querySelector("#wrapper") as HTMLDivElement;
topAppBar.listen("MDCTabBar:activated", (ev) =>
{
    secondPage = !secondPage;
    localStorage.setItem("page", secondPage ? "1" : "0");
    wrapper.classList.toggle("slide");
});
if (secondPage == true)
{
    //? Avoid the transition
    var transition = wrapper.style.transition;
    wrapper.style.transition = "unset";

    secondPage = !secondPage;
    localStorage.setItem("page", "1");
    (document.querySelector(".mdc-tab:nth-of-type(2)") as HTMLButtonElement).click();
    setTimeout(() =>
    {
        wrapper.style.transition = transition;
    }, 0);
}

downloader.onPercent((_ev, percent: number) =>
{
    progress.determinate = true;
    progress.progress = percent / 100;
});

downloader.barDeterminate((ev, isIndeterminate) =>
{
    progress.determinate = !isIndeterminate;
});


downloader.doneDownload((_ev, wasSuccess: boolean) =>
{
    if (wasSuccess)
    {
        if (!endMsg.root.querySelector("#KillMe")) {
            endMsg.root.querySelector(".mdc-dialog__title").innerHTML = "Download done!"
            var openConvertButton = document.createElement("button")
            openConvertButton.classList.add("mdc-button", "mdc-dialog__button", "mdc-ripple-upgraded")
            openConvertButton.id = "KillMe"
            openConvertButton.setAttribute("data-mdc-dialog-action", "OpenVid")
            openConvertButton.innerHTML =`
            <div class="mdc-button__ripple"></div>
            <span class="mdc-button__label">
            Open in converter
            </span>`
            endMsg.root.querySelector(".mdc-dialog__actions").insertBefore(openConvertButton, endMsg.root.querySelector(".mdc-dialog__actions").children[0])
        }
        if (selectList.value == "audioOnly") {
            if (endMsg.root.querySelector("#KillMe")) {
                endMsg.root.querySelector("#KillMe").remove()
            }
        }
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

    downloader.download(url, selectList.value, qualityList.value);
}

function bytesToSize (bytes: number)
{
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', "EB"];
    if (bytes == 0) return '0 Byte';
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    var bytesWorded = (bytes / Math.pow(1024, i));
    return bytesWorded.toFixed(bytesWorded >= 100 ? 1 : 2) + ' ' + sizes[i];
}