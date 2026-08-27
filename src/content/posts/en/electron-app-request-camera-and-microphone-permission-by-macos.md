---
title: Pitfalls of requesting camera and microphone permission for an Electron app on macOS
description: Starting with macOS 10.14, tighter privacy rules can make Electron apps crash when they use the camera or microphone
date: 2019-10-23T09:55:00+08:00
tags:
  - electron
  - macos
translationKey: electron-app-request-camera-and-microphone-permission-by-macos
---

> Our company's Electron app would occasionally `Crash` during *device detection*. After digging into it, the app didn't have camera and microphone permission, which caused the crash during *device detection*.

On macOS 10.14 and later, you have to explicitly grant microphone and camera permission to your own app. Otherwise it cannot use the system camera or microphone. For details, see: [Requesting Authorization for Media Capture on macOS](https://developer.apple.com/documentation/avfoundation/cameras_and_media_capture/requesting_authorization_for_media_capture_on_macos?language=objc)

Apple's docs say that if you want microphone and camera permission, you have to set the related keys in the `plist`. They are:

- Microphone: [NSMicrophoneUsageDescription](https://developer.apple.com/documentation/bundleresources/information_property_list/nscamerausagedescription?language=objc)
- Camera: *[NSCameraUsageDescription](https://developer.apple.com/documentation/bundleresources/information_property_list/nsmicrophoneusagedescription?language=objc)*

The `Description` suffix tells you these keys explain why your app needs the microphone and camera.

Packaging an `Electron App` is usually done with [electron-builder](https://www.electron.build/). In its docs for Mac packaging there is an `extendInfo` option: it adds your custom keys to the `plist`. In `electron-builder.yml` it looks like this:

```yaml
mac:
  extendInfo:
    NSMicrophoneUsageDescription: Please allow this app to access your microphone
    NSCameraUsageDescription: Please allow this app to access your camera
```

After you write that, you'll find it does nothing. Those two keys only explain why the app is asking for permission. They do not actually request it.

To request camera and microphone permission, you need these keys:

- com.apple.security.device.camera
- com.apple.security.device.audio-input

There is a prerequisite for adding them: you must turn on [hardenedRuntime](https://developer.apple.com/documentation/security/hardened_runtime_entitlements).[^hardenedruntime-version] It tightens runtime integrity. For details, see: [Hardened Runtime Entitlements](https://developer.apple.com/documentation/security/hardened_runtime_entitlements)

So now we add `hardenedRuntime`:

```yaml
mac:
  hardenedRuntime: true
  extendInfo:
    NSMicrophoneUsageDescription: Please allow this app to access your microphone
    NSCameraUsageDescription: Please allow this app to access your camera
```

The actual request is done with the `entitlements` option. The config looks like this:

electron-builder.yml

```yaml
mac:
  entitlements: entitlements.mac.plist
  hardenedRuntime: true
  extendInfo:
    NSMicrophoneUsageDescription: Please allow this app to access your microphone
    NSCameraUsageDescription: Please allow this app to access your camera
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

If you try this, the app will crash on launch, or it won't even package.

That's because once you turn on `hardenedRuntime` to tighten app security, you have to loosen that security a bit. In `entitlements.mac.plist` you also need:

- [com.apple.security.cs.allow-jit](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_cs_allow-jit)
- [com.apple.security.cs.allow-unsigned-executable-memory](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_cs_allow-unsigned-executable-memory)
- [com.apple.security.cs.allow-dyld-environment-variables](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_cs_allow-dyld-environment-variables)

The final `entitlements.mac.plist` looks like this:

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

From here, your Electron app should be able to request and use the camera and microphone on macOS.

[^hardenedruntime-version]: In `electron-builder` `21.1.3`, `hardenedRuntime` already defaults to `true`. In `21.1.2` through `20.41.0`, it defaults to `false`. Older versions don't have the property at all.
