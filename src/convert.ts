import { MDCRipple } from '@material/ripple';
import { MDCFormField } from '@material/form-field';
import { MDCCheckbox } from '@material/checkbox';
import { MDCSelect } from '@material/select';
import { MDCLinearProgress } from "@material/linear-progress";

import { endMsg, tabBar } from './script';

const selectableRes = [144, 240, 360, 480, 720, 1080, 1440, 2160];

const videoElem = document.querySelector("#previewVid") as HTMLVideoElement;
const openButtonRipple = new MDCRipple(document.querySelector('#openVideo'));
const convertButtonRipple = new MDCRipple(document.querySelector('#convertVideo'));
const progress = new MDCLinearProgress(document.querySelector("#progressBarConvert"));
const audioCheck = new MDCCheckbox(document.querySelector('#audioCheck'));
const resolutionSelect = new MDCSelect(document.querySelector("#convertResolution"));
const formField = new MDCFormField(document.querySelector('.mdc-form-field'));
formField.input = audioCheck;

audioCheck.disabled = true;
resolutionSelect.disabled = true;
convertButtonRipple.disabled = true;
convertButtonRipple.root.setAttribute("disabled", "");

interface videoInfo
{
    path?: string;
    resolution: (number)[];
    audio: boolean;
}
interface Converter
{
    openVideo: () => Promise<videoInfo>;
    openVideoDirect: (path: string) => void;
    onVideoData: (func: Function) => void;
    convertVideo: (url: string, options: videoInfo) => void;
    onProgress: (ev: Function) => void;
    onDoneConvert: (ev: Function) => void;
}

//@ts-ignore
const converter: Converter = window.converter;

//@ts-ignore
var os: string = window.os;

document.addEventListener("mouseup", () =>
{
    (convertButtonRipple.root as HTMLButtonElement).blur();
    (openButtonRipple.root as HTMLButtonElement).blur();
});

openButtonRipple.listen("click", async () =>
{
    openButtonRipple.disabled = true;
    openButtonRipple.root.setAttribute("disabled", "");
    converter.openVideo();
});
converter.onVideoData((file: videoInfo) =>
{
    if (file)
    {
        videoElem.src = file.path;

        videoElem.addEventListener("loadeddata", () =>
        {
            videoElem.currentTime = 0;
        });

        if (file.audio)
        {
            audioCheck.disabled = false;
            audioCheck.indeterminate = false;
            audioCheck.checked = true;
        } else
        {
            audioCheck.indeterminate = true;
            audioCheck.disabled = true;
        }

        //? get closest
        var closest = selectableRes.reduce(function (prev, curr)
        {
            return (Math.abs(curr - file.resolution[1]) < Math.abs(prev - file.resolution[1]) ? curr : prev);
        });
        var availableRes = selectableRes.filter((res) => res <= closest).reverse();
        var list = resolutionSelect.root.querySelector(".mdc-list");
        list.innerHTML = "";

        availableRes.forEach((res, i) =>
        {
            var subtext = "";
            if (i == 0)
            {
                subtext = '<span class="mdc-list-item__secondary-text">(Original)</span>';
            }
            list.innerHTML +=
                `
            <li class="mdc-list-item" aria-selected="false" data-value="${i == 0 ? -1 : res}" role="option">
                <span class="mdc-list-item__ripple"></span>
                <span class="mdc-list-item__text">${res}p</span>
                ${subtext}
            </li>
            `;
        });

        resolutionSelect.layoutOptions();
        resolutionSelect.setSelectedIndex(0);
        resolutionSelect.disabled = false;

        openButtonRipple.disabled = false;
        openButtonRipple.root.removeAttribute("disabled");

        convertButtonRipple.disabled = false;
        convertButtonRipple.root.removeAttribute("disabled");
    } else
    {
        openButtonRipple.disabled = false;
        openButtonRipple.root.removeAttribute("disabled");
    }
});

resolutionSelect.listen("MDCSelect:change", () =>
{
    console.log(resolutionSelect.value);
});


convertButtonRipple.listen("click", () =>
{
    openButtonRipple.disabled = true;
    openButtonRipple.root.setAttribute("disabled", "");
    convertButtonRipple.disabled = true;
    convertButtonRipple.root.setAttribute("disabled", "");

    resolutionSelect.disabled = true;
    audioCheck.disabled = true;

    var res: any[] = resolutionSelect.value.split(":");
    res.forEach((num, i) =>
    {
        res[i] = parseFloat(num.toString());
    });

    const videoElem = document.querySelector("#previewVid") as HTMLVideoElement;

    converter.convertVideo(videoElem.src, {
        audio: audioCheck.checked,
        resolution: res
    });
});

var frameLoaded = true;
converter.onProgress((_ev: any, percent: number, frame: number, fps: number) =>
{
    progress.determinate = true;
    progress.progress = percent / 100;

    videoElem.controls = false;
    if (frameLoaded)
    {
        frameLoaded = false;
        videoElem.currentTime = frame / fps;
        videoElem.addEventListener("seeked", () =>
        {
            frameLoaded = true;
        }, { once: true });
    }
});

converter.onDoneConvert((_ev: any, wasSuccess: boolean) =>
{
    if (wasSuccess)
    {
        endMsg.open();
    }

    openButtonRipple.disabled = false;
    openButtonRipple.root.removeAttribute("disabled");
    convertButtonRipple.disabled = false;
    convertButtonRipple.root.removeAttribute("disabled");
    resolutionSelect.disabled = false;
    audioCheck.disabled = false;

    progress.progress = 0;
    videoElem.currentTime = 0;
    videoElem.controls = true;
});


//? Handle file drag and drop
document.addEventListener("DOMContentLoaded", () =>
{
    var dragTimer: NodeJS.Timeout;
    var regex = /video\/(webm|mov|mkv)/;

    var dropzone = document.querySelector("#fileCatcher") as HTMLDivElement;
    window.addEventListener("dragover", (ev) =>
    {
        ev.preventDefault();
        if (ev.dataTransfer.items[0] && regex.test(ev.dataTransfer.items[0].type))
        {
            dropzone.classList.add("droppable");
            dropzone.style.pointerEvents = "all";

            clearTimeout(dragTimer);
        }
    });

    window.addEventListener("dragleave", (ev) =>
    {
        dragTimer = setTimeout(() =>
        {
            dropzone.classList.remove("droppable");
            dropzone.style.pointerEvents = "none";
        }, 25);
    });

    window.addEventListener("drop", (ev) =>
    {
        if (ev.dataTransfer.items[0] && regex.test(ev.dataTransfer.items[0].type))
        {

            dropzone.style.pointerEvents = "none";
            ev.preventDefault();
            dropzone.classList.remove("droppable");
            tabBar.activateTab(1);

            var path = ev.dataTransfer.items[0].getAsFile().path;
            converter.openVideoDirect(path);
        }
    });
});