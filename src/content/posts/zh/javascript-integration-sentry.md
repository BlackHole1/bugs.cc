---
title: JavaScript 集成 Sentry
description: 在 React 里集成 Sentry，以及浅入介绍原理
date: 2018-08-24T09:16:33+08:00
tags:
  - javascript
  - react
  - electron
translationKey: javascript-integration-sentry
aliases:
  - /zh/2018/08/24/javaScript-integration-sentry/
  - /zh/p/javaScript-integration-sentry/
  - /zh/posts/javascript集成sentry/
---

## Sentry-JavaScript

> Sentry 是一套用于捕获产品错误的开源项目，其下支持很多语言、框架。

> 这里就只阐述在前端 JavaScript 方向的处理操作

在我们公司之前的应用场景里，很多项目都是使用 `kibana` 来做信息统计。但是我们无法清楚的知道应用的运行状态是怎么样的。当某个客户在使用我们开发产品时，如果报错、崩溃。用户只能向客服寻求帮助，再交接给我们的开发人员进行复现、修复。其中因为不清楚具体的数据，开发人员是在复现时会非常的耗时。

而 `Sentry` 的用途就是解决这一痛点问题，让开发人员快速准确的定位到问题的根源所在，以达到快速修复，让开发人员更注重于开发新的功能上面。减少时间资源上的浪费。

### JavaScript

#### 接入 {#setup}

因为 `Sentry` 使用的是一种 `Hook` 错误函数的技术，来达到捕获错误的目的，所以我们基本可以无损耗的接入到现有的项目中去。

下面是 `React` 与 `Sentry` 进行结合的一些基本步骤。

React:

```js
#SentryBoundary.js
import { Component } from "react";
import Raven from "raven-js";

export default class SentryBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error });
    // 发送错误信息
    Raven.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.error) {
      // 此处可以写成组件，当组件崩溃后，可以替换崩溃的组件
      console.log("React Error");
    }
    return this.props.children;
  }
}
```

```js
#index.js
Raven.config("DSN", {
  release: release,
}).install();

ReactDOM.render(
  <div>
    <SentryBoundary>
      <App />
    </SentryBoundary>
  </div>,
  document.getElementById("root")
);
```

##### 上传 source-map {#upload-source-map}

如果上面的代码已经配置好后，那么现在的应用是可以捕获到错误的，但是存在了一个问题，我们目前的项目大多都使用 `webpack` 进行打包，而打包后的代码是混淆加密的代码，无法让我们准确的知道抛出错误的位置在哪里。所以我们需要上传 `source-map` 和混淆后的文件一起上传到 `Sentry` 服务器上。方便我们快速查找到问题所在的位置。

这个上传的配置及命令是比较繁琐的。也是项目结合 `Sentry` 的一个难点。

上传 `source-map` 目前有两种方式:

- 使用 `Sentry` 提供的 `Webpack` 插件进行配置，但是其灵活性不高。
- 使用 `sentry-cli` 的，其灵活性比较高，可以针对不同项目进行单独的配置。

