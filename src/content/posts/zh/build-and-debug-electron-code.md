---
title: 构建 / 调试 Electron 源码
description: 如何构建和调试 Electron 源码
date: 2021-09-21T16:06:11+08:00
tags:
  - electron
  - lldb
  - clion
translationKey: build-and-debug-electron-code
aliases:
  - /zh/p/build-and-debug-electron-code/
  - /zh/posts/构建-调试-electron-源码/
---

> 需要注意的是，本文使用的是 `CLion` IDE 以及 `macOS` 系统
>
> 其他 IDE 和 系统也可以根据本文思路进行调整

## 前言 {#intro}

目前 *electron* 官方的 构建文档存在一些问题，当你完全按照文档上去做的时候，你会发现无法进行调试。
其表现就是在使用`LLDB` 时，无法看到当前 `frame` 下的变量信息和上下文。就像下图一样:

![](/images/build-and-debug-electron-code/lldb-variables-error.png)

## 构建 {#build}

为了快速跳过不重要的信息，我们直接从官网出现问题的地方开始说明。

官方相关的构建文文档见:

1. [构建步骤 (macOS)](https://www.electronjs.org/docs/development/build-instructions-macos)
2. [构建说明(macOS)](https://www.electronjs.org/docs/development/build-instructions-gn)

在准备操作时，请先确保你的 `macos SDK` 是正确的，详情可见: [设置 macOS SDK](#set-macos-sdk)

其中 《拉推的注意事项》的命令已经存在错误了，正确的命令应该为:

```bash
cd src/electron
git remote remove origin
git remote add origin https://github.com/electron/electron
# 从这里开始就不一样了
git fetch
git checkout main
git pull --rebase origin main
git branch --set-upstream-to=origin/main
```

接下来文档中说需要使用 `gclient sync -f` 命令，而在使用这个命令的时候，有时会出现 `dugite` 命令失败的问题，解决方案见: [下载 dugite 失败解决方案](#dugite-solution)

> 接下来就是重点，也是本文中的核心

当你运行完成上面的命令后，还需要修改: `build/config/compiler/compiler.gni` 文件。

把这个里面的

```ini
forbid_non_component_debug_builds = build_with_chromium
```

改为:

```ini
forbid_non_component_debug_builds = false
```

如果缺失这一步，你在使用: `gn gen` 命令时将会报错:

```ini
ERROR at //build/config/compiler/compiler.gni:302:3: Assertion failed.
  assert(symbol_level != 2 || current_toolchain != default_toolchain ||
  ^-----
Can't do non-component debug builds at symbol_level=2
See //BUILD.gn:12:1: whence it was imported.
import("//build/config/compiler/compiler.gni")
```

![](/images/build-and-debug-electron-code/gn-gen-assertion-error.png)

然后在使用 `gn gen` 构建时，请使用下面的命令，替换官网的命令:

```bash
gn gen out/Testing --args="import(\"//electron/build/args/testing.gn\") is_debug=true symbol_level=2 $GN_EXTRA_ARGS"
```

如果你想使用 `ccache` ，则使用:

```bash
gn gen out/Testing --args="import(\"//electron/build/args/testing.gn\") cc_wrapper=\"ccache\" is_debug=true symbol_level=2 $GN_EXTRA_ARGS"
```

然后就是进行构建:

```bash
ninja -C out/Testing electron
```

## 调试 (CLion) {#debug}

在想使用 *CLion* 进行调试时，请先确保你执行成功过 `ninja -C out/Testing electron` 命令
“先不要急着去打开 *CLion*，先在根目录(src同级目录)里创建一个 `CMakeLists.txt` 文件，内”如下:

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

这个文件是为了保证 *CLion* 可以正确识别出代码，以及进行代码补全提示等功能，否则 IDE 的代码提示将**完全失效**。

然后再使用 *CLion* 打开项目，需要注意的是项目的根目录，就像下图一样:

![](/images/build-and-debug-electron-code/select-project-root.png)

打开后，可能需要等个几十分钟，让 *CLion* 建立 / 刷新缓存。

 依次打开: Setting -\> Build, Execution, Deployment -\> Custom Build Targets -\> + -\> Set Build。

最终如图所示:

![](/images/build-and-debug-electron-code/custom-build-target.png)

然后再设置: `Run/Debug Configurations`，如图所示:

![](/images/build-and-debug-electron-code/run-debug-config.png)

你如果想使用自编译的 electron 打开自己的应用，直接在 `Program arguments` 里添加你的应用的地址即可

其中: `CHROMIUM_LLDBINIT_SOURCED=1` 也需要加上，否则无法调试: `Chormium` 的源码

设置完成后，还有一个地方需要进行设置，否则也无法进行调试:

创建 `~/.lldbinit` 文件，写入:

```ts
script sys.path[:0] = ['/Users/black-hole/Code/Github/electron/src/tools/lldb']
script import lldbinit
```

记得把上面的路径替换成你自己的。

这一步在官网中也提到了，但是如果按照官网上所说的: `command script import ~/electron/src/tools/lldb/lldbinit.py` 去设置，将无法使用，原因不明。

新的 `~/.lldbinit` 写法，我是产考 `Chromium` 的写法

然后就可以正常使用 断点调试功能了，如图:

![](/images/build-and-debug-electron-code/lldb-variables-working.png)

## 问题 {#issues}

### 设置 macOS SDK {#set-macos-sdk}

目前按照 Electron 官方文档中提到的，最好使用: `MacOSX11.0.sdk`。

可以下载 [MacOSX-SDKs](https://github.com/phracker/MacOSX-SDKs) 中的 `MacOSX11.0.sdk` 文件到目录: `/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/`

即可。

### 下载 dugite 失败解决方案 {#dugite-solution}

当你在使用: `gclient sync -f` 命令进行同步时，有时会报错：

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

原因是因为 `dugite` 再去下载二进制文件时，没有去识别使用你电脑的代理，你可以使用浏览器进行下载，然后使用 `python -m SimpleHTTPServer` 开启一个 *http* 服务，就像下面这样:

![](/images/build-and-debug-electron-code/simplehttpserver-serving.png)

然后编辑 `src/electron/node_modules/dugite/script/embedded-git.json` 文件，改为[^embedded-git-os]:

![](/images/build-and-debug-electron-code/embedded-git-json.png)

然后执行:

```bash
cd src/electron/node_modules/dugite
node ./script/download-git.js
```

全部执行完成后，再次执行 `gclient sync -f` 就可以发现已经可以成功执行。

[^embedded-git-os]: 不同的系统其修改的位置也不一样，根据你的系统型号去修改对应的就好。
