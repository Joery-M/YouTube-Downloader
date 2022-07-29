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