其配置较为繁琐，这里就不在阐述。具体的 React 与 Sentry 结合的例子。可见我在 github 上的项目: [react-sentry-demo](https://github.com/BlackHole1/react-sentry-demo)。对每个配置都有详细的说明。其中的上传 `source-map`，我使用的是第二种方法，并写了一个脚本，实现了:  **打包、环境检测、认证检测、上传 source-map、删除本地 source-map 的操作**，完成自动化，可以把脚本直接迁移到现有的项目中去，改动也不会太大。

其核心上传命令如下:

```bash
sentry-cli releases files v1.8 upload-sourcemaps {js文件和js.map所在目录。如果没有找到，sentry会遍历其子目录} --url-prefix '~/{过滤规则}'`;
```

#### 浅入原理 {#how-it-works}

在 JavaScript 中是有 `window.onerror` 这个方法的，而 `Sentry` 在前端的核心捕获原理，就是通过重写此方法，来对所有的错误进行捕获。其实现的代码大致如下:

```js
let _winError = window.onerror;
window.onerror = function (message, url, lineNo, colNo, errorObj) {
    console.log(`
	错误信息: ${message}
	错误文件地址: ${url}
	错误行号: ${lineNo}
	错误列号: ${colNo}
	错误的详细信息 ${errorObj}`);
}
```

然后 `Sentry` 的工作就是获取非错误的数据，如: `user-agent`、`浏览器信息`、`系统信息`、`自定义信息`等信息，然后交给 `Sentry` 的生命周期函数，最后在把数据发送到 `Sentry` 服务端，进行错误信息展示。

#### 兼容性 {#compatibility}

这里所说的兼容性，其实也就是 `window.onerror` 的兼容性

##### 运行环境兼容性 {#runtime-compatibility}

| 环境                    | message |  url  | lineNo | colNo | errorObj |
| ----------------------- | : -----: | : ---: | : ----: | : ---: | : ------: |
| Firefox                 |    ✓    |   ✓   |   ✓    |   ✓   |    ✓     |
| Chrom                   |    ✓    |   ✓   |   ✓    |   ✓   |    ✓     |
| Edge                    |    ✓    |   ✓   |   ✓    |   ✓   |    ✓     |
| IE 11                   |    ✓    |   ✓   |   ✓    |   ✓   |    ✓     |
| IE 10                   |    ✓    |   ✓   |   ✓    |   ✓   |          |
| IE 9                    |    ✓    |   ✓   |   ✓    |   ✓   |          |
| IE 8                    |    ✓    |   ✓   |   ✓    |       |          |
| Safari 10 and up        |    ✓    |   ✓   |   ✓    |   ✓   |    ✓     |
| Safari 9                |    ✓    |   ✓   |   ✓    |   ✓   |          |
| Opera 15+               |    ✓    |   ✓   |   ✓    |   ✓   |    ✓     |
| Android Browser 4.4     |    ✓    |   ✓   |   ✓    |   ✓   |          |
| Android Browser 4 - 4.3 |    ✓    |   ✓   |        |       |          |
| 微信 webview(安卓)       |    ✓    |   ✓   |   ✓    |   ✓   |          |
| 微信 webview(IOS)        |    ✓    |   ✓   |   ✓    |   ✓   |    ✓     |
| WKWebview               |    ✓    |   ✓   |   ✓    |   ✓   |    ✓     |
| UIWebview               |    ✓    |   ✓   |   ✓    |   ✓   |    ✓     |

##### 标签兼容性 {#tag-compatibility}

| 标签   | window.onerror 是否能捕获                                                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| img    | 可以                                                                                                            |
| script | 需要再 script 标签添加 `crossorigin` 属性，并在服务端允许跨域。如果不使用这个属性，错误信息只会显示 `Script error.` |
| css    | 不能                                                                                                            |
| iframe | 不能                                                                                                            |

可以发现其浏览器都支持此方法。只是有些运行环境不支持 `colNo` 和 `errorObj`，但是这块，`Sentry` 已经帮你处理好了，所以不用担心。只是会在展示错误的时候，信息不太完整而已。

#### 所能捕获的信息 {#captured-info}

##### 错误信息 {#error-info}

从上面的浅入原理可以看到，其核心捕获是 `window.onerror`。那么只要它可以捕获到的错误，都会发送到 `Sentry` 上。

而 `window.onerror` 能捕获到的错误，除了 `Promise`，基本上能在控制台出现的错误，都会捕获到。也就是运行时的错误，包括语法错误。

关于捕获 `Promise` 错误的方案，可以使用:

`window.addEventListener('unhandledrejection', event => {})`

来进行捕获，但是此事件的兼容性不太好，目前只有 `webkit内核` 支持这个事件。

如下代码，是此方法所能捕获到的:

```js
const p = new Promise((reslove, reject) => reject('Error'))
p.then(data => {
  console.log(data)
})
// Promise 触发了 reject 回调函数，但是却没有相应到 catch 来应对。从而导致报错。
```

##### 面包屑信息 {#breadcrumbs}

- Ajax 请求
- URL 地址的变化
- UI 点击和按下的 DOM 事件
- 控制台的 console 信息
- 之前的错误
- 自定义的面包屑信息

#### 展示信息 {#display}

![](/images/javaScript-integration-sentry/sentry-error-detail.png)

### Electron 集成 {#electron}

这里的集成，也不是说捕获 Electron 应用的错误，而是崩溃。因为 Electron 只是一个容器，里面的内容还是 JavaScript 应用。

#### 接入 {#electron-setup}

刚刚也说到这里的集成也只是去捕获 Electron 崩溃的信息。而当 Electron 崩溃时，会触发 Electron 的函数: `crashReporter.start`，那么我们在这个函数里去配置一下自己的 `sentry` 信息:

```js
import { crashReporter } from 'electron'

crashReporter.start({
  productName: 'aoc-desktop',
  companyName: 'alo7',
  submitURL:
    'https://sentry.com/api/15376/minidump/?sentry_key=3e05fa101f035008e953ff56909b8eb',	// sentry 提供的 minidump 接口
  extra: {
    // 额外信息
  }
})
```

配置好后，可以使用 `process.crash()` 来模拟崩溃，以便查看 Sentry 是否能收到崩溃信息。

##### 上传 Symbol(符号表) {#upload-symbols}

在上面的应用说的是上传 `source-map`，但是这里上传的是 Symbol。可以把 `Symbol` 理解为另一种 `source-map`。

Symbol 的格式 (后缀) 有很多，Mac 下是 `dSYM`，windows 是 `pdb`。而在 Sentry 里，暂时是不支持上传 `pdb` 的。需要使用 `dump_syms.exe` 来把 `pdb` 格式转化成 `sym` 格式。再上传到 Sentry 里。这样就可以在 Sentry 崩溃的时候，看到起崩溃的上下文了。如下图:

![](/images/javaScript-integration-sentry/sentry-crash-symbols.png)

这样就可以准确的定位到是哪里出现了问题。

### 浅入上传检索的原理 {#source-map-matching}

当 Sentry 服务端收到 `source-map` 时，是通过你上传时的 `url-prefix` 信息，与 source-map 文件以及运行时的 js 文件，产生对应。流程图如下:

![](/images/javaScript-integration-sentry/sourcemap-matching-flow.png)
