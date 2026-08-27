---
title: Webm progress bar issue, analysis and a fix
description: Why it happens, and how to fix it
date: 2019-05-21T15:30:21+08:00
tags:
  - javascript
  - webm
  - ffmpeg
  - chrome
translationKey: webm-progress-bar-problem-and-solution
---

## Intro

When we generate a `webm` with `getUserMedia`, `MediaRecorder`, and similar APIs, the resulting webm cannot seek. Unless you convert it with `FFmpeg` to another format, or wait until the webm finishes playing, then you can drag the progress bar.

## Analysis

After a few hours of digging, it was not a misuse of `MediaRecorder`. Other demos on the web produce the same broken webm.

I first focused on the progress bar, found nothing online, tried all kinds of keywords, still nothing.

Then I thought of analyzing the file with `FFmpeg`. I ran `ffprobe rebirth-demo.webm`:

```sh
$ ffprobe rebirth-demo.webm
ffprobe version 4.1.3 Copyright (c) 2007-2019 the FFmpeg developers
  built with Apple LLVM version 10.0.1 (clang-1001.0.46.4)
  configuration: --prefix=/usr/local/Cellar/ffmpeg/4.1.3_1 --enable-shared --enable-pthreads --enable-version3 --enable-hardcoded-tables --enable-avresample --cc=clang --host-cflags='-I/Library/Java/JavaVirtualMachines/adoptopenjdk-11.0.2.jdk/Contents/Home/include -I/Library/Java/JavaVirtualMachines/adoptopenjdk-11.0.2.jdk/Contents/Home/include/darwin' --host-ldflags= --enable-ffplay --enable-gnutls --enable-gpl --enable-libaom --enable-libbluray --enable-libmp3lame --enable-libopus --enable-librubberband --enable-libsnappy --enable-libtesseract --enable-libtheora --enable-libvorbis --enable-libvpx --enable-libx264 --enable-libx265 --enable-libxvid --enable-lzma --enable-libfontconfig --enable-libfreetype --enable-frei0r --enable-libass --enable-libopencore-amrnb --enable-libopencore-amrwb --enable-libopenjpeg --enable-librtmp --enable-libspeex --enable-videotoolbox --disable-libjack --disable-indev=jack --enable-libaom --enable-libsoxr
  libavutil      56. 22.100 / 56. 22.100
  libavcodec     58. 35.100 / 58. 35.100
  libavformat    58. 20.100 / 58. 20.100
  libavdevice    58.  5.100 / 58.  5.100
  libavfilter     7. 40.101 /  7. 40.101
  libavresample   4.  0.  0 /  4.  0.  0
  libswscale      5.  3.100 /  5.  3.100
  libswresample   3.  3.100 /  3.  3.100
  libpostproc    55.  3.100 / 55.  3.100
Input #0, matroska,webm, from 'rebirth-demo.webm':
  Metadata:
    encoder         : Chrome
  Duration: N/A, start: 0.000000, bitrate: N/A
    Stream #0:0(eng): Audio: opus, 48000 Hz, stereo, fltp (default)
    Stream #0:1(eng): Video: vp8, yuv420p(progressive), 1920x1080, SAR 1:1 DAR 16:9, 60 tbr, 1k tbn, 1k tbc (default)
    Metadata:
      alpha_mode      : 1
```

Here is the key: `Duration` and `bitrate` are both `N/A`, which is wrong. I searched `webm duration` and found plenty of write-ups.

The gist is that `getUserMedia` and `MediaRecorder` do not write `Duration` and `bitrate` into the webm, which causes this.

## Solutions

### 1. Compute duration and assign it to the `blob`

