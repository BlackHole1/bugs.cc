---
title: "切换 Fedora(40) 内核"
date: 2024-05-11T14:08:23+08:00
tags:
  - fedora
  - kernel
translationKey: "switch-kernel-for-fedora(40)"
---

前几天我从 Fedora 39 升级到了 Fedora 40，但是在升级后，我的 `VirtualBox` 无法正常启动了，提示我的 `kernel` 和 `kernel-header` 版本不匹配。

通过 `uname -r` 和 `dnf list --installed | grep "kernel-headers"` 得知我的版本为:

- `kernel`: *6.8.8-300.fc40.x86_64*
- `kernel-headers`: *6.8.3-300.fc40.x86_64*

于是我尝试通过 `sudo dnf install kernel-headers-$(uname -r)` 来安装对应版本的 `kernel-headers`，但是发现没有对应的版本。[^headers-version]

所以我决定降级 `kernel` 版本，以便于安装对应版本的 `kernel-headers`。经过一番查找，我确认了 `kernel` 版本 `6.8.3-300.fc40` 的存在。
但是无法通过 `sudo dnf install kernel-6.8.3-300.fc40.x86_64` 来安装，因为 `dnf` 会提示我没有这个版本。

最终在 [discussion.fedoraproject] 找到了相关的描述，可以通过 [Fedora Updates System For F40] 来确认自己需要安装的 `kernel` 版本是否存在，然后通过 `koji download-build --arch=x86_64 <package name>` 来进行安装，示例如下:

```bash
mkdir kernel-downloads
cd kernel-downloads
koji download-build --arch=x86_64 kernel-6.8.3-300.fc40
sudo dnf install ./kernel-*
```

安装完成后，我们需要切换到对应的 `kernel` 版本上。此时可以使用 `sudo grubby --info=ALL` 来查看当前系统的 `kernel` 列表。并记录下你想切换的 `index` 和 `kernel` 字段。如:

![Grubby info all](/images/switch-kernel-for-fedora-40/grubby-info-all.png)

然后先临时切换到这个 `kernel` 上，以便检测是否正常工作[^grub-reboot]:

```bash
sudo grub2-reboot "3"
reboot
```

如果没有问题，我们可以将这个 `kernel` 设置为默认值:

```bash
sudo grubby --set-default /boot/vmlinuz-6.8.3-300.fc40.x86_64
```

再检查一下是否设置成功:

```bash
sudo grubby --default-kernel
```

现在起，我们的系统将默认使用 `6.8.3-300.fc40` 版本的 `kernel`。直到下次执行了 `dnf update` 或者手动切换到其他版本。

Reference:

- https://discussion.fedoraproject.org/t/how-do-i-install-an-old-kernel/76942/3
- https://knowledgebase.frame.work/en_us/change-default-fedora-kernel-H1Jnv0n6

[fedoraproject/rpms/kernel]: https://src.fedoraproject.org/rpms/kernel
[fedoraproject/rpms/kernel-headers]: https://src.fedoraproject.org/rpms/kernel-headers
[discussion.fedoraproject]:  https://discussion.fedoraproject.org/t/how-do-i-install-an-old-kernel/76942/3
[Fedora Updates System For F40]: https://bodhi.fedoraproject.org/updates/?packages=kernel&release=F40

[^headers-version]: 这一点在 [fedoraproject/rpms/kernel] 和 [fedoraproject/rpms/kernel-headers] 中也可以得到验证，Fedora 40 目前最新的 `kernel-headers` 版本为 `6.8.3-300.fc40`。

[^grub-reboot]: 上面的命令将在下次重启时切换到 `index` 为 `3` 的 `kernel` 上（只生效一次）。
