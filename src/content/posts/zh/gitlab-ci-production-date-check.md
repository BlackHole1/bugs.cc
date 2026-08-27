---
title: 基于 Gitlab CI 的上线时间校验
description: 通过对时间的判断来决定是否进行项目发布
date: 2019-07-06T16:10:32+08:00
tags:
  - ci/cd
  - gitlab
translationKey: gitlab-ci-production-date-check
aliases:
  - /zh/p/gitlab-ci-production-date-check/
  - /zh/posts/基于gitlab-ci的上线时间校验/
---

## 前提 {#background}

目前公司在很多项目在上线时，都明确要求了，周四、周五上线 `production` 环境需要发邮件申请，周六、周日不允许上线，周一至周三每天下午 5 点到晚上 9 点不允许上线。

之所以这么要求，是因为减少在人员不齐情况下上线带来的风险。

而这种规范，只能由公司各个项目组之间的自觉，但是这种自觉其实是一种不可靠因素。我个人感觉还是需要一套约束，来降低这种不可靠因素。

## 目标 {#goal}

前提确定好后，那就需要一个目标了。也就说，在某些分支上的某些时间点是不允许让 `CI` 进行自动构建的。

一开始，我的想法是通过 `git hook` 来实现，但是后来给否决了，原因为:

- `pre-commit` 只是针对当前 commit 的时间点，并不是 push 的时间点
- `pre-push` 虽说可以做到，但是问题在于，可以通过 `--no-verify` 来跳过钩子，而且这种跳过是下发到组内每个成员的。
- 对 `merge` 无能为力，网上的方案都是通过 `prepare-commit-msg` 来判断当前 commit 是否存在 `Merge` 字符串，不可靠

理想情况下，组员是没有任何权限去控制这一块的，也就是说无法被绕过，`git hook` 的方式都是在组员本地，也存在了各种被绕过的风险。

那既然无法在本地校验来达到目标，那就只能把目标放在 `gitlab-ci` 这一块了。

## 正文 {#implementation}

这里有个前提，一个小组内，只能有部分人具有 CI 的控制权。并且一定有 `code review`。只有具备以上两点才能进行下一步。

通过在 `CI Variables` 来增加以下两个变量:

```go
NOT_SUPPORT_HOUR 17,18,19,20,21
NOT_SUPPORT_WEEK 4,5,6,0
```

这个变量就应对上上面所说的**只能有部分人具有 CI 控制权**

然后在 `.gitlab-ci.yml` 里增加一个 `check_deploy stages`，以及增加相关的 `pip`

```yaml
stages:
 - check_deploy
check_time:
  image: busybox
  stage: check_deploy
  script:
    - export TZ=UTC-8
    - export CURRENT_WEEK=$(date '+%w')
    - export CURRENT_HOUR=$(date '+%H')
    - if [ $(echo $NOT_SUPPORT_HOUR | grep "${CURRENT_HOUR}") ]; then exit 126; fi;
    - if [ $(echo $NOT_SUPPORT_WEEK | grep "${CURRENT_WEEK}") ]; then exit 126; fi;
  only:
    - master
```

通过启动一个 `busybox` 容器，来对当前时间以及不允许时间段进行一个比较，当当前时间点在不允许时间端内，则抛出错误码 `126`。且只对上线分支有效（这里为 master 分支）

这个也对应上了，之前所说的**一定有 `code review`**

其实这个方法也有缺陷，那就是是刚刚所说的两个前提，以及不应该把这种限制下发到`小组`单位，理想的情况下各个小组都是没有权限进行控制的，正在的控制权应该上升到更高一层，但是目前还想不到好的方式让更高一层介入进来。所以目前只能通过这种方式来做到上线控制。
