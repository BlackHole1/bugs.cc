---
title: 对 Promise 增加统一操作扩展
description: 添加一个无论是否成功失败，都会调用的函数，且函数知道上一步的状态
date: 2018-01-06T17:34:21+08:00
tags:
  - javascript
  - promise
translationKey: add-unified-operation-extensions-to-promise
aliases:
  - /zh/2018/01/06/add-unified-operation-extensions-to-promise/
  - /zh/p/add-unified-operation-extensions-to-promise/
  - /zh/posts/对promise增加统一操作扩展/
---

## 前言 {#intro}

在 ES6 里，增加了 `Promise` 方法。而 `Promise` 的回调函数只有 `then` 和 `catch` 两种方法。

而后，Promise 又添加了两种附加方法，当然需要自己去添加进去。

- 一个是 `done` 方法: [http://es6.ruanyifeng.com/#docs/promise#done](http://es6.ruanyifeng.com/#docs/promise#done)

- 一个是 `finally` 方法: [http://es6.ruanyifeng.com/#docs/promise#finally](http://es6.ruanyifeng.com/#docs/promise#finally)

可以去看一下上文的链接去了解一下，或者去下面的链接，看下官方源码是如何实现的: [done](https://github.com/then/promise/blob/master/src/done.js) 和 [finally](https://github.com/then/promise/blob/master/src/finally.js)

## 正文 {#unified-method}

但是却没有一个针对 `then` 和 `catch` 的统一操作。

如果在最后处理的时候，`then` 和 `catch` 的代码处理逻辑差不多的情况下，可能就需要写两份差不多的代码量。

当然可能会有些人会把差不多的代码处理逻辑提取到一个函数里，但是这样也不太美观，这个时候如果有一个回调函数可以同时处理 `resolve` 和 `reject` 就好了。

我们可以对 `Promise` 方法添加一个原型函数。这个函数来捕获 `resolve` 和 `reject`，然后进行处理返回，就好了。代码很简单，如下:

```js
Promise.prototype.unified = function (callback) {
  this.then(
    data => callback(true, data),
    data => callback(false, data)
  )
}
```

使用的方法也很简单，我们先写一个没有`统一操作`的 Promise 代码:

```js
let promise = new Promise(function(resolve, reject) {
  if (false){
    setTimeout(() => resolve('success'), 1000)
  } else {
    setTimeout(() => reject('error'), 1000)
  }
})

promise
  .then((data) => {
    console.log(
      state: true,
      data: data,
      msg: 'operation successful'
    )
  })
  .catch((data) => {
    console.log(
      state: false,
      data: data,
      msg: 'operation failed'
    )
  })
```

然后我们使用 `unified` 方法重写一个:

```js
let promise = new Promise(function(resolve, reject) {
  if (false){
    setTimeout(() => resolve('success'), 1000)
  } else {
    setTimeout(() => reject('error'), 1000)
  }
})

promise.unified((state, data) => {
  const msg = state ? 'operation successful' : 'operation failed'
  console.log(
    state,
    data,
    msg
  )
})
```

是不是方法了很多，当然此方法属于代码耦合了。也请谨慎使用，不然后期维护会很麻烦。
