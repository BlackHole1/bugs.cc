---
title: 服务端录制原理分析
description: 介绍服务端录制的原理及遇到的一些坑
date: 2019-12-07T15:02:14+08:00
tags:
  - rebirth
  - chrome extension
  - nodejs
translationKey: rebirth-principle-analysis
aliases:
  - /zh/p/rebirth-principle-analysis/
  - /zh/posts/服务端录制原理分析/
---

## 简要 {#intro}

### 功能简要 {#features}

什么是服务端录制，通俗来说就是在服务器上把网站录制下来，包括网站的 **声音、动作、刷新、跳转** 等。并保存成一个视频文件

### 原理简要 {#principle}

通过虚拟桌面 `xvfb` 技术启动 `Puppeteer`，`Puppeteer` 打开 `Chrome`，再调用 `Chrome Extension API` 进行录制生成 `Stream`，最终通过 H5 API 把 Stream 转换成 `webm` 格式的视频文件

## 难点 {#challenges}

如何录制声音、在服务器上、做成自动化

## 分析 {#analysis}

在前期调研阶段，想到了各种方案，如：

1. 使用 Canvas 进行截图、拼凑
2. `Chrome` 及 `H5` 的各个 API

但是经过各个方面的测试，最终确定下来，使用 Chrome 插件提供的一个 API: `chrome.tabCapture.capture` ，这个 API 其实在 Chrome 插件文档里的介绍是这样的:

