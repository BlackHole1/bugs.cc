---
title: 从 fdk_aac 编码器到自动静态编译 FFmpeg
description: 为了在 FFmpeg 集成 libfdk_aac 编码器，利用免费的 gitlab-runner 来做到自动静态编译 FFmpeg
date: 2019-07-15T10:20:57+08:00
tags:
  - ffmpeg
translationKey: in-fdk-aac-to-ffmpeg-static-build
aliases:
  - /zh/p/in_fdk_aac_to_ffmpeg_static_build/
  - /zh/posts/从fdk_aac编码器到自动静态编译ffmpeg/
---

## 前言 {#intro}

最近在公司做一些视频处理的 task，遇到了一个需求，是把 MP4 视频里的音频提取成 AAC 格式。

当时的第一感觉就是很简单，直接使用 `ffmpeg -i source.mp4 -vn -acodec copy sound.aac` 就好。

但是发现这样是有问题的，其最终 AAC 的 `duration` 和 MP4 的 `duration` 完全不一样。如图:

![](/images/in_fdk_aac_to_ffmpeg_static_build/ffprobe-duration-mismatch.png)

网上的方法也都试了，但是都无法解决这个问题。

## 分析 / 解决 {#analysis}

后来经过测试，发现不同的比特率 (bit rate)，最终的生成的 AAC Duration 是不一样的。

但是我怎么知道这个比特率的值是多少呢？所以我从头缕了一下。

首先 MP4 的视频文件我们是从 Webm 格式转过来的，而 Webm 视频我们又是基于 [MediaRecorder](https://developer.mozilla.org/zh-CN/docs/Web/API/MediaRecorder/MediaRecorder) 来的。

我又重新看了一下 `MediaRecorder API`，发现其中有这样的属性:

- `audioBitsPerSecond`: 指定音频的比特率

OK 找到了，改了代码，对 `MediaRecorder` 接口增了 `audioBitsPerSecond` 属性，值设置了 `128000`，也就是 `128K`

然后使用下面的命令转化下，看看结果:

```bash
ffmpeg -i source.mp4 -vn -acodec aac -b:a 128k -y sound.aac
```

发现情况并没有得到改善...

![](/images/in_fdk_aac_to_ffmpeg_static_build/ffprobe-duration-128k.png)

后来想了一下，会不会是因为虽然使用了恒定比特率，但是还是会有一定的浮动，于是我把 `128k` 改为 `200k` 尝试下:

![](/images/in_fdk_aac_to_ffmpeg_static_build/ffmpeg-aac-200k.png)

不仅没解决，反而又增加了 `duration`

在接近放弃的时候，[rurico](https://github.com/rurico) 提供了一个思路，让我尝试下 `libfdk_aac` 编码器。于是经过重新编译 FFmpeg 来安装 `libfdk_aac` 编码器 (FFmpeg 安装额外编码器需要重新编译)。

![](/images/in_fdk_aac_to_ffmpeg_static_build/ffmpeg-libfdk-aac.png)

成功了...

## 静态编译 FFmpeg / 自动化 {#static-build}

但是这只是在 MAC 上成功，我需要让其在 `Ubuntu` 上跑起来，但是一想到，在 `Ubuntu Docker` 上编译整个 `FFmpeg` 就头皮发麻。（我花了 4 个小时的时间去尝试在 Ubuntu 上编译带有 libfdk_aac 的 FFmpeg，最终失败告终。）

下班回家后吃完饭后，又在网上重新查了下 `ubuntu build ffmpeg`，发现了`静态编译`的字样。茅塞顿开

于是在网上搜了下有没有现成的静态编译好的 FFmpeg，发现有是有，但是因为 libfdk_aac 的 [LICENSE](https://android.googlesource.com/platform/external/aac/+/master/NOTICE) 规定，普遍都没有把 libfdk_aac 编译进去。

于是在 github 上找到一个开源的 FFmpeg 静态编译项目: [ffmpeg-static](https://github.com/zimbatm/ffmpeg-static)

经过测试发现没问题，但是因为在国内，每次下载、安装、编译都很慢，于是想到 gitlab 有免费的 `runner` 可以使用。于是在 gitlab 建了一个项目，用于自动编译。

只需要在项目里加上 `.gitlab-ci.yml` 就好:

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

然后 push 到 gitlab，自动触发 ci。半个小时后，得到结果:

![](/images/in_fdk_aac_to_ffmpeg_static_build/gitlab-pipeline-passed.png)

![](/images/in_fdk_aac_to_ffmpeg_static_build/gitlab-job-artifacts.png)

gitlab project: https://gitlab.com/BlackHole1/ffmpeg-static-build
