---
title: 聊聊 RxJS 中的错误重试
description: 使用 RxJS 操作符对请求进行错误重试
date: 2019-01-12T18:52:05+08:00
tags:
  - javascript
  - rxjs
translationKey: rxjs-error-retry
aliases:
  - /zh/2019/01/12/rxjs-error-retry/
  - /zh/p/rxjs-error-retry/
  - /zh/posts/聊聊rxjs中的错误重试/
---

## 前言 {#intro}

最近工作中有一个需求是: 如果这个请求超时，则进行重试，且重试次数可配置。

首先我们发请求使用的库为: `Axios`，其处理请求的位置，是在 `redux-observable` 中的 `epic` 里。

那么如果要完成重试机制的话，有两种办法:

- 在对 `Axios` 封装的函数里添加重试代码
- 在 `epic` 里，使用 `RxJS` 操作符进行重试。

关于 `Axios` 重试的，其实比较麻烦的，而且需要在原有封装好的函数里，继续添加重试代码，总感觉不太好。且维护起来也不太方便。于是那就使用 `RxJS` 操作符进行重试吧。本文代码将不会套用项目代码，而是重新写一个 `Demo`，方便理解。

## RxJS 错误重试操作符 {#retry-operators}

在 `RxJS` 中，提供了两个操作符 `retry` 和 `retryWhen`。

需要注意的是: 重试时，这两个操作符都会重试整个**序列**。

且 `retry` 和 `retryWhen` 只捕获 `Error`，但是对 `Promise` 有点无能为，解决方案文中会说明。

### retry

`retry` 操作符是用来指定重试次数，比如遇到错误了，将会重试 n 次。以下是 `Demo`:

```typescript
const source = Rx.Observable.interval(1000)

const example = source.map(val => {
  if (val === 2) {
    throw Error('error');
  }
  return val;
}).retry(1)

example.subscribe({
  next: val => console.log(val),
  error: val => console.log(val.message)
});
```

