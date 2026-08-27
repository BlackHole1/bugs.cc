---
title: Podman 基本原理及通信机制
description: 介绍 Podman 如何和容器通信
date: 2023-08-07T18:21:14+08:00
tags:
  - podman
  - linux
  - gvp
  - container
translationKey: podman-basic-principles-and-communication-mechanisms
aliases:
  - /zh/p/podman-basic-principles-and-communication-mechanisms/
  - /zh/posts/podman-基本原理及通信机制/
---

Podman 是 daemonless 的开源容器引擎，相比 Docker 而言，Podman 不需要运行守护进程，而是直接通过 libpod 库来管理容器，这样就可以避免 Docker 的一些安全问题，比如 Docker 的守护进程需要 root 权限，而 Podman 可以通过普通用户来管理容器。

## 简要架构 {#architecture}

`podman` 分为两部分，一部分是 `podman client`，另一部分是 `libpod` 库，可以简单理解为前端和后端，所有和容器相关的操作都是通过 `libpod` 库来实现的。`podman client` 所做的事情就是将用户的命令通过请求发送给 `libpod` 来进行操作。

值得注意的是，`libpod` 只有 Linux 架构的版本，所以 `libpod` 只能在 linux 系统下运行。至于如何在 Windows 和 MacOS 上运行可以见下一节。

## Machine

在 podman 中有一个 machine 的命令，用于启动一个 **Linux 虚拟机**，来运行容器，这样就可以避免在 podman 中直接运行容器时，需要 root 权限的问题。

目前 `podman` 支持4种虚拟机类型:

1. qemu
2. applehv
3. hyperv
4. wsl2

在 Linux 系统下，machine 命令是可选的，但是在 Windows 和 MacOS 系统下，`machine` 命令是必须的。

- *Windows* 上，虚拟机类型默认是: `wsl2`，`hyperv` 是可选的
- *MacOS* 上，虚拟机类型是: `qemu`，`applehv` 目前还在开发中（截止到 2023.08）
- *Linux* 上，如果启动虚拟机，则虚拟机类型是: `qemu`

值得一提的是，由 `machine` 启动的虚拟机系统是 Fedora Linux。
并且 `machine` 命令会自动下载 Fedora Linux 的镜像，所以第一次运行 `podman machine init` 时，会比较慢（可以事先手动下载，并通过 `--image-path` 参数进行指定）。
如果在使用 `init` 命令，并且没有指定 `--image-path` 时，`podman` 每次都会去尝试下载最新的 `Fedora` 镜像，关于这一点，规则如下：

1. 如果本地有缓存，并且和最新的镜像一致，则不会下载
2. 缓存只保留一个版本，并且会在两周后删除。

Fedora Linux 中内置了 `podman`，所以其实在 Windows 和 MacOS 系统里，你所运行的 `podman` 命令其实都是通过 *gvp* 或者 *ssh* 连接到虚拟机里的 **socket file**，通过 socket file 把请求转发给 `libpod` 来进行处理。如下图:

![podman](/images/podman-basic-principles-and-communication-mechanisms/podman-communication-arch.png)

图中的 `podman remote` 就是宿主机中的 `podman` 命令，之所以这么写，是因为在 Windows 和 MacOS 下所运行的 `podman` 都是 **remote** 模式。（在 Linux 中，可以通过加入 `--remote` 参数手动进入此模式）

## 通信 {#communication}

在上一节中的例图中，有一块是 `GVP / SSH`，这是用来让宿主机和虚拟机互相通信的技术方案。在介绍 GVP 之前，需要先了解 SSH 通信原理，这会有助于理解 GVP。

### SSH

当通过 `podman machine init` 和 `podman machine start` 来初始化并启动虚拟机时，podman 会在虚拟机中启动一个 ssh 服务。

这时，可以通过 `podman system connection ls --format=json` 命令查看连接信息[^machine-root]，如下:

```json
[
    {
        "Name": "podman-machine-default",
        "URI": "ssh://core@127.0.0.1:65489/run/user/502/podman/podman.sock",
        "Identity": "/Users/black-hole/.ssh/podman-machine-default",
        "IsMachine": true,
        "Default": true
    },
    {
        "Name": "podman-machine-default-root",
        "URI": "ssh://root@127.0.0.1:65489/run/podman/podman.sock",
        "Identity": "/Users/black-hole/.ssh/podman-machine-default",
        "IsMachine": true,
        "Default": false
    }
]
```

从上面的信息中可以看到，URI 是：`ssh://core@127.0.0.1:65489/run/user/502/podman/podman.sock`。这时我们就可以通过这个 *socket file* 去连接到虚拟机中的 `libpod` 服务。
podman 发送请求时，会先建立 ssh 连接，然后将请求通过 ssh 通道发送到虚拟机中。其实现简要代码如下:

```go
import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"

	"github.com/containers/common/pkg/ssh"
)

func main() {
	uri := "ssh://core@127.0.0.1:65489/run/user/502/podman/podman.sock"
	_url, _ := url.Parse(uri)
	conn, _ := ssh.Dial(&ssh.ConnectionDialOptions{
		Host:                        uri,
		Identity:                    "/Users/black-hole/.ssh/podman-machine-default",
		User:                        _url.User,
		Port:                        65489,
		InsecureIsMachineConnection: false,
	}, "golang")

	client := &http.Client{Transport: &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		return ssh.DialNet(conn, "unix", _url)
	}}}

	resp, _ := client.Get("http://d/v4.6.0/libpod/_ping")
	fmt.Println(resp.StatusCode)
}
```

