---
title: 分析 axios 源码来找出无法使用 all 和 spread 等方法的原因
description: 通过分析 Axios 的源码，来找出无法使用部分 Api 的问题
date: 2018-04-14T13:37:29+08:00
tags:
  - javascript
  - axios
translationKey: analyze-the-axios-source-to-find-out-why-you-cant-use-all-and-spread-methods
aliases:
  - /zh/2018/04/14/analyz-the-axios-source-to-find-out-why-you-cant-use-all-and-spread-methods/
  - /zh/p/analyz-the-axios-source-to-find-out-why-you-cant-use-all-and-spread-methods/
  - /zh/posts/分析axios源码来找出无法使用all和spread等方法的原因/
---

## 前言 {#intro}

如果你在使用 axios 的时候，是使用 `axios.create({})` 方法来进行创建 `axios` 的，那么你会发现你无法使用 `all`、`spread`、`Cancel`、`CancelToken`、`isCancel` 方法。

我上网查了相关的问题，axios 维护者们都是让你重新引入 `axios package` 来进行完成任务。我不喜欢这种方法，因为重新引入的话，那我的 axios 配置就会丢失，需要重新配置一遍，太过麻烦。

因为我们项目很多时候，不想使用默认的配置，想使用自定义设置的 axios 实例。比如设置基础 URL 和超时时间:

```js
let newAxios = axios.create({
  baseURL: 'https://www.google.com.hk',
  timeout: 1000
})
```

设置完后，使用 `newAxios.post` 来完成自己的需求，当然，如果你只使用 `get`、`post`、`put` 等基础的方法，是没有问题的。但是如果你使用 `all`、`spread`、`Cancel`、`CancelToken`、`isCancel` 方法，将会告诉你，方法不存在。

现在，让我们看一下 axios 源码是如何实现的，为什么使用 `axios.create` 方法后，就无法使用 `all`、`spread` 等方法。

## 正文 {#source-analysis}

我们先打开 axios 源码目录下的 `lib/axios.js` 文件。这个文件就是 `Axios` 入口处。也是 `create` 函数所在的地方。我们现在来看看 `create` 的源代码:

```js
axios.create = function create(instanceConfig) {
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};
```

我们先逐步解读。看到 `mergeConfig` 方法，大家就能从字面上理解了。这是一个合并配置的方法。就是把我们配置与默认配置进行合并，把我们的配置覆盖默认的配置。合并配置的代码，这里就不细说了，有兴趣的可以去 [mergeConfig](https://github.com/axios/axios/blob/master/lib/core/mergeConfig.js) 看下。所以现在的代码变成了这样:

```js
axios.create = function create(instanceConfig) {
  return createInstance({
    baseURL: 'https://www.google.com.hk',
    timeout: 1000,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    /* 等等 */
  });
};
```

现在看是不是就有点清晰了。现在我们看到还剩一个函数 `createInstance`，现在让我们去看一下:

```js
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, Axios.prototype, context);

  // Copy context to instance
  utils.extend(instance, context);

  return instance;
}
```

`context` 变量内容是 `axios` 实例代码。我们来看下，里面大致长啥样:

```js
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names: 0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names: 0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});
```

不用细看，我们只需要知道，实例 Axios 后，`context` 变量里的`原型链`上有 `request delete get head options post put patch` 方法，自身有 `request interceptors` 对象。

现在，让我们看下下面的 `bind` 和 `extend` 方法:

```js
var instance = bind(Axios.prototype.request, context);

// Copy axios.prototype to instance
utils.extend(instance, Axios.prototype, context);

// Copy context to instance
utils.extend(instance, context);
```

第一个 `bind` 函数，是让 Axios.prototype.request 函数里的 this 指向 `context` 变量。

后面两个 `extend` 方法，是把第二参数的可枚举对象复制到第一个参数中，也就是 `instance` 变量里。

我们从第一个 `bind` 方法开始，现在 `instance` 变量里有一个 `request` 方法。

然后第二个 `extend` 方法，把 `Axios.prototype` 里的方法复制到 `instance` 变量里。现在 `instance` 变量里有 `request delete get head options post put patch` 方法。

最后第三个 `extend` 方法，把 `context` 里的方法复制到 `instance` 变量里。现在变量里有 `request delete get head options post put patch interceptors defaults`。

然后就没了，`create` 方法直接返回 `instance` 变量。是不是根本没有看到 `all`、`spread` 等方法。这也就是为什么使用 `create` 方法后，无法使用这些方法。那么这些方法在哪呢？还是在 `lib/axios.js` 文件里:

```js
// Expose Cancel & CancelToken
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

module.exports = axios;

// Allow use of default import syntax in TypeScript
module.exports.default = axios;
```

可以看到，这里是把这些方法直接赋值在 axios 方法上，然后就直接暴露出去了。所以当我们使用 `axios` 可以使用 `all`、`spread` 等方法。但是使用 `axios.create` 就无法使用 `all`、`spread`、`Cancel`、`CancelToken`、`isCancel` 方法。

## 解决方案 {#solution}

如果能改 axios 源码的话，那可以把 `lib/axios.js` 改成如下，就行了:

```js
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, Axios.prototype, context);

  // Copy context to instance
  utils.extend(instance, context);

  utils.extend(instance, {
    Cancel: require('./cancel/Cancel'),
    CancelToken: require('./cancel/CancelToken'),
    isCancel: require('./cancel/isCancel'),
    all: function all(promises) {
      return Promise.all(promises);
    },
    spread: require('./helpers/spread')
  }, context);

  return instance;
}
```

但是，这当然不可能啦。所以，我们需要在不改源代码的情况下，去实现。

有一个暴力的解决方案，不过我挺喜欢的:

```js
let axios = require('axios');

const http = axios.create({
  baseURL: 'https://www.google.com.hk'
})

/* eslint-disable no-proto */
http.__proto__ = axios
/* eslint-enable */

module.exports = axios
```

是不是很简单，一行代码解决问题。[^eslint-proto]

[^eslint-proto]: 这里之所以要加上注释，因为在 `eslint` 里是不允许对 `__proto__` 进行重新赋值的。
