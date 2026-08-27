---
title: Analyze the axios source to find out why you can't use all and spread
description: Find why some APIs don't work by reading Axios source
date: 2018-04-14T13:37:29+08:00
tags:
  - javascript
  - axios
translationKey: analyze-the-axios-source-to-find-out-why-you-cant-use-all-and-spread-methods
---

## Intro {#intro}

If you create axios with `axios.create({})`, you will find you cannot use `all`, `spread`, `Cancel`, `CancelToken`, or `isCancel`.

I looked this up. Axios maintainers tell you to import the `axios package` again. I don't like that, because re-importing drops my axios config and I have to set it up again.

We often don't want the default config. We want a custom axios instance, for example with a base URL and timeout:

```js
let newAxios = axios.create({
  baseURL: 'https://www.google.com.hk',
  timeout: 1000
})
```

After that you use `newAxios.post`. `get`, `post`, `put` and the other basic methods work. But if you use `all`, `spread`, `Cancel`, `CancelToken`, or `isCancel`, you will be told the method does not exist.

Let's look at how axios implements this, and why those methods disappear after `axios.create`.

## Source analysis {#source-analysis}

Open `lib/axios.js` in the axios source. This file is the `Axios` entry point, and where `create` lives. Here is the `create` source:

```js
axios.create = function create(instanceConfig) {
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};
```

Let's read it step by step. `mergeConfig` is what it sounds like: it merges our config with the defaults, and ours override the defaults. I won't go into the merge code. If you're interested, see [mergeConfig](https://github.com/axios/axios/blob/master/lib/core/mergeConfig.js). So the code is now effectively:

```js
axios.create = function create(instanceConfig) {
  return createInstance({
    baseURL: 'https://www.google.com.hk',
    timeout: 1000,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    /* etc. */
  });
};
```

That's a bit clearer. Next is `createInstance`:

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

`context` is the `axios` instance. Roughly:

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

No need to read it in detail. After `new Axios`, `context`'s prototype chain has `request delete get head options post put patch`, and the instance itself has a `request interceptors` object.

Now look at `bind` and `extend`:

```js
var instance = bind(Axios.prototype.request, context);

// Copy axios.prototype to instance
utils.extend(instance, Axios.prototype, context);

// Copy context to instance
utils.extend(instance, context);
```

The first `bind` makes `this` inside Axios.prototype.request point to `context`.

The two `extend` calls copy enumerable properties from the second argument onto the first, which is `instance`.

Starting from `bind`, `instance` now has a `request` method.

The second `extend` copies methods from `Axios.prototype` onto `instance`. Now `instance` has `request delete get head options post put patch`.

The third `extend` copies methods from `context` onto `instance`. Now it has `request delete get head options post put patch interceptors defaults`.

That's it. `create` returns `instance`. There is no `all`, `spread`, or the others. That's why they don't work after `create`. Where are they? Still in `lib/axios.js`:

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

These methods are assigned directly onto the axios function, then exported. So with `axios` you can use `all`, `spread`, and the rest. With `axios.create` you cannot use `all`, `spread`, `Cancel`, `CancelToken`, or `isCancel`.

## Solution {#solution}

If you could change axios source, you would change `lib/axios.js` like this:

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

Of course that's not going to happen. We need to do it without changing source.

Here's a blunt solution, which I like:

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

Pretty simple, one line.[^eslint-proto]

[^eslint-proto]: The comments are there because `eslint` does not allow reassigning `__proto__`.
