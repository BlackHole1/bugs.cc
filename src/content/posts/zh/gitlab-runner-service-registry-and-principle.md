---
title: Gitlab Runner 服务注册及任务捕获原理
description: 通过查看源码了解 Gitlab-Runner 的捕获原理
date: 2019-07-06T16:12:58+08:00
tags:
  - gitlab
  - runner
translationKey: gitlab-runner-service-registry-and-principle
aliases:
  - /zh/p/gitlab-runner-service-registry-and-principle/
  - /zh/posts/gitlab-runner服务注册及任务捕获原理/
---

## 环境搭建 {#setup}

可以参考 https://docs.gitlab.com/runner/development/README.html 来进行搭建，这里需要注意的是，go version 最好为 `go1.8.7`，高版本的 go version，可能会安装失败。

## 参数注册 {#command-registration}

`gitlab-runner` 在注册 runner 时，需要用到 `registry`、`install`、`start` 这三个命令。而其实 `install` 和 `start` 只是服务注册的

在 [main.go](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/main.go) 文件的入口处，其调用了 [common.GetCommands()](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/main.go#L50)

而这个函数是为了注册参数的，其核心代码为:

[![common/command.go#L20-27](/images/gitlab-runner-service-registry-and-principle/register-command2-func.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/common/command.go#L20-27)

`Name` 为我们要注册的参数，`Action` 为调用参数后调用的方法。

在注册方法时，只需要使用 `RegisterCommand2(参数名, 说明, 动作函数类)` 即可。

### registry

在 `commands/registry.go` 里有一个 init 函数，注册了 `registry`

[![commands/register.go#L380](/images/gitlab-runner-service-registry-and-principle/register-command-init.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/register.go#L380)

`newRegisterCommand` 函数肯定返回了 `Execute` 函数，也就是触发 `registry` 的动作函数。

[![commands/register.go#L345-363](/images/gitlab-runner-service-registry-and-principle/new-register-command.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/register.go#L345-363)

这里返回了一个 `RegisterCommand` 类，而这个类下实现了 `Execute` 方法。

[![commands/register.go#L288-338](/images/gitlab-runner-service-registry-and-principle/register-execute-method.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/register.go#L288-338)

其中 `s.askRunner()` 就是我们输入命令后，出现的各种询问，如: gitlab-ci URL、token、description、tags。

在 `askRunner` 函数里，当你输入完成后，有一步校验的操作，检验你输入的只是否真的可以连接到 gitlab-ci 上。

这些都没什么好说的。在 `askRunner` 函数后，还 `askExecutor`、`askExecutorOptions` 函数。这两个函数的作用是询问你要选择哪种执行者，也就是我们见到的 `Please enter the executor: docker+machine, docker, docker-ssh, shell, docker-ssh+machine, kubernetes, parallels, ssh, virtualbox:`

当你全部输入完成后，会把你输入值，保存在 `~/.gitlab-runner/config.toml` 文件里。

其实到这步的时候，整个 gitlab-ci 就已经配置好了，`install`、`start` 的作用下面再说

### install/start

当你注册完成后，再使用 `install` 进行安装时，其实安装的是 `gitlab-ci` 服务。

我们看下 `commands/service.go` 文件的内容:

[![commands/service.go#L202-242](/images/gitlab-runner-service-registry-and-principle/service-commands-init.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/service.go#L202-242)

可以看到其他的参数基本都是在这里进行注册，其他的我们暂时不看，专注看下 `install`、`start`

其中这两个参数的行为都是 `RunServiceControl` 函数，这个函数的代码也十分简单

[![commands/service.go#L131-151](/images/gitlab-runner-service-registry-and-principle/run-service-control.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/service.go#L131-151)

其中 `install` 比较特别，单独调用了 `runServiceInstall` 函数，这个函数的作用就是为了检查 `config.toml` 以及当前用户的代码，没啥好说的，最后也调用了 `service.Control(s, c.Command.Name)` 方法。这个方法是 [github.com/ayufan/golang-kardianos-service](https://github.com/ayufan/golang-kardianos-service) 库，这个库是一个注册服务的库，也就说当你使用 `gitlab-runner install` 的时候，其实是在注册服务，服务的作用是保证 `gitlab-runner` 一直在后台运行以及开机运行。

当服务注册好后，再通过 `gitlab-runner start` 打开服务[^install-start]

当我们调用 `service.Control(s, 'start')` 时，其实会执行 `s.Start()` 方法，而这个方法其实就是开启服务的，而打开服务时，也需要一个命令行，因为要告诉系统我执行的什么的命令是服务。其代码为:

[![commands/service.go#L89-129](/images/gitlab-runner-service-registry-and-principle/create-service-config.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/service.go#L89-129)

我们看到 `Arguments` 是一个数组，且第一个元素是 `run`，后面的代码也都是 `run` 的参数了。

现在可以确定，当我们使用 `gitlab-runner start` 时，其内部调用了 `run` 当做服务的命令。我们来看下 `Run` 的代码

[![commands/multi.go#L578-613](/images/gitlab-runner-service-registry-and-principle/run-command-run.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/multi.go#L578-613)

其中 `mr.feedRunners(runners)` 函数只是做心跳检测的，没什么可说的。

而 `mr.startWorkers(startWorker, stopWorker, runners)` 才是主要的，这个函数经过 5~6 次的调用，最终调用了一个 `RequestJob` 函数，这个才是重头戏

[![network/gitlab.go#L264-298](/images/gitlab-runner-service-registry-and-principle/request-job-func.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/network/gitlab.go#L264-298)

可以看到这里是发请求询问 `gitlab-runner` 有没有新的任务，如果有则返回 `resqonse`

而这个函数的调用链，有一个方法是一直在循环这个函数，从而实现了`轮询`[^polling]

最终的结果，就是 `gitlab-runner` 启动后，一直在轮询给 `gitlab` 发请求，问它有没有新的任务。

[^install-start]: 这里其实可以集成到 install 里，但是不知道为什么 gitlab 官网没有这么做。

[^polling]: 我之前一直以为是通过 websocket 来做，没想到是轮询来实现的，可能是为了兼容性？
