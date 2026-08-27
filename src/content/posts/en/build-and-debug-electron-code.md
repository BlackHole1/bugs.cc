---
title: Build / debug Electron source
description: How to build and debug Electron source
date: 2021-09-21T16:06:11+08:00
tags:
  - electron
  - lldb
  - clion
translationKey: build-and-debug-electron-code
---

> This post uses the `CLion` IDE and `macOS`
>
> Other IDEs and systems can follow the same approach

## Intro {#intro}

*electron*'s official build docs have some problems. If you follow them exactly, you will not be able to debug.
The symptom is that `LLDB` cannot show variables or context for the current `frame`. It looks like this:

![](/images/build-and-debug-electron-code/lldb-variables-error.png)

## Build {#build}

To skip the unimportant parts, I will start from where the official docs go wrong.

Official build docs:

1. [Build steps (macOS)](https://www.electronjs.org/docs/development/build-instructions-macos)
2. [Build instructions (macOS)](https://www.electronjs.org/docs/development/build-instructions-gn)

Before you start, make sure your `macos SDK` is correct. See: [Setting macOS SDK](#set-macos-sdk)

The commands in "A note on pulling/pushing" are already wrong. The correct commands are:

```bash
cd src/electron
git remote remove origin
git remote add origin https://github.com/electron/electron
# from here on it differs
git fetch
git checkout main
git pull --rebase origin main
git branch --set-upstream-to=origin/main
```

The docs then tell you to run `gclient sync -f`. That command sometimes fails on `dugite`. See: [Dugite download failure workaround](#dugite-solution)

> This next part is the point of the post

After you finish the commands above, you also need to edit `build/config/compiler/compiler.gni`.

Change

```ini
forbid_non_component_debug_builds = build_with_chromium
```

to:

```ini
forbid_non_component_debug_builds = false
```

Without this step, `gn gen` will fail:

```ini
ERROR at //build/config/compiler/compiler.gni:302:3: Assertion failed.
  assert(symbol_level != 2 || current_toolchain != default_toolchain ||
  ^-----
Can't do non-component debug builds at symbol_level=2
See //BUILD.gn:12:1: whence it was imported.
import("//build/config/compiler/compiler.gni")
```

![](/images/build-and-debug-electron-code/gn-gen-assertion-error.png)

Then when you run `gn gen`, use this command instead of the official one:

```bash
gn gen out/Testing --args="import(\"//electron/build/args/testing.gn\") is_debug=true symbol_level=2 $GN_EXTRA_ARGS"
```

If you want `ccache`, use:

```bash
gn gen out/Testing --args="import(\"//electron/build/args/testing.gn\") cc_wrapper=\"ccache\" is_debug=true symbol_level=2 $GN_EXTRA_ARGS"
```

Then build:

```bash
ninja -C out/Testing electron
```

## Debug (CLion) {#debug}

If you want to debug with *CLion*, first make sure `ninja -C out/Testing electron` has succeeded.
Don't open *CLion* yet. First create a `CMakeLists.txt` in the root directory (the same level as `src`), with this content:

```ts
cmake_minimum_required(VERSION 3.20)
project(electron)

set(CMAKE_CXX_STANDARD 14)

set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -O0")

include_directories(${CMAKE_CURRENT_SOURCE_DIR}/src)
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/src/electron)
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/src/out/Testing/gen)

add_executable(electron_exec ${CMAKE_CURRENT_SOURCE_DIR}/src/electron/shell/app/electron_main.cc)
```

This file is so *CLion* can index the code and provide completion. Without it, IDE hints will **completely fail**.

Then open the project in *CLion*. The project root should look like this:

![](/images/build-and-debug-electron-code/select-project-root.png)

After opening, you may need to wait tens of minutes for *CLion* to build / refresh the cache.

Open in order: Setting -\> Build, Execution, Deployment -\> Custom Build Targets -\> + -\> Set Build.

It should look like this:

![](/images/build-and-debug-electron-code/custom-build-target.png)

Then set `Run/Debug Configurations`, as shown:

![](/images/build-and-debug-electron-code/run-debug-config.png)

If you want to open your own app with the Electron you built, add the app path in `Program arguments`.

Also add `CHROMIUM_LLDBINIT_SOURCED=1`, otherwise you cannot debug Chromium source.

After that, one more setting is required, otherwise debugging still will not work:

Create `~/.lldbinit` with:

```ts
script sys.path[:0] = ['/Users/black-hole/Code/Github/electron/src/tools/lldb']
script import lldbinit
```

Replace the path with your own.

The official docs mention this too, but if you follow their `command script import ~/electron/src/tools/lldb/lldbinit.py`, it will not work. I don't know why.

The new `~/.lldbinit` format is based on Chromium's.

Then breakpoints work, as shown:

![](/images/build-and-debug-electron-code/lldb-variables-working.png)

## Issues {#issues}

### Setting macOS SDK {#set-macos-sdk}

Per Electron's official docs, it is best to use `MacOSX11.0.sdk`.

Download `MacOSX11.0.sdk` from [MacOSX-SDKs](https://github.com/phracker/MacOSX-SDKs) into `/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/`

That is all.

### Dugite download failure workaround {#dugite-solution}

When you run `gclient sync -f` to sync, you may hit:

```bash
error /Users/black-hole/Code/Github/electron/src/electron/node_modules/dugite: Command failed.
Exit code: 1
Command: node ./script/download-git.js
Arguments:
Directory: /Users/black-hole/Code/Github/electron/src/electron/node_modules/dugite
Output:
Downloading Git from: https://github.com/desktop/dugite-native/releases/download/v2.29.3-2/dugite-native-v2.29.3-3d467be-macOS-x64.tar.gz
Error raised while downloading https://github.com/desktop/dugite-native/releases/download/v2.29.3-2/dugite-native-v2.29.3-3d467be-macOS-x64.tar.gz GotError [RequestError]: Client network socket disconnected before secure TLS connection was established
```

![](/images/build-and-debug-electron-code/dugite-download-error.png)

The reason is that `dugite` does not pick up your machine's proxy when it downloads the binary. You can download it in a browser, then start an *http* server with `python -m SimpleHTTPServer`, like this:

![](/images/build-and-debug-electron-code/simplehttpserver-serving.png)

Then edit `src/electron/node_modules/dugite/script/embedded-git.json` to:[^embedded-git-os]

![](/images/build-and-debug-electron-code/embedded-git-json.png)

Then run:

```bash
cd src/electron/node_modules/dugite
node ./script/download-git.js
```

After that, run `gclient sync -f` again and it should succeed.

[^embedded-git-os]: The field you change depends on the OS. Edit the entry that matches your system.
