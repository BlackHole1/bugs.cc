---
title: Electron App 在 MacOS 下 申请摄像头及麦克风权限踩坑指南
description: 由 macOS 在 10.14 版本及以上版本增加了隐私的安全性，导致 Electron 应用在使用摄像头、麦克风时会 Crash
date: 2019-10-23T09:55:00+08:00
tags:
  - electron
  - macos
translationKey: electron-app-request-camera-and-microphone-permission-by-macos
aliases:
  - /zh/p/electron-app-request-camera-and-microphone-permission-by-macos/
  - /zh/posts/electron-app-在-macos-下-申请摄像头及麦克风权限踩坑指南/
---

> 公司的 Electron 应用，偶尔会在 *设备检测* 时 `Crash` ，后来经过排查发现是当前 App 没有摄像头和麦克风的权限。导致在 *设备检测* 时出现了崩溃。

macOS 10.14 及以上版本，开发者必须对其自己的应用明确授予麦克风、摄像头权限。否则无法调用系统的摄像头、麦克风。如想见详情，可见: [Requesting Authorization for Media Capture on macOS](https://developer.apple.com/documentation/avfoundation/cameras_and_media_capture/requesting_authorization_for_media_capture_on_macos?language=objc)

其中 Apple 文档里标注了，如果你想使用麦克风、摄像头权限则需要在 `plist` 文件里指定相关的属性才可以，如下:

- 麦克风: [NSMicrophoneUsageDescription](https://developer.apple.com/documentation/bundleresources/information_property_list/nscamerausagedescription?language=objc)
- 摄像头: *[NSCameraUsageDescription](https://developer.apple.com/documentation/bundleresources/information_property_list/nsmicrophoneusagedescription?language=objc)*

这两个属性从后面的 `Description` 就能看到这是一个说明你的程序为什么要使用麦克风和摄像头的属性。

而 `Electron App` 打包，一般都是使用 [electron-builder](https://www.electron.build/) 这个库来进行打包，而这个库的文档里针对于 mac 打包，有这么一个属性: `extendInfo` 他的用途是把你的自定义的属性加入到 `plist` 文件里，在 `electro-builder.yml` 文件里的写法如下:

```yaml
mac:
  extendInfo:
    NSMicrophoneUsageDescription: 请允许本程序访问您的麦克风
    NSCameraUsageDescription: 请允许本程序访问您的摄像头
```

但是当你这么写完会发现，并没有起到任何的作用，因为这两个属性只是用于说明你的应用为什么要申请权限。但是却没有指定申请权限的行为。

如果要指定申请摄像头、麦克风的权限，需要以下的属性:

- com.apple.security.device.camera
- com.apple.security.device.audio-input

而这两个属性，在添加时有一个前提，就是你必须开启了 [hardenedRuntime](https://developer.apple.com/documentation/security/hardened_runtime_entitlements)[^hardenedruntime-version]，这个东西是为了加强应用运行时的完整性，如想见详情，可见: [Hardened Runtime Entitlements](https://developer.apple.com/documentation/security/hardened_runtime_entitlements)

那么现在我们再添加一下 `hardenedRuntime` :

```yaml
mac:
  hardenedRuntime: true
  extendInfo:
    NSMicrophoneUsageDescription: 请允许本程序访问您的麦克风
    NSCameraUsageDescription: 请允许本程序访问您的摄像头
```

然后在申请的行为需要利用 `entitlements` 属性。代码如下:

electron-builder.yml

```yaml
mac:
  entitlements: entitlements.mac.plist
  hardenedRuntime: true
  extendInfo:
    NSMicrophoneUsageDescription: 请允许本程序访问您的麦克风
    NSCameraUsageDescription: 请允许本程序访问您的摄像头
```

entitlements.mac.plist

```text
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.device.camera</key>
    <true/>
  </dict>
</plist>
```

但是当你这么尝试的时候，会发现的应用打开会直接崩溃，亦或者根本无法正常的打包。

这是因为当你开启了 `hardenedRuntime` 来加强应用的安全性时，那么你需要把这个安全性放宽一点。也就是说你需要在 `entitlements.mac.plist` 里在指定一下下面的属性:

- [com.apple.security.cs.allow-jit](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_cs_allow-jit)
- [com.apple.security.cs.allow-unsigned-executable-memory](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_cs_allow-unsigned-executable-memory)
- [com.apple.security.cs.allow-dyld-environment-variables](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_cs_allow-dyld-environment-variables)

那么现在最终的 `entitlements.mac.plist` 内容如下:

```text
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.device.camera</key>
    <true/>
  </dict>
</plist>
```

自此，你的 Electron App 就应该可以在 macOS 上正常申请/使用摄像头和麦克风了。

[^hardenedruntime-version]: `hardenedRuntime` 这个属性，在 `electron-builder` 的 `21.1.3` 版本已经默认为 `true` ，而在 `21.1.2 ~ 20.41.0` 版本里，这个属性的默认值是 `false`。再往后的版本里没有这个属性。