> 捕获当前活动标签页的可视区域。该方法只能在扩展程序被调用之后在当前活动网页上使用，与 [activeTab](https://crxdoc-zh.appspot.com/extensions/activeTab) 的工作方式类似。

**捕获当前活动标签页的可视区域** 这段话代表了这个 API 的功能，后面的话代表了这个插件的限制，也就是说你不能直接调用。需要一个用户操作才能去调用这个 API（不得不说，Chrome对安全问题是很重视的）

这个限制就是当时开发遇到的第一个问题，因为整个录制都是在服务器上运行的，是不可能有人工干预的情况。于是翻了下 `Chrome` 的源码，果然在 [tab_capture_api.cc](https://cs.chromium.org/chromium/src/chrome/browser/extensions/api/tab_capture/tab_capture_api.cc?type=cs&g=0&l=247-257) 找到了，核心代码如下：

```cpp
// Make sure either we have been granted permission to capture through an
// extension icon click or our extension is whitelisted.
if (!extension()->permissions_data()->HasAPIPermissionForTab(
        SessionTabHelper::IdForTab(target_contents).id(),
        APIPermission::kTabCaptureForTab) &&
    base::CommandLine::ForCurrentProcess()->GetSwitchValueASCII(
        switches::kWhitelistedExtensionID) != extension_id &&
    !SimpleFeature::IsIdInArray(extension_id, kMediaRouterExtensionIds,
                                base::size(kMediaRouterExtensionIds))) {
  return RespondNow(Error(kGrantError));
}
```

其中下面的代码是最主要的：

```cpp
base::CommandLine::ForCurrentProcess()->GetSwitchValueASCII(
        switches::kWhitelistedExtensionID) != extension_id &&
    !SimpleFeature::IsIdInArray(extension_id, kMediaRouterExtensionIds,
                                base::size(kMediaRouterExtensionIds))
```

这段代码会检测当前插件的的id是否和 `kWhitelistedExtensionID` 一样，而 `kWhitelistedExtensionID` 就是一个特权列表，当相同时，就可以绕过用户操作，做成自动化。

而 `kWhitelistedExtensionID` 声明是在 [switches.cc](https://cs.chromium.org/chromium/src/extensions/common/switches.cc?type=cs&g=0&l=78) 文件里的，定义如下：

```cpp
// Adds the given extension ID to all the permission whitelists.
const char kWhitelistedExtensionID[] = "whitelisted-extension-id";
```

现在就很清楚了，我只需要在启动 Chrome 的时候，增加一个 `--whitelisted-extension-id` 参数，来指定当前 Chrome 插件ID 就行了。[^tab-active]

---

所以现在新的问题来了，我需要让我每次生成的 Chrome 插件，ID都是固定的，否则每次生成的插件，ID都不一样就有问题了。在 `Stack Overflow` 搜了一下，找到了相关的解决方案: [Making a unique extension id and key for Chrome extension?](https://stackoverflow.com/questions/37317779/making-a-unique-extension-id-and-key-for-chrome-extension)

这也就是为什么我会在项目里的 插件目录放置一个 [key.pem](https://github.com/alo7/rebirth/blob/master/src/extensions_dist/key.pem) 文件，本质就是为了让插件ID固定下来。

---

可能有的小伙伴已经发现，这个API没有提供其他的方法了，所以需要我们手动去完成 `暂停 / 恢复 / 停止` 的方法，这个时候我们就可以借助 H5 的 `MediaRecorder`[^mediarecorder] API 来完成这件事情。

`chrome.tabCapture.capture` 这个方法会返回一个 `Stream` 对象，而这个 `Stream` 包含了 音/视频。所以我们就可以使用 `MediaRecorder` 来完成剩下的功能了。

在调用 `chrome.tabCapture.capture` 后，我们会创建一个变量。这个变量由 `MediaRecorder` 实例化而来，并且同时监听新的流进来。

现在我们写了几个方法(`暂停 / 恢复 / 停止`)，其实本质就是调用 `MediaRecorder` 的方法。因为 `MediaRecorder` 本身就提供了: `pause / resume / stop` 的方法，我们只需要做一层包装即可。

当然这里有个小问题，就是当你调用 `MediaRecorder` 的 `stop` 方法时，还需要遍历每个 `Tracks`，不然会照成持续的内存占用。代码如下:

```typescript
mediaRecorder.stop();
mediaRecorder.stream.getTracks().forEach(track => {
  track.stop();
});
```

你可以初步理解成，这个 stop 只是停止接收流，但是之前的流还没有被关闭/释放。

---

上面说了那么多，基本的录制结构都OK了。无论有没有看懂，都应该知道这个项目的核心是浏览器插件。但是 Chrome 不支持在 `headless`[^headless] 模式下注入插件。

因为是在服务器上，并且以后肯定是要走 `Docker` 的方式，这些都是无桌面的，不能使用 `headless` 模式的话，相当于以上所有的工作都是白费的。

随后翻遍了 `Google`，找到了一个解决方案，就是使用 `xvfb` 。你可以理解成这个软件会帮我虚拟出一个桌面出来，我的代码(Chrome) 就会在这个虚拟桌面运行。完美解决刚刚的窘迫。

所以你能在 [entrypoint.sh](https://github.com/alo7/rebirth/blob/master/entrypoint.sh) 文件里看到下面的代码:

```sh
# open virtual desktop
xvfb-run --listen-tcp --server-num=76 --server-arg="-screen 0 2048x1024x24" --auth-file=$XAUTHORITY node index.js &
```

至此，整个工作其实已经算是OK了，接下来就是一些优化的方案

---

现在整个项目已经可以安安心心的在服务器(Docker)上进行录制了，但是我们看不到具体里面的内容。我不知道里面现在处于什么的情况，想进行一些调试。所以我在原有的基础上增加了 `VNC` 和 `Chrome Remote Debug` 调试模式。

`VNC` 的话，很简单，只要在 Docker 里安装了 VNC 的套件，再在 [entrypoint.sh](https://github.com/alo7/rebirth/blob/master/entrypoint.sh) 文件里增加如下代码即可：

```sh
x11vnc -display :76 -passwd password -forever -autoport 5920 &
```

`Chrome Remote Debug` 则有些麻烦，需要在 Chrome 启动参数里加上 `--remote-debugging-port=9222`，然后需要在 Docker 里安装 `socat` 软件，进行端口转发。

因为9222是 `Chrome Remote Debug` 的端口，但是 Chrome 不支持除本机以外的机器访问它。所以我们需要使用 `socat` 把 9222 端口转发到 9223 即可，在 [entrypoint.sh](https://github.com/alo7/rebirth/blob/master/entrypoint.sh) 文件的代码如下:

```sh
# forward chrome remote debugging protocol port
socat tcp-listen:9223,fork tcp:localhost:9222 &
```

---

因为这个 Docker 以后可能会部署到 k8s 上，或者其他地方，而部署后，总会遇到被通知说，你自杀吧（一般当集群资源不够时、CPU占用率过高时会通知）。那我们应该做成，当他们通知到这个 Docker(k8s为Pod)时，应该及时的回滚数据等操作。所以在 [entrypoint.sh](https://github.com/alo7/rebirth/blob/master/entrypoint.sh) 文件里有这么一段代码：

```sh
# get nodejs process pid
NODE_PID=$(lsof -i:80 | grep node | awk 'NR==1,$NF=" "{print $2}')

# forward SIGINT/SIGKILL/SIGTERM to nodejs process
trap 'kill -n 15 ${NODE_PID}' 2 9 15

# waiting nodejs exit
while [[ -e /proc/${NODE_PID} ]]; do sleep 1; done
```

先获取 node 进程的 PID，再把消息通知到 node 进程里。而 node 代码中又有这么一段：

```js
let status = false;
const exit = message => {
  if (status) return;

    console.log('the process was kill:', message);

    // 回滚操作

  status = true;

  process.exit();
};


process.once('exit', () => exit('exit'));
process.once('SIGTERM', () => exit('sigterm'));
process.on('message', message => {
  if (message === 'shutdown') {
    exit('shutdown');
  }
});
```

## 部署方式 {#deployment}

我们公司因为使用的 k8s 来部署的，所以我们目前的部署方式是这样的：

首先 Server 那里派发一个录制任务插入到数据库里，这个时候我写了另一个项目，这个项目会定期去扫数据库(目前为3分钟)，扫到一个数据就会调用 k8s 的 API 去创建 Job→Pod。完成一次录制任务，有兴趣可以看我之前写的文章: [基于任务量进行k8s集群的灵活调度处理](https://www.bugs.cc/p/flexible-scheduling-of-k8s-cluster-based-on-task-volume/)

## 其他 {#open-source}

目前项目已经开源，欢迎 Star 或 PR: [https://github.com/alo7/rebirth](https://github.com/alo7/rebirth)

[^tab-active]: 唯一的缺陷就是在调用这个 api 的时候，必须保证要录制的 tab 是激活状态，调用之后就可以跳转到其他页面了。

[^mediarecorder]: 不理解这个 API 的小伙伴，可以先初步理解成用来管理音视频流的。

[^headless]: 可以把 headless 理解成，在命令行启动 Chrome，通过命令 / API 进行交互，并且没有可视化页面。
