# YouTube Downloader

An Electron program to download YouTube videos.

Options:
- Only video
- Only audio
- Video and audio (Low quality, fast)
- Video and audio (High quality, slow)

## Why are there 2 options for audio and video?
YouTube doesn't store videos higher than 360p with audio, so this program combines the audio and video (using ffmpeg) to give you the highest quality. But since this takes a while, I added 2 options.

## Plans for the future
- An option to only get a section of a video.
- A direct resolution option.

# How to build:
 - Run `npm i`.
 - To start using webpack watch, run `npm run watch`.
 - To only build webpack (don't watch), run `npm run buildApp`.
 - Run `npm start` to start electron-forge.
 - Run `npm run makeWin` to make a Windows binary.
 - Run `npm run makeMac` to make a Mac binary.
