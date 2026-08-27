---
title: GitLab Runner service registration and job capture
description: Reading the source to understand how GitLab Runner captures jobs
date: 2019-07-06T16:12:58+08:00
tags:
  - gitlab
  - runner
translationKey: gitlab-runner-service-registry-and-principle
---

## Environment setup

You can follow https://docs.gitlab.com/runner/development/README.html to set this up. Note that the Go version is best kept at `go1.8.7`. With a newer Go version, the install may fail.

## Command registration

When `gitlab-runner` registers a runner, it needs three commands: `register`, `install`, and `start`. `install` and `start` are only for service registration.

At the entry of [main.go](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/main.go), it calls [common.GetCommands()](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/main.go#L50)

That function registers commands. The core is:

[![common/command.go#L20-27](/images/gitlab-runner-service-registry-and-principle/register-command2-func.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/common/command.go#L20-27)

`Name` is the command we register. `Action` is the method that runs after you invoke it.

To register a command, call `RegisterCommand2(name, description, action type)`.

### register

`commands/register.go` has an init function that registers `register`

[![commands/register.go#L380](/images/gitlab-runner-service-registry-and-principle/register-command-init.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/register.go#L380)

`newRegisterCommand` must return something with `Execute`, which is the action for `register`.

[![commands/register.go#L345-363](/images/gitlab-runner-service-registry-and-principle/new-register-command.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/register.go#L345-363)

It returns a `RegisterCommand`, and that type implements `Execute`.

[![commands/register.go#L288-338](/images/gitlab-runner-service-registry-and-principle/register-execute-method.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/register.go#L288-338)

`s.askRunner()` is the prompts you get after typing the command: gitlab-ci URL, token, description, tags.

Inside `askRunner`, after you finish typing, there is a check that the values can actually connect to GitLab CI.

Nothing much to say about that. After `askRunner` come `askExecutor` and `askExecutorOptions`. Those ask which executor you want, the prompt we all know: `Please enter the executor: docker+machine, docker, docker-ssh, shell, docker-ssh+machine, kubernetes, parallels, ssh, virtualbox:`

When you're done, the values are saved to `~/.gitlab-runner/config.toml`.

At this point GitLab CI is already configured. I'll cover `install` and `start` next.

### install/start

After registration, `install` installs the GitLab Runner service.

Look at `commands/service.go`:

[![commands/service.go#L202-242](/images/gitlab-runner-service-registry-and-principle/service-commands-init.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/service.go#L202-242)

The other commands are mostly registered here. Ignore those for now and look at `install` and `start`.

Both of them run `RunServiceControl`. That function is short:

[![commands/service.go#L131-151](/images/gitlab-runner-service-registry-and-principle/run-service-control.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/service.go#L131-151)

`install` is special: it also calls `runServiceInstall`, which checks `config.toml` and the current user. Not much to say. It then calls `service.Control(s, c.Command.Name)`. That method comes from [github.com/ayufan/golang-kardianos-service](https://github.com/ayufan/golang-kardianos-service), a library for registering OS services. So `gitlab-runner install` is registering a service whose job is to keep `gitlab-runner` running in the background and start it on boot.

After the service is registered, `gitlab-runner start` starts it.[^install-start]

When we call `service.Control(s, 'start')`, it runs `s.Start()`, which starts the service. Starting a service also needs a command line, so the system knows which command is the service. The code is:

[![commands/service.go#L89-129](/images/gitlab-runner-service-registry-and-principle/create-service-config.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/service.go#L89-129)

`Arguments` is an array. The first element is `run`, and the rest are `run`'s flags.

So when we use `gitlab-runner start`, internally it uses `run` as the service command. Here's `Run`:

[![commands/multi.go#L578-613](/images/gitlab-runner-service-registry-and-principle/run-command-run.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/commands/multi.go#L578-613)

`mr.feedRunners(runners)` is just a heartbeat. Nothing to say.

`mr.startWorkers(startWorker, stopWorker, runners)` is the main path. After 5 or 6 calls, it ends up in `RequestJob`. That's the real work.

[![network/gitlab.go#L264-298](/images/gitlab-runner-service-registry-and-principle/request-job-func.png)](https://gitlab.com/gitlab-org/gitlab-runner/blob/5a14535d052d243b874c0cbf89175ac671744577/network/gitlab.go#L264-298)

This sends a request asking GitLab whether there is a new job. If there is, it returns the `response`.

Somewhere on the call chain, a method loops this function, which is how you get `polling`.[^polling]

The end result: after `gitlab-runner` starts, it keeps polling GitLab, asking whether there is a new job.

[^install-start]: This could have been folded into install; I don't know why the GitLab docs didn't.

[^polling]: I used to think this was a websocket. It's polling. Compatibility, maybe?
