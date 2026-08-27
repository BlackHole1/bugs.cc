---
title: 基于 Vue+Koa 的 pm2 配置
description: 使用 pm2 管理 vue 前端和 koa 后端项目
date: 2017-11-07T21:37:00+08:00
tags:
  - nodejs
  - vue
  - koa
translationKey: koa-pm2-configuration
aliases:
  - /zh/2017/11/07/Koa-pm2-configuration/
  - /zh/p/koa-pm2-configuration/
  - /zh/posts/基于vue+koa的pm2配置/
---

## 背景介绍 {#intro}

目前使用的技术栈是: 前端 Vue、后端 Koa、数据库 Mongodb。

然而每当起服务的时候，都要 `npm start`、`node ./server/app.js`，还要同时保持这两个窗口一直是开着的，很是麻烦。

而且因为我使用的是 koa，也没有使用狼叔写的 koa 脚手架。是自己基于廖雪峰老师的 [Koa 框架](https://www.liaoxuefeng.com/wiki/001434446689867b27157e896e74d51a89c25cc8b43bdb3000/001434501579966ab03decb0dd246e1a6799dd653a15e1b000) 改的一个小型 mvc。导致没有热更新。

为了简化这种没必要的操作及增加热更新，开始想怎么进行优化。于是选择了 `pm2`

## 配置 pm2 {#pm2-config}

先安装 pm2: `npm i pm2`、`npm i pm2 -g`
因为是开源项目，为了让代码能再别人的电脑上跑起来，需要让 pm2 存在项目里。然后在全局安装，方便后期调试

再项目的根目录里创建 logs 目录

在当前的目录创建一个 pm2.json 的文件，内容如下:

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

这里同时启动两个项目。
`koler-server` 是 koa，`koler-app` 是前端 vue。

我尝试了一下把

```json
"error_file"      : "./logs/app-err.log",
"out_file"        : "./logs/app-out.log",
"merge_logs"      : true,
"log_date_format" : "YYYY-MM-DD HH:mm Z",
```

代码提升到 json 的根部，但是发现不起作用。看来 pm2 不支持这种。所以只能在每个服务里写了。

## 配置 package.json {#package-json-config}

替换之前的 `script` 字段下的 `dev`，然后再增加 `stop` 字段，替换后如下:

```json
"scripts": {
  "dev": "pm2 start pm2.json && pm2 logs",
  "start": "npm run dev",
  "stop": "pm2 stop koler-app koler-server && pm2 delete koler-app koler-server",
  "build": "node build/build.js",
  "lint": "eslint --ext .js,.vue src"
},
```

`pm2 start pm2.json && pm2 logs` 是基于 pm2.json 文件配置启动，后面的 `pm2 logs` 是为了同时跟踪 vue 和 koa 的反馈日志。

输入 `npm start` 后。终端如下:

![](/images/koa-pm2-configuration/pm2-start-logs.png)

那个错误是不用管的，因为我忘记清理之前的日志了

启动后，你的屏幕会出现一个 cmd 窗口，不用关，过一会它会自行关闭的。每次修改代码触发 pm2 配置文件里 `watch` 规则时，就会自动弹出一个 cmd 窗口，也是过一会关闭。

因为其他项目使用者可能会在电脑上跑多个 pm2 实例，所以在 `stop` 字段里，我跟上了名字。防止出现把所有的实例全部暂定删除了。

## 测试 {#testing}

现在我们更改代码发现没有任何问题，pm2 会帮助我们自动进行热更新。现在我们故意改错一段 vue 的代码试试:

![](/images/koa-pm2-configuration/vue-webpack-error.png)

![](/images/koa-pm2-configuration/koa-restart-error.png)

可以发现已经 OK 了。

这里说明一下为什么在 pm2.json 配置文件里的第二个实例 `koler-app` 没有 watch，因为 vue 在开发环境下使用的是 wenpack 的 watch，所以不需要加。