这种方式是 Windows 系统下的行为，而在 MacOS 系统下，默认行为是通过 *GVP* 来实现的。

在 Windows 系统中，所有 cli 涉及到容器/镜像的操作都是基于这种方式去做的。

### GVP （gvisor-tap-vsock） {#gvp}

引入 GVP 的目的之一是为了解决每次都要通过 ssh 去连接虚拟机以及负责 API 转发的功能。[^gvp-daemon]

简要描述就是把宿主机中的 *socket file* 流量转发到虚拟机中的 *socket file*。

首先 podman 会先在宿主机中创建一个 *socket file*，然后在启动 *qemu* 时，加入 `-qmp` 参数，暴露 *qemu* 的 *socket file*，然后再通过 *GVP* 技术将宿主机中的 *socket file* 和 *qemu* 中的 *socket file* 进行绑定，这样就可以实现宿主机中的 *socket file* 和虚拟机中的 *socket file* 之间的通信。其命令简化如下:

```sh
gvproxy -listen-qemu unix:///var/folders/zm/g19w916x2x36bt16htrwtsh80000gp/T/podman/qmp_podman-machine-default.sock -forward-sock /Users/black-hole/.local/share/containers/podman/machine/qemu/podman.sock -forward-dest /run/user/502/podman/podman.sock

qemu-system-x86_64 -qmp unix:/var/folders/zm/g19w916x2x36bt16htrwtsh80000gp/T/podman/qmp_podman-machine-default.sock,server=on,wait=off -virtfs local,path=/var/folders,mount_tag=vol2,security_model=none
```

podman 在 MacOS 系统中还提供了 `podman-mac-helper` 的可执行文件，并和 podman 一起打包在了 `pkg` 安装包里。
当执行 `podman machine start` 时，podman 会先检测是否有 `podman-mac-helper`，如果存在，则会通过 `podman-mac-helper` 来创建一个软链接: `/var/run/docker.sock`，这个软连接指向的就是宿主机中的 *socket file*。

## API 转发 {#api-forwarding}

在开始之前，可以先思考一下，如何在你的程序里调用 podman api？

### MacOS

在 MacOS 中可以执行: `export DOCKER_HOST='unix:///Users/black-hole/.local/share/containers/podman/machine/qemu/podman.sock'` 来让后续的 podman 命令都通过本地的 *socket file* 通信。

以及也可以使用这个 *socket file* 进行 API 调用，如下:

```sh
curl --unix-socket /Users/black-hole/.local/share/containers/podman/machine/qemu/podman.sock http://d/v4.6.0/libpod/_ping
```

### Windows

首先，在 Windows 系统下，是没有 *socket file* 的概念的。但是 API 调用又非常重要，为了解决这一问题，podman 团队提供了一个 `win-sshproxy.exe` 的可执行文件，这个文件是用来转发 API 请求的。

*win-sshproxy* 的基本原理是通过 Windows 的 `Named Pipe`（命名管道）创建一个双工管道（duplex pipe）来实现的，可以将其简单的理解为 *socket file*。[^winsshproxy-daemon]

*win-sshproxy* 创建 `Named Pipe` 源码十分简单，如下:

```go
// Allow built-in admins and system/kernel components
const SddlDevObjSysAllAdmAll = "D:P(A;;GA;;;SY)(A;;GA;;;BA)"

func ListenNpipe(socketURI *url.URL) (net.Listener, error) {
	user, _ := user.Current()

	// Also allow current user
	sddl := fmt.Sprintf("%s(A;;GA;;;%s)", SddlDevObjSysAllAdmAll, user.Uid)
	config := winio.PipeConfig{
		SecurityDescriptor: sddl,
		MessageMode:        true,
		InputBufferSize:    65536,
		OutputBufferSize:   65536,
	}
	path := strings.Replace(socketURI.Path, "/", "\\", -1)
    return winio.ListenPipe(path, &config)
}
```

创建完 *Named Pipe* 后，*win-sshproxy* 将会启动一个 *ssh* 连接，并和 *Named Pipe* 进行绑定，绑定的逻辑也十分简单，如下：

```go
func main() {
    complete := new(sync.WaitGroup)
	complete.Add(2)
    go forward(ssh, namedPipe, complete)
	go forward(namedPipe, ssh, complete)

	go func() {
		complete.Wait()
		ssh.Close()
		namedPipe.Close()
	}()
}

func forward(src io.ReadCloser, dest CloseWriteStream, complete *sync.WaitGroup) {
	defer complete.Done()
	_, _ = io.Copy(dest, src)

	// 让另一端的 io.Copy() 退出
	_ = dest.CloseWrite()
}
```

自此，宿主机就可以通过 *Named Pipe* 来转发 API 请求。如下方的 js 代码:

```js
require('http').get({
    hostname: 'd',
    path: '/v4.6.0/libpod/_ping',
    socketPath: '//./pipe/docker_engine',
}, res => {
    console.log(`statusCode: ${res.statusCode}`)
    res.destroy();
}).end();
```

[^machine-root]: 其中 *podman-machine-default-root* 用于以 root 权限访问虚拟机，但一般而言，我们都是以普通用户的身份访问虚拟机，所以这里只关注 *podman-machine-default* 即可。

[^gvp-daemon]: 需要注意的是，GVP 是常驻进程。

[^winsshproxy-daemon]: 为了让其可以正常工作，此进程是需要常驻。
