---
title: pm2 configuration for Vue+Koa
description: Using pm2 to manage a Vue frontend and a Koa backend
date: 2017-11-07T21:37:00+08:00
tags:
  - nodejs
  - vue
  - koa
translationKey: koa-pm2-configuration
---

## Background

The stack I am using is: Vue on the frontend, Koa on the backend, Mongodb as the database.

Every time I start the services, I have to run `npm start` and `node ./server/app.js`, and keep both windows open. That is a hassle.

And because I am using Koa, I did not use 狼叔's Koa scaffold. I rolled a small MVC myself based on Liao Xuefeng's [Koa framework](https://www.liaoxuefeng.com/wiki/001434446689867b27157e896e74d51a89c25cc8b43bdb3000/001434501579966ab03decb0dd246e1a6799dd653a15e1b000). So there is no hot reload.

To cut these unnecessary steps and add hot reload, I started thinking about how to improve this. I went with `pm2`.

## Configuring pm2

Install pm2 first: `npm i pm2`, `npm i pm2 -g`
Because this is an open source project, so the code can run on other people's machines, pm2 needs to live in the project. Then install it globally, which is convenient for later debugging.

Create a logs directory in the project root.

In the current directory, create a pm2.json file, with the following content:

```json
{
  "apps": [{
    "name": "koler-server",
    "script": "./app.js",
    "error_file"      : "../logs/server-err.log",
    "out_file"        : "../logs/server-out.log",
    "merge_logs"      : true,
    "log_date_format" : "YYYY-MM-DD HH:mm Z",
    "cwd": "./server",
    "watch": [
      "app.js",
      "controllers"
    ],
    "watch_options": {
      "followSymlinks": false
    }
  },{
    "name": "koler-app",
    "script": "./build/dev-server.js",
    "error_file"      : "./logs/app-err.log",
    "out_file"        : "./logs/app-out.log",
    "merge_logs"      : true,
    "log_date_format" : "YYYY-MM-DD HH:mm Z",
    "cwd": "./",
    "ignore_watch" : [
      "node_modules"
    ],
    "watch_options": {
      "followSymlinks": false
    }
  }]
}
```

This starts two projects at once.
`koler-server` is Koa, `koler-app` is the Vue frontend.

I tried lifting

```json
"error_file"      : "./logs/app-err.log",
"out_file"        : "./logs/app-out.log",
"merge_logs"      : true,
"log_date_format" : "YYYY-MM-DD HH:mm Z",
```

to the root of the JSON, but it did nothing. Looks like pm2 does not support that. So I had to write it in each app.

## Configuring package.json

Replace `dev` under the previous `script` field, then add a `stop` field. After the change:

```json
"scripts": {
  "dev": "pm2 start pm2.json && pm2 logs",
  "start": "npm run dev",
  "stop": "pm2 stop koler-app koler-server && pm2 delete koler-app koler-server",
  "build": "node build/build.js",
  "lint": "eslint --ext .js,.vue src"
},
```

`pm2 start pm2.json && pm2 logs` starts from the pm2.json config. The `pm2 logs` after it is there to tail Vue and Koa logs at the same time.

After you run `npm start`, the terminal looks like this:

![](/images/koa-pm2-configuration/pm2-start-logs.png)

You can ignore that error. I forgot to clean up the previous logs.

After it starts, a cmd window will appear on your screen. Don't close it. It will close itself after a while. Every time a code change hits the `watch` rules in the pm2 config, a cmd window pops up automatically, and that one also closes after a while.

Because other people using the project may already be running multiple pm2 instances, I put the names in the `stop` field, to avoid pausing and deleting every instance.

## Testing

Now when we change the code, there is no problem. pm2 hot-reloads for us. Let's try breaking a piece of Vue code on purpose:

![](/images/koa-pm2-configuration/vue-webpack-error.png)

![](/images/koa-pm2-configuration/koa-restart-error.png)

You can see it is OK.

One note on why the second instance `koler-app` in pm2.json has no watch: Vue in development already uses webpack's watch, so there is no need to add it.
