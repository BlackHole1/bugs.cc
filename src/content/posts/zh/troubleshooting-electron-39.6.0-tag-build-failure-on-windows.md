---
title: Electron 39.6.0 tag 在 Windows 上构建失败排查
date: 2026-03-10T16:07:00+08:00
tags:
  - electron
translationKey: troubleshooting-electron-39.6.0-tag-build-failure-on-windows
---

挺久没在 Windows 上构建 Electron 了，昨天下午构建 [electron@39.6.0] 这个 tag 一直失败，而最新的 commit 上却完全正常。一直排查到晚上。

尝试了 PowerShell/Cmd，也重建整个源码树，甚至还重启了电脑，但是都不行。

**复现环境：**

- Electron 39.6.0（tag）
- Windows 10/11
- PowerShell 和 Cmd 都试过

最开始我怀疑是 depot_tools 版本问题，但是 [@electron/build-tools] 会在启动前更新 depot_tools，所以也不是。

切换到了最新的 electron commit 上是好的，也就是问题不在系统层面。

报错说，可以执行 .\siso_failed_commands.bat 来重新运行失败的命令，我运行后，是正常无报错的。

![构建失败日志](/images/troubleshooting-electron-39.6.0-tag-build-failure-on-windows/failed-log.jpg)

![执行 siso_failed_commands.bat](/images/troubleshooting-electron-39.6.0-tag-build-failure-on-windows/siso-exec.png)

手动执行 bat 文件完全成功。

又重新看了下错误日志，注意到:

```text
err: fork/exec /Users/live/.electron_build_tools/third_party/depot_tools/bootstrap-2@3_11_8_chromium_35_bin/python3/bin/python3.exe: The system cannot find the path specified.
```

前面的 `C:` 盘符被丢弃了，而在 `siso_failed_commands.bat` 中是有这个盘符的。

![siso_failed_commands.bat 内容](/images/troubleshooting-electron-39.6.0-tag-build-failure-on-windows/siso-bat-content.png)

也就是说是 siso（构建执行器）在执行命令时丢失了 C: 驱动器前缀。(`C:\foo` → `\foo`)

如果源码放在 C 盘，反而不会触发这个问题，因为 Windows 会自动把 `/` 开头的无盘符路径解析到当前进程盘符根目录。

[@electron/build-tools] 会默认把 depot_tools 放在：`%USERPROFILE%\.electron_build_tools\third_party`

siso 进程工作目录是跟随源码来，在: `D:\electron\release-39.6.0\src\out\Release`

而我把 Electron 源码放在了 D 盘，导致剔除盘符后，fork/exec 执行的命令隐式变成了:

`D:/Users/live/.electron_build_tools/third_party/depot_tools/bootstrap-2@3_11_8_chromium_35_bin/python3/bin/python3.exe`

最终报错: The system cannot find the path specified 🤷‍♂️

所以只要 depot_tools 和 Electron/Chromium 源码在同一个盘符，就完全没问题。这也是为什么 Electron 的 CI 能过的原因。

最后定位到相关的 CR: <https://chromium-review.googlesource.com/c/build/+/7134259>

原因也确定了: 因为 golang 的 slice 是共享引用，直接修改时，会对所有持有端可见，导致这里的修改被错误的分发到后续的使用上。
解决方案就是使用 `slices.Clone` 做一次复制即可。

后续我的解决方案就是将 Electron 源码存放在 C 盘了。

[electron@39.6.0]: https://github.com/electron/electron/tree/v39.6.0
[@electron/build-tools]: https://github.com/electron/build-tools