The idea is: record a start time on `start`, subtract it from now on `stop`, and assign that duration to the `blob`. See: [fix-webm-duration](https://github.com/yusitnikov/fix-webm-duration)

### 2. Give the audio element a large duration

While playing the webm, you can dynamically give audio a huge duration. This only works in `chrome` right now. See: [How can I add predefined length to audio recorded from MediaRecorder in Chrome?](https://stackoverflow.com/questions/38443084/how-can-i-add-predefined-length-to-audio-recorded-from-mediarecorder-in-chrome)

### 3. Seek to the end, then back to the start

As above, once the video has played through, seeking works. So you can just seek with `JS`. See: [hello-its-me](https://github.com/common-nighthawk/hello-its-me/blob/master/public/js/message-create.js#L68-L73)

### 4. Fix it with ffmpeg

The first command is: `ffmpeg -i rebirth-demo.webm xixi.webm`, but it is slow, not recommended. A 30 second video takes about 3 minutes.

The second command is: `ffmpeg -i rebirth-demo.webm  -vcodec copy -acodec copy new_rebirth-demo.webm`. This is fast, because it copies instead of converting:

```sh
ffmpeg -i rebirth-demo.webm  -vcodec copy -acodec copy new_rebirth-demo.webm
ffmpeg version 4.1.3 Copyright (c) 2000-2019 the FFmpeg developers
  built with Apple LLVM version 10.0.1 (clang-1001.0.46.4)
  configuration: --prefix=/usr/local/Cellar/ffmpeg/4.1.3_1 --enable-shared --enable-pthreads --enable-version3 --enable-hardcoded-tables --enable-avresample --cc=clang --host-cflags='-I/Library/Java/JavaVirtualMachines/adoptopenjdk-11.0.2.jdk/Contents/Home/include -I/Library/Java/JavaVirtualMachines/adoptopenjdk-11.0.2.jdk/Contents/Home/include/darwin' --host-ldflags= --enable-ffplay --enable-gnutls --enable-gpl --enable-libaom --enable-libbluray --enable-libmp3lame --enable-libopus --enable-librubberband --enable-libsnappy --enable-libtesseract --enable-libtheora --enable-libvorbis --enable-libvpx --enable-libx264 --enable-libx265 --enable-libxvid --enable-lzma --enable-libfontconfig --enable-libfreetype --enable-frei0r --enable-libass --enable-libopencore-amrnb --enable-libopencore-amrwb --enable-libopenjpeg --enable-librtmp --enable-libspeex --enable-videotoolbox --disable-libjack --disable-indev=jack --enable-libaom --enable-libsoxr
  libavutil      56. 22.100 / 56. 22.100
  libavcodec     58. 35.100 / 58. 35.100
  libavformat    58. 20.100 / 58. 20.100
  libavdevice    58.  5.100 / 58.  5.100
  libavfilter     7. 40.101 /  7. 40.101
  libavresample   4.  0.  0 /  4.  0.  0
  libswscale      5.  3.100 /  5.  3.100
  libswresample   3.  3.100 /  3.  3.100
  libpostproc    55.  3.100 / 55.  3.100
Input #0, matroska,webm, from 'rebirth-demo.webm':
  Metadata:
    encoder         : Chrome
  Duration: N/A, start: 0.000000, bitrate: N/A
    Stream #0:0(eng): Audio: opus, 48000 Hz, stereo, fltp (default)
    Stream #0:1(eng): Video: vp8, yuv420p(progressive), 1920x1080, SAR 1:1 DAR 16:9, 60 tbr, 1k tbn, 1k tbc (default)
    Metadata:
      alpha_mode      : 1
Output #0, webm, to 'new_rebirth-demo.webm':
  Metadata:
    encoder         : Lavf58.20.100
    Stream #0:0(eng): Video: vp8, yuv420p(progressive), 1920x1080 [SAR 1:1 DAR 16:9], q=2-31, 60 tbr, 1k tbn, 1k tbc (default)
    Metadata:
      alpha_mode      : 1
    Stream #0:1(eng): Audio: opus, 48000 Hz, stereo, fltp (default)
Stream mapping:
  Stream #0:1 -> #0:0 (copy)
  Stream #0:0 -> #0:1 (copy)
Press [q] to stop, [?] for help
frame= 3589 fps=0.0 q=-1.0 Lsize=    2107kB time=00:01:59.92 bitrate= 143.9kbits/s speed=4.75e+03x
video:2053kB audio:16kB subtitle:0kB other streams:0kB global headers:0kB muxing overhead: 1.849351%

$ ffprobe new_rebirth-demo.webm
ffprobe version 4.1.3 Copyright (c) 2007-2019 the FFmpeg developers
  built with Apple LLVM version 10.0.1 (clang-1001.0.46.4)
  configuration: --prefix=/usr/local/Cellar/ffmpeg/4.1.3_1 --enable-shared --enable-pthreads --enable-version3 --enable-hardcoded-tables --enable-avresample --cc=clang --host-cflags='-I/Library/Java/JavaVirtualMachines/adoptopenjdk-11.0.2.jdk/Contents/Home/include -I/Library/Java/JavaVirtualMachines/adoptopenjdk-11.0.2.jdk/Contents/Home/include/darwin' --host-ldflags= --enable-ffplay --enable-gnutls --enable-gpl --enable-libaom --enable-libbluray --enable-libmp3lame --enable-libopus --enable-librubberband --enable-libsnappy --enable-libtesseract --enable-libtheora --enable-libvorbis --enable-libvpx --enable-libx264 --enable-libx265 --enable-libxvid --enable-lzma --enable-libfontconfig --enable-libfreetype --enable-frei0r --enable-libass --enable-libopencore-amrnb --enable-libopencore-amrwb --enable-libopenjpeg --enable-librtmp --enable-libspeex --enable-videotoolbox --disable-libjack --disable-indev=jack --enable-libaom --enable-libsoxr
  libavutil      56. 22.100 / 56. 22.100
  libavcodec     58. 35.100 / 58. 35.100
  libavformat    58. 20.100 / 58. 20.100
  libavdevice    58.  5.100 / 58.  5.100
  libavfilter     7. 40.101 /  7. 40.101
  libavresample   4.  0.  0 /  4.  0.  0
  libswscale      5.  3.100 /  5.  3.100
  libswresample   3.  3.100 /  3.  3.100
  libpostproc    55.  3.100 / 55.  3.100
Input #0, matroska,webm, from 'new_rebirth-demo.webm':
  Metadata:
    ENCODER         : Lavf58.20.100
  Duration: 00:01:59.96, start: 0.000000, bitrate: 143 kb/s
    Stream #0:0(eng): Video: vp8, yuv420p(progressive), 1920x1080, SAR 1:1 DAR 16:9, 60 tbr, 1k tbn, 1k tbc (default)
    Metadata:
      ALPHA_MODE      : 1
      DURATION        : 00:01:59.928000000
    Stream #0:1(eng): Audio: opus, 48000 Hz, stereo, fltp (default)
    Metadata:
      DURATION        : 00:01:59.955000000
```

No longer broken.

## Wrap-up

I prefer the last one, because the earlier methods do not actually fix it.

This is a **Chrome Bug**. The community is discussing it, but there is still no fix.

Discussion: https://bugs.chromium.org/p/chromium/issues/detail?id=642012
