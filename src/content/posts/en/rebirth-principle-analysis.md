---
title: How server-side recording works
description: The idea behind server-side recording, and some pitfalls I hit
date: 2019-12-07T15:02:14+08:00
tags:
  - rebirth
  - chrome extension
  - nodejs
translationKey: rebirth-principle-analysis
---

## Overview

### Features

Server-side recording, in plain terms, is recording a website on a server, including **audio, motion, refreshes, navigations**, and so on, then saving it as a video file.

### How it works

Start `Puppeteer` with a virtual display via `xvfb`. Puppeteer opens Chrome, then a Chrome extension API captures a `Stream`. An HTML5 API converts that stream into a `webm` file.

## Challenges

Recording audio, doing it on a server, and making the whole thing unattended.

## Analysis

During the research phase I considered several approaches, such as:

1. Screenshot with Canvas and stitch frames together
2. Various Chrome and HTML5 APIs

After testing them, I settled on a Chrome extension API: `chrome.tabCapture.capture`. The Chrome extension docs describe it like this:

> Captures the visible area of the currently active tab. This method can only be used on the currently active page after the extension has been invoked, similar to how [activeTab](https://crxdoc-zh.appspot.com/extensions/activeTab) works.

**Captures the visible area of the currently active tab** is what the API does. The rest is the restriction: you cannot call it directly. A user gesture is required (Chrome takes security seriously).

That restriction was the first problem I hit. The whole recording runs on a server. There is no human in the loop. I looked through Chrome's source and found the check in [tab_capture_api.cc](https://cs.chromium.org/chromium/src/chrome/browser/extensions/api/tab_capture/tab_capture_api.cc?type=cs&g=0&l=247-257). The core is:

```cpp
// Make sure either we have been granted permission to capture through an
// extension icon click or our extension is whitelisted.
if (!extension()->permissions_data()->HasAPIPermissionForTab(
        SessionTabHelper::IdForTab(target_contents).id(),
        APIPermission::kTabCaptureForTab) &&
    base::CommandLine::ForCurrentProcess()->GetSwitchValueASCII(
        switches::kWhitelistedExtensionID) != extension_id &&
    !SimpleFeature::IsIdInArray(extension_id, kMediaRouterExtensionIds,
                                base::size(kMediaRouterExtensionIds))) {
  return RespondNow(Error(kGrantError));
}
```

The important part is:

```cpp
base::CommandLine::ForCurrentProcess()->GetSwitchValueASCII(
        switches::kWhitelistedExtensionID) != extension_id &&
    !SimpleFeature::IsIdInArray(extension_id, kMediaRouterExtensionIds,
                                base::size(kMediaRouterExtensionIds))
```

This checks whether the current extension id matches `kWhitelistedExtensionID`. That switch is a privilege whitelist. When they match, you can skip the user gesture and automate.

`kWhitelistedExtensionID` is declared in [switches.cc](https://cs.chromium.org/chromium/src/extensions/common/switches.cc?type=cs&g=0&l=78):

```cpp
// Adds the given extension ID to all the permission whitelists.
const char kWhitelistedExtensionID[] = "whitelisted-extension-id";
```

So I just need to start Chrome with `--whitelisted-extension-id` set to the extension id.[^tab-active]

---

The next problem: the extension id has to be stable, otherwise every build gets a different id. I searched Stack Overflow and found [Making a unique extension id and key for Chrome extension?](https://stackoverflow.com/questions/37317779/making-a-unique-extension-id-and-key-for-chrome-extension)

That is why the project has a [key.pem](https://github.com/alo7/rebirth/blob/master/src/extensions_dist/key.pem) in the extension directory: to pin the extension id.

---

You may have noticed this API does not expose other methods, so we have to implement `pause / resume / stop` ourselves. HTML5 `MediaRecorder`[^mediarecorder] covers that.

`chrome.tabCapture.capture` returns a `Stream` that includes audio and video. `MediaRecorder` can take it from there.

After calling `chrome.tabCapture.capture`, we create a `MediaRecorder` instance and listen for incoming data.

The pause / resume / stop methods we wrote are wrappers around `MediaRecorder`, which already provides `pause / resume / stop`. We only need a thin wrapper.

One gotcha: after `MediaRecorder.stop()`, you still need to stop every track, or the memory stays occupied:

```typescript
mediaRecorder.stop();
mediaRecorder.stream.getTracks().forEach(track => {
  track.stop();
});
```

Think of `stop` as stopping intake. The existing tracks are not closed or released.

---

That covers the recording structure. Whether the details landed or not, the core of this project is a browser extension. Chrome does not support injecting extensions in `headless`[^headless] mode.

This runs on a server, and it will eventually go through Docker. Those environments have no desktop. If we cannot use headless, everything above is wasted.

I searched around and found `xvfb`. Think of it as a virtual desktop. Chrome runs on that virtual display. That unblocked us.

That is why [entrypoint.sh](https://github.com/alo7/rebirth/blob/master/entrypoint.sh) has:

```sh
# open virtual desktop
xvfb-run --listen-tcp --server-num=76 --server-arg="-screen 0 2048x1024x24" --auth-file=$XAUTHORITY node index.js &
```

At this point the pipeline worked. The rest is optimization.

---

The project could record on a server (Docker), but I could not see what was happening inside. I wanted to debug it. So I added VNC and Chrome remote debugging.

VNC is straightforward: install a VNC stack in the Docker image, then add this to [entrypoint.sh](https://github.com/alo7/rebirth/blob/master/entrypoint.sh):

```sh
x11vnc -display :76 -passwd password -forever -autoport 5920 &
```

Chrome remote debugging is a bit more work. Add `--remote-debugging-port=9222` to Chrome's launch flags, and install `socat` in the image for port forwarding.

9222 is the remote-debugging port, but Chrome only accepts connections from localhost. So `socat` forwards 9222 to 9223. In [entrypoint.sh](https://github.com/alo7/rebirth/blob/master/entrypoint.sh):

```sh
# forward chrome remote debugging protocol port
socat tcp-listen:9223,fork tcp:localhost:9222 &
```

---

This Docker image may land on k8s or elsewhere. After deploy, it will eventually get a "please kill yourself" signal (usually when the cluster is short on resources or CPU is too high). When that signal reaches the container (a Pod on k8s), we should roll back data and so on. So [entrypoint.sh](https://github.com/alo7/rebirth/blob/master/entrypoint.sh) has:

```sh
# get nodejs process pid
NODE_PID=$(lsof -i:80 | grep node | awk 'NR==1,$NF=" "{print $2}')

# forward SIGINT/SIGKILL/SIGTERM to nodejs process
trap 'kill -n 15 ${NODE_PID}' 2 9 15

# waiting nodejs exit
while [[ -e /proc/${NODE_PID} ]]; do sleep 1; done
```

First get the Node process PID, then forward the signal to it. On the Node side:

```js
let status = false;
const exit = message => {
  if (status) return;

    console.log('the process was kill:', message);

    // rollback operations

  status = true;

  process.exit();
};


process.once('exit', () => exit('exit'));
process.once('SIGTERM', () => exit('sigterm'));
process.on('message', message => {
  if (message === 'shutdown') {
    exit('shutdown');
  }
});
```

## Deployment

Our company deploys on k8s, so the flow looks like this:

The server inserts a recording job into the database. I wrote another service that scans the database on an interval (currently every 3 minutes). When it finds a row, it calls the k8s API to create a Job -> Pod and run one recording. If you are curious, I wrote about this in [Flexible scheduling of a k8s cluster based on task volume](https://www.bugs.cc/p/flexible-scheduling-of-k8s-cluster-based-on-task-volume/)

## Open source

The project is open source. Stars and PRs are welcome: [https://github.com/alo7/rebirth](https://github.com/alo7/rebirth)

[^tab-active]: The one catch: when you call this API, the tab you want to record must be active. After the call you can navigate away.

[^mediarecorder]: If you are not familiar with this API, think of it as a manager for audio/video streams.

[^headless]: Think of headless as starting Chrome from the command line, talking to it through commands or APIs, with no visible window.
