---
title: 通过 Webkit 远程调试协议监听网页崩溃
description: 基于 chrome remote interface 来检测网页是否 Crash
date: 2019-04-22T15:51:25+08:00
tags:
  - javascript
  - nodejs
  - webkit
  - puppeteer
  - chrome
translationKey: webkit-remote-debugging-protocol-listening-crash
aliases:
  - /zh/2019/04/22/webkit-remote-debugging-protocol-listening-crash/
  - /zh/p/webkit-remote-debugging-protocol-listening-crash/
  - /zh/posts/通过webkit远程调试协议监听网页崩溃/
---

## 背景介绍 {#intro}

因为正在开发一个项目，而这个项目使用到了 `puppeteer`，其中有个功能是在 `puppeteer` 打开的 chrome 里打开多个 `Tab`，并进行管理。
虽然 `puppeteer` 可以打开多个网站，但是并不利于管理，所有我使用的是插件的方式，通过插件来打开多网站，并进行管理。

但是这里有个需求是，当网站崩溃时，我要做出一些操作。但是目前网上没有一个好的办法去监听当前网站是否崩溃。

可能有同学会说: `puppeteer` 不是提供了一个 `page.on('error', fn)` 的方法，来进行监听么？

请注意上文中提到的，使用插件打开多个网站，`puppeteer` 提供的方法只能对自己打开的网站起作用，没有使用 `puppeteer` 打开的网站，`page.on('error', fn)` 方法无能为力。

## 使用 Service Workers {#service-workers}

