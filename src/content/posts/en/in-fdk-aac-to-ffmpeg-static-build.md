---
title: From the fdk_aac encoder to automated static FFmpeg builds
description: Integrating the libfdk_aac encoder into FFmpeg, and using a free gitlab-runner to automatically statically compile FFmpeg
date: 2019-07-15T10:20:57+08:00
tags:
  - ffmpeg
translationKey: in-fdk-aac-to-ffmpeg-static-build
---

## Intro

I have been doing some video-processing tasks at work, and ran into a requirement to extract the audio from an MP4 into AAC.

My first thought was that it was simple: just `ffmpeg -i source.mp4 -vn -acodec copy sound.aac`.

That turned out to be wrong. The AAC `duration` and the MP4 `duration` were completely different. See:

![](/images/in_fdk_aac_to_ffmpeg_static_build/ffprobe-duration-mismatch.png)

I also tried the methods on the internet, but none of them fixed it.

## Analysis / fix

After testing, I found that different bit rates produced different AAC Duration values.

But how was I supposed to know what the bit rate was? So I traced it from the start.

First, the MP4 came from Webm, and the Webm video came from [MediaRecorder](https://developer.mozilla.org/zh-CN/docs/Web/API/MediaRecorder/MediaRecorder).

I looked at the `MediaRecorder API` again and found this property:

- `audioBitsPerSecond`: specifies the audio bit rate

OK, found it. I changed the code, added the `audioBitsPerSecond` property on the `MediaRecorder` interface, and set it to `128000`, which is `128K`.

Then I converted with the command below and checked the result:

```bash
ffmpeg -i source.mp4 -vn -acodec aac -b:a 128k -y sound.aac
```

That did not improve things...

![](/images/in_fdk_aac_to_ffmpeg_static_build/ffprobe-duration-128k.png)

Then I wondered whether, even with a constant bit rate, there was still some drift, so I changed `128k` to `200k` and tried:

![](/images/in_fdk_aac_to_ffmpeg_static_build/ffmpeg-aac-200k.png)

Not only did it not fix it, it increased `duration` even more.

When I was close to giving up, [rurico](https://github.com/rurico) suggested trying the `libfdk_aac` encoder. So I recompiled FFmpeg to install the `libfdk_aac` encoder (extra encoders in FFmpeg require a rebuild).

![](/images/in_fdk_aac_to_ffmpeg_static_build/ffmpeg-libfdk-aac.png)

It worked...

## Statically compiling FFmpeg / automation

But that only worked on a Mac. I needed it to run on `Ubuntu`, and the thought of compiling all of `FFmpeg` on `Ubuntu Docker` already made my scalp tingle. (I spent 4 hours trying to compile FFmpeg with libfdk_aac on Ubuntu, and failed in the end.)

After I got home from work and finished dinner, I searched `ubuntu build ffmpeg` again and saw `static build`. It clicked.

So I looked for a ready-made statically built FFmpeg. There are some, but because of the libfdk_aac [LICENSE](https://android.googlesource.com/platform/external/aac/+/master/NOTICE), they generally do not include libfdk_aac.

Then I found an open source FFmpeg static build project on GitHub: [ffmpeg-static](https://github.com/zimbatm/ffmpeg-static)

Testing showed it was fine, but from inside China every download, install, and compile was slow, so I remembered GitLab has a free `runner`. I created a project on GitLab for automatic builds.

You only need to add `.gitlab-ci.yml` to the project:

```yaml
image: ubuntu:18.04

stages:
  - build

build-ubuntu:
  stage: build
  script:
    - apt-get update
    - apt-get install -yq bzip2 xz-utils perl tar wget git bc
    - apt-get install -yq autoconf automake build-essential cmake curl frei0r-plugins-dev gawk libfontconfig-dev libfreetype6-dev libopencore-amrnb-dev libopencore-amrwb-dev libsdl2-dev libspeex-dev libtheora-dev libtool libva-dev libvdpau-dev libvo-amrwbenc-dev libvorbis-dev libwebp-dev libxcb1-dev libxcb-shm0-dev libxcb-xfixes0-dev libxvidcore-dev lsb-release pkg-config texi2html yasm
    - git clone https://github.com/BlackHole1/ffmpeg-static
    - cd ffmpeg-static
    - chmod 777 *
    - ./build-ubuntu.sh -B
  artifacts:
    name: build
    paths:
      - ./ffmpeg-static/bin/*
```

Then push to GitLab, CI triggers automatically. Half an hour later, the result:

![](/images/in_fdk_aac_to_ffmpeg_static_build/gitlab-pipeline-passed.png)

![](/images/in_fdk_aac_to_ffmpeg_static_build/gitlab-job-artifacts.png)

gitlab project: https://gitlab.com/BlackHole1/ffmpeg-static-build