[在线运行](https://jsbin.com/zixeqin/edit?js,console)

上面的代码，会每隔 1 秒钟发出一次数字序列，当使用 `subscribe` 订阅后，一秒钟后会发出 0，第二秒发出 1，以此类推。

然后每次的数字序列都会到到达 `map` 操作符里，在 `map` 操作符中，我们可以看到当数字序列等于 2 时，则会抛出错误。不等于 2 时，则原封不动的返回，最终到达 `subscribe` 中的 `next` 函数。

运行结果如图:

![](/images/rxjs-error-retry/retry-console.png)

首先发出 0 和 1，没有问题，当 val 为 2 时，抛出错误。被 `retry` 捕获到，重新走一遍整个 `RxJS` 序列。于是会发现又发了一次 0 和 1，这个时候又到 2 了，于是继续报错，但是 `retry` 的重试次数已经用完，则 `retry` 就不会再管了，直接跳过。于是被 `subscribe` 中的 `error` 函数捕获到。打印出 `error`。

### retryWhen

上面的 `retry` 操作符，只能用来设置重试次数，我们有时想做成: 重试时，打印日志，或者其他操作。那么这个时候 `retry` 就不太适合了。所以我们需要 `retryWhen` 来操作。

代码如下:

```typescript
const source = Rx.Observable.interval(1000)

const example = source.map(val => {
  if (val === 2) {
    throw Error('error')
  }
  return val;
}).retryWhen(err => {
  return err
    .do(() => console.log('正在重试'))
    .delay(2000)
})

example.subscribe({
  next: val => console.log(val),
  error: val => console.log(val.message)
});
```

[在线运行](https://jsbin.com/zixeqin/10/edit?js,console)

运行结果如图:

![](/images/rxjs-error-retry/retrywhen-delay-console.png)

其发送逻辑和上面差不多，只是处理的时候不同了。

我们使用 `retryWhen` 操作符来控制重试的逻辑，我们先使用 `do` 操作符，在控制台打印字符串，再使用 `delay` 来延迟 2 秒进行重试。

但是这里会一直重试，没有设置重试次数的地方，解决方案在下一章节。

### retry + retryWhen

这个时候，我们发现 `retry` 可以设置重试次数，`retryWhen` 可以设置重试逻辑。

但是我们想设置重试次数，又想设置重试逻辑，那应该怎么办呢？

OK，先让我们看看 `retryWhen` 操作符。这个操作符如果内部触发了 `Error` 或者 `Completed`，那么就会停止重试，将会把内部触发的 `Error` 或者 `Completed` 交给 `subscribe` 的订阅操作符。可能这样说，比较麻烦，我们先上 `Demo`，按照 `Demo` 来说，会有助于理解:

```typescript
const source = Rx.Observable.interval(1000)

const example = source.map(val => {
  if (val === 2) {
    throw Error('error')
  }
  return val;
}).retryWhen(err => {
  return err
    .scan((acc, curr) => {
      if (acc > 2) {
        throw curr
      }
      return acc + 1
    }, 1)
})

example.subscribe({
  next: val => console.log(val),
  error: val => console.log(val.message)
});
```

[在线运行](https://jsbin.com/zixeqin/16/edit?js,console)

结果如图:

![](/images/rxjs-error-retry/retrywhen-scan-error.png)

发送逻辑没有变化，但是出现了新的操作符: `scan`，那么这个操作符是做什么用的呢？

可以把 `scan` 理解为 `javascript` 中的 `reduce` 函数，这个操作符，具有两个参数，第一个是回调函数，第二个是默认值。就比如上面的代码，默认值是 1，acc 第一次是 1，第二次重试时，acc 就是 2，第三次重试时，acc 为 3，已经大于 2 了，那么 `if` 表达式则会 true，直接使用 `throw` 抛出 `curr`，这里的 `curr` 其实就是上面的错误原文。上文也说道了，如果在 `scan` 内初触发了 `Error` 则会停止重试，交给下面的 `subscribe`，然后触发了订阅的 `error` 函数，打印出 `error`。

其实满足重试次数后，把错误再抛出去，是比较正常的操作，让后面的操作符，对错误进行处理。但是可能有些人的业务需求是需要返回 `Completed`，那么可以参考下面的代码:

```typescript
const source = Rx.Observable.interval(200)

const example = source.map(val => {
  if (val === 2) {
    throw Error('error')
  }
  return val;
}).retryWhen(err => {
  return err
    .scan((acc, curr) => {
      return acc + 1
    }, 0)
    .takeWhile(v => v <= 2)
})

example.subscribe({
  complete: () => console.log('Completed'),
  next: val => console.log(val),
  error: val => console.log(val.message)
});
```

[在线运行](https://jsbin.com/zixeqin/17/edit?js,console)

运行结果如图:

![](/images/rxjs-error-retry/retrywhen-takewhile-completed.png)

可以看到使用了一个新的操作符 `takeWhile`。这个操作符接受一个函数，如果这个函数返回了 `true`，则继续把值交给下面的操作符，一旦函数返回 `false`，则会触发 `subscribe` 中的 `complete`，也就是说这个序列已经完成。这样看的话，你就明白上面的代码的意图了。

## 解决 Promise 问题 {#promise-retry}

上文也说了 `retry` 和 `retryWhen` 是不支持 `Promise.reject()` 的，其实这里的表达不太准确，应该说是 **Promise 没有重试的 API**，当重试的时候 `Promise` 已经在运行中了，所以无法再次调用该方法。也就造成了 `retry` 和 `retryWhen` 不能对 `Promise` 进行重试。那么解决方案也很简单了。

我们可以使用 `defer` 操作符，现在来简单说明下这个操作符的用处。

`defer` 接受一个函数参数，其函数不会运行，只有你使用 `subscribe` 去订阅的时候，才会去运行函数。并且运行函数，都是在独立的运行空间内，也就说，即使我们使用 `Promise`，也不会造成无法重试的情况，因为它不是复用之前的结果，而是重新开启一个新的内存空间，去运行函数，返回函数结果。

那么我们就可以把代码写成下面这样:

```typescript
const getInfo: AxiosPromise = axios.get('http://xxx.com')
const exp = defer(() => getInfo)
  .retryWhen(err => {
    return err.scan((acc, curr) => {
      if (acc > 2) {
        throw curr
      }

      return acc + 1
    }, 1)
  })

example.subscribe({
  next: val => console.log(val),
  error: val => console.log(val.message)
});
```