这个方法是由我同事 [Haitao](https://github.com/liubiantao) 提出来的思路。

在当前网站上运行一个 `Service Workers`，因为在运行的时候 `Service Workers` 会再启动一个单独的进程，当前网站和 `Service Workers` 是两个单独的进程。也就是说当网站崩溃时，并不影响 `Service Workers` 进程。所以可通过`心跳检测`来进行判断网站是否崩溃。

网上也有阿里的同学写的相关文章: [如何监控网页崩溃？](https://zhuanlan.zhihu.com/p/40273861)

但是我并没有使用这个方式，因为当 `Service Workers` 崩溃了，那就没有任何办法了，可能有同学会说: 网站和 `Service Workers` 互相发`心跳检测`。这可能是一种办法，但是我不太喜欢这种方式。

## 使用 Webkit 的远程调试协议 {#remote-debugging}

### 介绍 {#remote-debugging-intro}

在开始前，我们先去看下 `puppeteer` 的源码，为什么 `puppeteer` 可以监听到网页的崩溃。

其代码在 `lib/Page.js` 文件里。

首先可以看到 Page 是一个 `Class`，其继承了 `EventEmitter`，`EventEmitter` 为 `page` 提供了 `on` 方法，也就是我们之前看到的: `page.on('error', fn)`

从这里就可知，在 `Page Class` 里，有地方调用了 `this.emit('error')` 来触发 `error event`。搜了一下，发现其代码在 `_onTargetCrashed` 方法里。如:

![](/images/webkit-remote-debugging-protocol-listening-crash/puppeteer-ontargetcrashed.png)

触发 `crash` 的方法，我们找到了。那这个 `_onTargetCrashed` 又是在哪触发的呢？

![](/images/webkit-remote-debugging-protocol-listening-crash/inspector-targetcrashed-listener.png)

可见，是一个叫 `client` 的方法监听到了 `Inspector.targetCrashed` 事件，而这个事件触发了 `_onTargetCrashed` 函数，`clinet` 方法就不再跟了，因为跳地方较多，只需要知道，最终 `client` 是一个 `websocket` 的产物。而 `websocket` 创建的代码在 `lib/Launcher.js` 里。[代码位置](https://github.com/GoogleChrome/puppeteer/blob/19606a3b79/lib/Launcher.js#L169-L179)

![](/images/webkit-remote-debugging-protocol-listening-crash/launcher-connection-create.png)

注意这两行:

```js
const transport = new PipeTransport((chromeProcess.stdio[3]), (chromeProcess.stdio[4]));

connection = new Connection('', transport, slowMo);
```

`chromeProcess` 是 `nodejs` 中的 `spawn` 产物，代码为:

[代码位置](https://github.com/GoogleChrome/puppeteer/blob/19606a3b79/lib/Launcher.js#L126-L137)

```js
const chromeProcess = childProcess.spawn(
  chromeExecutable,
  chromeArguments,
  {
    detached: process.platform !== 'win32',
    env,
    stdio
  }
);
```

其中 `chromeArguments` 是 `chrome` 启动的参数列表，此列表是有一个 `--remote-debugging-` 的:

[代码位置](https://github.com/GoogleChrome/puppeteer/blob/19606a3b79/lib/Launcher.js#L108-L109)

```js
if (!chromeArguments.some(argument => argument.startsWith('--remote-debugging-')))
  chromeArguments.push(pipe ? '--remote-debugging-pipe' : '--remote-debugging-port=0');
```

现在就明朗多了，`Inspector.targetCrashed` 这个事件，是由 `Webkit远程调试协议` 也就是 `remote debugging protocol` 提供的。

其定义在 webkit 的 `Inspector.json` 里: [Source/WebCore/inspector/Inspector.json#L39-L42](https://github.com/WebKit/webkit/blob/255ba17d1d7e0ad1530d503f28ee5d93d7c5351e/Source/WebCore/inspector/Inspector.json#L39-L42)

关于这个 `event` 的 commit url 为: [https://github.com/WebKit/webkit/commit/255ba17d1d7e0ad1530d503f28ee5d93d7c5351e#diff-4681ce2c9384e770dfac03ab133f133b](https://github.com/WebKit/webkit/commit/255ba17d1d7e0ad1530d503f28ee5d93d7c5351e#diff-4681ce2c9384e770dfac03ab133f133b)

### 编写解决方案代码 {#solution-code}

现在我们知道了，只要能监听到 `Inspector.targetCrashed` 事件，就可以知道网站是否关闭了。我们先在 `puppeteer` 的启动参数里，增加一行启动参数:

```js
puppeteer.launch({
  args: [
    '--remote-debugging-port=9222'
    // other args
  ]
});
```

当 `puppeteer` 启动时，会监听本地的 `9222` 端口，其中路径 `/json` 为当前的详情。如:

![](/images/webkit-remote-debugging-protocol-listening-crash/devtools-json-endpoint.png)

其格式为:

```json
[
  {
    "description": "",
    "devtoolsFrontendUrl": "/devtools/inspector.html?ws=127.0.0.1:9222/devtools/page/A1CB5A9CC25A7EE8A99C6A4A1876E4D3",
    "faviconUrl": "https://s.ytimg.com/yts/img/favicon_32-vflOogEID.png",
    "id": "A1CB5A9CC25A7EE8A99C6A4A1876E4D3",
    "title": "張三李四 Chang and Lee 【等無此人 Waiting】 - YouTube",
    "type": "page",
    "url": "https://www.youtube.com/watch?v=lAcUGvpRkig&list=PL3p0C_7POnMHG-b0dzkeTVdNuM6yRE5iQ&index=10&t=0s",
    "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/page/A1CB5A9CC25A7EE8A99C6A4A1876E4D3"
  }
]
```

其中的 `type` 为当前进程的详情:

- page: 网页
- iframe: 网页嵌套的 iframe
- background_page: 插件页面
- service_worker: Service Workers

这个 type 的作用在于，你只想监听某一类型的崩溃。

还有一个更主要的字段: `webSocketDebuggerUrl`。我们将使用这个字段的值，来进行获取消息。有一个简单的 demo:

```js
const http =  require('http');
const WebSocket = require('ws');

http.get('http://127.0.0.1:9222/json', res => {
  res.addListener('data', data => {
    const result = JSON.parse(data.toString());
    result.forEach(info => {
      const client = new WebSocket(info.webSocketDebuggerUrl);
      client.on('message', data => {
        if (data.indexOf('"method":"Inspector.targetCrashed"') !== -1) {
          console.error('crash!');
        }
      });
    });
  })
})
```

先看懂这段代码，后面的代码才好理解，因为代码过于简单，这里就不再介绍了。

这段代码有个问题是，插件打开网站时，会存在一定的延迟，可能会导致某些网站没有被监听到，而且当这段代码运行后，插件再打开网站时，也不会监听到。针对这个问题，优化了下代码:

```js
const http =  require('http');
const WebSocket = require('ws');

module.exports = () => {
  const wsList = {};
  let crashStaus = false;

  const getWsList = () => {
    return new Promise((resolve) => {
      http.get('http://127.0.0.1:9222/json', res => {
        res.addListener('data', data => {
          try {
            const result = JSON.parse(data.toString());
            const tempWsList = {};

            result.forEach(info => {
              if (typeof wsList[info.id] === 'undefined') {
                tempWsList[info.id] = info.webSocketDebuggerUrl;
                wsList[info.id] = info.webSocketDebuggerUrl;
              }
            });

            if (Object.keys(tempWsList).length !== 0) {
              resolve(tempWsList);
            }
          } catch (e) {
            console.error(e);
          }
        });
      });
    });
  };

  setInterval(() => {
    getWsList().then(list => {
      Object.values(list).forEach(wsUrl => {
        const client = new WebSocket(wsUrl);
        client.on('message', data => {
          if (data.indexOf('"method":"Inspector.targetCrashed"') !== -1) {
            if (!crashStaus) {
              crashStaus = true;
              console.log('crash!!!');
            }
          }
        });
      })
    });
  }, 1000);
};
```

其中需要说明一下这段代码:

```js
if (!crashStaus) {
  crashStaus = true;
  console.log('crash!!!');
}
```

因为我的需求是，任何一个进程 `crash` 了，就关闭整个服务，重新运行。所以如果有多个进程同时 `crash` 了。我的代码只走一次，不想让他走多次。这个是针对我这里的需求，各位同学可以根据自己的需求更改代码。

## 参考 {#references}

> [Webkit 远程调试协议初探](http://taobaofed.org/blog/2015/11/20/webkit-remote-debug-test/)

> [Chrome 远程调试协议分析与实战](http://fex.baidu.com/blog/2014/06/remote-debugging-protocol/)
