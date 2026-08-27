---
title: Webm 进度条问题分析与解决
description: 分析问题出现的原因，并为此寻找相关的解决方案
date: 2019-05-21T15:30:21+08:00
tags:
  - javascript
  - webm
  - ffmpeg
  - chrome
translationKey: webm-progress-bar-problem-and-solution
aliases:
  - /zh/2019/05/21/webm-progress-bar-problem-and-solution/
  - /zh/p/webm-progress-bar-problem-and-solution/
  - /zh/posts/webm进度条问题分析与解决/
---

## 介绍 {#intro}

当我们使用 `getUserMedia`、`MediaRecorder` 等 API 生成的 `webm` 视频时，会发现最终的 webm 是无法拖动进度条的。除非使用 `FFmpeg` 把 webm 转成其他格式的视频文件，或者等 webm 视频播放完后，就可以拖动了。

## 分析 {#analysis}

经过几个小时的排查，发现并不是 `MediaRecorder` 使用有问题，因为在网上找的其他 demo 生成的 webm 也都不行。

一开始把分析点放在了进度条那里，结果在网上没有搜到任何相关文章，尝试了各种关键词都不行。

后来想到，可以使用 `FFmpeg` 来对视频文件进行分析。于是使用 `ffprobe rebirth-demo.webm` 命令进行分析:

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

关键点来了，可以发现其中: `Duration` 和 `bitrate` 的值都是 `N/A`，这是不正常的，于是去搜一下 `webm duration`，果然网上有很多的说明文章。

大体意思是，因为 `getUserMedia`、`MediaRecorder` 在生成 webm 时，并没有提供相关 `Duration` 和 `bitrate`。导致出现这种问题。

## 解决方案 {#solution}

### 一、计算视频长度，分配给 `blob` {#blob-duration}

这种方法的核心就是，在 `start` 开始录制时，记录一个开始时间，然后在 `stop` 停止录制后，把当前时间与记录的开始时间相减，在把时间赋值给 `blob` 来解决这个问题。相关解决方案可见: [fix-webm-duration](https://github.com/yusitnikov/fix-webm-duration)

### 二、通过给 audio 标签一个很大的时间 {#audio-large-time}

在播放 webm 视频时，可以动态的给 audio 一个很大的时间，来解决这个问题，但是目前只针对 `chrome` 有效。相关解决方案可见: [How can I add predefined length to audio recorded from MediaRecorder in Chrome?](https://stackoverflow.com/questions/38443084/how-can-i-add-predefined-length-to-audio-recorded-from-mediarecorder-in-chrome)

### 三、跳到结尾，再跳到开头 {#seek-end-then-start}

因为上文说过，当视频播放完后，就可以拖动了，那么只需要通过 `JS` 来控制当前的视频位置就可以解决了。相关解决方案可见: [hello-its-me](https://github.com/common-nighthawk/hello-its-me/blob/master/public/js/message-create.js#L68-L73)

### 四、通过 ffmpeg 来解决 {#ffmpeg}

第一个解决的命令如下: `ffmpeg -i rebirth-demo.webm xixi.webm`，但是这个命令会很漫长，不太推荐。30 秒的视频，需要花费 3 分钟左右的时间。

第二个命令是: `ffmpeg -i rebirth-demo.webm  -vcodec copy -acodec copy new_rebirth-demo.webm`。这个十分的快，因为本身是直接复制，而不是转化:

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

可见已经没有问题了

## 总结 {#conclusion}

我个人倾向于最后一种，因为前面几个方法并没有实际性解决这个问题。

这个问题，是**Chrome Bug**。目前社区也在讨论，但是到目前为止还没有任何修复的方案。

社区讨论地址: https://bugs.chromium.org/p/chromium/issues/detail?id=642012
