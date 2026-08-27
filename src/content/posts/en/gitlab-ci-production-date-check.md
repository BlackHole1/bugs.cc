---
title: Production deploy time checks with GitLab CI
description: Decide whether to ship by checking the current time
date: 2019-07-06T16:10:32+08:00
tags:
  - ci/cd
  - gitlab
translationKey: gitlab-ci-production-date-check
---

## Background

At the company, a lot of projects have a hard rule for production deploys: Thursday and Friday need an email approval to ship to `production`, Saturday and Sunday are off-limits, and Monday through Wednesday you cannot ship between 5pm and 9pm.

The point is to cut the risk of shipping when not enough people are around.

The only enforcement was each team's self-discipline, and self-discipline is not a reliable control. I think we needed an actual constraint to bring that down.

## Goal

With the background set, we need a goal. That is: on some branches, at some times, `CI` should not auto-build.

My first idea was a `git hook`. That got rejected, because:

- `pre-commit` only sees commit time, not push time
- `pre-push` could work, but anyone can skip it with `--no-verify`, and that skip is available to every member of the team.
- It cannot really handle `merge`. The usual trick online is checking for a `Merge` string in `prepare-commit-msg`, which is not reliable

Ideally, nobody on the team can control this, meaning it cannot be bypassed. The `git hook` approach all runs on each person's machine, so there are all kinds of ways around it.

If local checks cannot meet the goal, the check has to live in `gitlab-ci`.

## Implementation

One prerequisite: only some people on the team can change CI, and there must be `code review`. You need both before going any further.

Add these two variables under `CI Variables`:

```go
NOT_SUPPORT_HOUR 17,18,19,20,21
NOT_SUPPORT_WEEK 4,5,6,0
```

Those variables are how you enforce **only some people can change CI**.

Then add a `check_deploy stages` in `.gitlab-ci.yml`, along with the related `pip`

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

It boots a `busybox` container, compares the current time against the blocked windows, and exits with `126` if you are inside one. It only applies to the deploy branch (`master` here).

That also matches the earlier point: **there must be `code review`**.

The approach still has holes: the two prerequisites above, and that this kind of restriction should not live at the `team` level. Ideally no team can change it; real control should sit one layer up. I don't have a good way to pull that layer in yet, so this is how we gate deploys for now.
