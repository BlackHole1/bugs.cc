---
title: 在 debian 下如何使用迅雷登陆账号
description: 使用 wine 在 Linux 打开迅雷时，是无法进行登陆的，这里使用 wireshark 来解决这个问题
date: 2016-08-24T13:08:47+08:00
tags:
  - linux
translationKey: how-to-use-thunder-login-account-under-debian
aliases:
  - /zh/2016/08/24/how-to-use-thunder-login-account-under-debian/
  - /zh/p/how-to-use-thunder-login-account-under-debian/
  - /zh/posts/在debian下如何使用迅雷登陆账号/
---

## 前言: {#intro}

今天在 QQ 空间看到有人分享了“惊天魔盗团 2”的电影资源

![](/images/how-to-use-thunder-login-account-under-debian/qzone-movie-share.png)

正好这几天被 mongoose 搞的有点烦，想看会电影放松一下心情，但是代码还是要写的，于是我想把电影下载下来，然后等 bug 解决了，再看。所以问题来了。

## 下载迅雷: {#download-thunder}

可能是我们这边地区的问题，在迅雷官网下载的迅雷都很慢，于是使用“百度管家”下载。[fuck me down XunLei](http://112.29.142.181/sw.bos.baidu.com/sw-search-sp/software/66cfb7c33b400/Thunder_9.0.12.332_baidu.exe)

## 环境搭建: {#setup}

就是用 wine 来使用 exe 程序，这里不介绍，请自己百度

## 安装注意事项: {#install-notes}

不要使用 `sudo wine Thunder_9.0.12.332_baidu.exe`，请使用 `wine Thunder_9.0.12.332_baidu.exe`，不然你的迅雷会被安装到 root 用户下

## 如何启动 {#launch}

迅雷安装好后，会在你的桌面放一个快捷方式。如果没有，请像我这么做:

1. `cd ~/.wine/drive_c/Program\ Files\ \(x86\)/Thunder\ Network/Thunder9/Program/`

2. `wine Thunder.exe`

然后，他就启动成功了。

就像这样:

![](/images/how-to-use-thunder-login-account-under-debian/thunder-main-window.png)

## 为什么会出现黑色的框框呢？ {#black-window}

黑色的框框是个浏览器，迅雷自带的 XBrowser 浏览器。个人猜测是因为 dll 的问题，等我有时间的时候，我去找台 window 电脑，看一下这个浏览器以来上面 dll。这个浏览器无所谓的，没有他照样下载。

## 登陆 {#login}

重点来了，点击登陆时，会让你输入账号密码

![](/images/how-to-use-thunder-login-account-under-debian/thunder-login-dialog.png)

但是你会发现，你输入的字符串没有显示，不用慌，就像 linux 终端输入密码时一样，其实你输入了，只是不可见而已。然后就可以登陆了。但是有时候会出现让你填写验证码的框。

![](/images/how-to-use-thunder-login-account-under-debian/blank-captcha-dialog.png)

于是你会蛋疼的发现，验证码去吃屎了。所以现在我们就来解决这个问题。先想象一下验证码的特性。当我点击“看不清，换一张”的时候，那么一定会发送一个数据包。然后返回新的验证码数据包，我们只需要截取这个数据就行了。这里我使用 wireshark 来进行抓包。

debian 安装 wireshark，需要添加 kali 的源，然后 `sudo apt-get update&&sudo apt-get install wireshark` 就行了。记得使用 `sudo wireshark` 来运行

![](/images/how-to-use-thunder-login-account-under-debian/wireshark-capture-interfaces.png)

我这里的网卡是 wlan0，有可能不一样，选一个你觉得是对的就行了。

然后你就看到很多的数据包

![](/images/how-to-use-thunder-login-account-under-debian/wireshark-packet-capture.png)

这个时候我们在 Filter 里填写 `http&& http contains "image/jpeg"`

然后打开迅雷，登陆。当出现验证码验证的时候再次切换到 wireshark 看就行了。

![](/images/how-to-use-thunder-login-account-under-debian/wireshark-jpeg-filter.png)

选中（就是让它的背景色变成蓝色，单击）

然后 File->Export Objects->HTTP

![](/images/how-to-use-thunder-login-account-under-debian/wireshark-export-objects.png)

选中地址是 `verify2.xunlei.com` 且 Content Type 为 `image/jpeg` 选中后，点击另存为 xx.jpg。

![](/images/how-to-use-thunder-login-account-under-debian/http-object-list.png)

![](/images/how-to-use-thunder-login-account-under-debian/save-object-dialog.png)

![](/images/how-to-use-thunder-login-account-under-debian/saved-captcha.png)

拿验证码登陆就行了。
