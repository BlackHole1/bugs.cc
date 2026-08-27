---
title: "Switch Kernel for Fedora(40)"
date: 2024-05-11T14:08:23+08:00
tags:
  - fedora
  - kernel
translationKey: "switch-kernel-for-fedora(40)"
---

A few days ago, I upgraded from Fedora 39 to Fedora 40. However, after the upgrade, my `VirtualBox` could not start properly due to a mismatch between the `kernel` and `kernel-header` versions.

By using `uname -r` and `dnf list --installed | grep "kernel-headers"`, I found out the versions are as follows:

- `kernel`: *6.8.8-300.fc40.x86_64*
- `kernel-headers`: *6.8.3-300.fc40.x86_64*

I tried to install the matching version of `kernel-headers` using `sudo dnf install kernel-headers-$(uname -r)`, but found that there was no corresponding version available.[^headers-version]

Consequently, I decided to downgrade the `kernel` version to match the available `kernel-headers`. After verifying its existence, I attempted to install `kernel` version `6.8.3-300.fc40` using `sudo dnf install kernel-6.8.3-300.fc40.x86_64`, but `dnf` indicated that this version was unavailable.

Ultimately, I found a solution on [discussion.fedoraproject], where information from [Fedora Updates System For F40] allowed verification of the required `kernel` version, which could then be installed using `koji download-build --arch=x86_64 <package name>`. The process is as follows:

```bash
mkdir kernel-downloads
cd kernel-downloads
koji download-build --arch=x86_64 kernel-6.8.3-300.fc40
sudo dnf install ./kernel-*
```

Upon completion, it was necessary to switch to the newly installed `kernel` version. This could be managed using `sudo grubby --info=ALL` to view the list of system kernels, noting the desired `index` and `kernel`. For example:

![Grubby info all](/images/switch-kernel-for-fedora-40/grubby-info-all.png)

Next, a temporary switch to this `kernel` was made to ensure everything was working properly:[^grub-reboot]

```bash
sudo grub2-reboot "3"
reboot
```

If everything functioned as expected, this `kernel` could be set as the default:

```bash
sudo grubby --set-default /boot/vmlinuz-6.8.3-300.fc40.x86_64
```

A final check to confirm the default setting was successful:

```bash
sudo grubby --default-kernel
```

From this point on, our system will use the `6.8.3-300.fc40` version of the `kernel` by default until a `dnf update` is performed or another version is manually selected.

Reference:

- https://discussion.fedoraproject.org/t/how-do-i-install-an-old-kernel/76942/3
- https://knowledgebase.frame.work/en_us/change-default-fedora-kernel-H1Jnv0n6

[fedoraproject/rpms/kernel]: https://src.fedoraproject.org/rpms/kernel
[fedoraproject/rpms/kernel-headers]: https://src.fedoraproject.org/rpms/kernel-headers
[discussion.fedoraproject]:  https://discussion.fedoraproject.org/t/how-do-i-install-an-old-kernel/76942/3
[Fedora Updates System For F40]: https://bodhi.fedoraproject.org/updates/?packages=kernel&release=F40

[^headers-version]: This can also be confirmed on [fedoraproject/rpms/kernel] and [fedoraproject/rpms/kernel-headers], where the latest version of `kernel-headers` for Fedora 40 is `6.8.3-300.fc40`.

[^grub-reboot]: The above command sets the system to boot from `kernel` at `index` `3` on the next reboot (effective for one time only).
