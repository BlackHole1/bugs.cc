---
title: Add a unified operation extension to Promise
description: Add a callback that always runs, success or failure, and knows the previous state
date: 2018-01-06T17:34:21+08:00
tags:
  - javascript
  - promise
translationKey: add-unified-operation-extensions-to-promise
---

## Intro

ES6 added `Promise`. A Promise only has two callback methods: `then` and `catch`.

Later, Promise also got two extra methods. You have to attach them yourself, of course.

- One is `done`: [http://es6.ruanyifeng.com/#docs/promise#done](http://es6.ruanyifeng.com/#docs/promise#done)

- One is `finally`: [http://es6.ruanyifeng.com/#docs/promise#finally](http://es6.ruanyifeng.com/#docs/promise#finally)

Follow the links above if you want the background, or look at the official source for how they are implemented: [done](https://github.com/then/promise/blob/master/src/done.js) and [finally](https://github.com/then/promise/blob/master/src/finally.js)

## The unified method

There is still no unified handler for `then` and `catch`.

If the last-step logic in `then` and `catch` is basically the same, you end up writing it twice.

You can pull the shared logic into a function, but that still looks a bit awkward. It would be nicer to have one callback that handles both `resolve` and `reject`.

We can add a method on `Promise.prototype`. That method catches `resolve` and `reject`, then hands them to a callback. The code is simple:

```js
Promise.prototype.unified = function (callback) {
  this.then(
    data => callback(true, data),
    data => callback(false, data)
  )
}
```

Usage is straightforward. First, a Promise without the unified handler:

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

Now the same thing with `unified`:

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

A lot more convenient, right? That said, this couples the code. Use it carefully or later maintenance will hurt.
