---
title: Some ideas based on URLProtocol attacks
description: Some attack ideas that use URLProtocol
date: 2017-03-26T16:33:52+08:00
tags:
  - web security
  - javascript
translationKey: some-ideas-based-on-urlprotocol-attacks
---

Browsers launch local apps through `URLProtocol`.[^urlprotocol-refs]

Under the `[HKEY_CLASSES_ROOT]` registry key, you can see many `URLProtocol` entries.

For example, AliWangWang:

![](/images/some-ideas-based-on-URLProtocol-attacks/aliim-registry-command.png)

On the web, AliWangWang's `Contact me` button goes to `https://amos.alicdn.com/getcid.aw?v=3&groupid=0&s=1&charset=utf-8&uid=淘宝店铺名&site=cntaobao&groupid=0&s=1&fromid=cntaobao淘宝用户名`, and that page runs this JavaScript:

```js
!function() {
    var a = window,
    b = function() {
        try {
            window.open("", "_top"),
            a.opener = null,
            a.close()
        } catch(b) {}
    },
    c = function() {
        a.location.href = "aliim:sendmsg?touid=" + a.site + a.touid + "&site=" + a.site + "&status=1",
        setTimeout(function() {
            b()
        },
        6e3)
    };
    a.isInstalled ? a.isInstalled(function(b) {
        if (b) c();
        else {
            var d = confirm("\u68c0\u6d4b\u5230\u4f60\u672a\u5b89\u88c5\u963f\u91cc\u65fa\u65fa\u5ba2\u6237\u7aef,\u662f\u5426\u8981\u8df3\u8f6c\u5230\u5b98\u7f51\u4e0b\u8f7d?");
            d === !0 && (a.location.href = "https://wangwang.taobao.com")
        }
    }) : c()
} ();
```

The core line is `a.location.href = "aliim:sendmsg?touid=" + a.site + a.touid + "&site=" + a.site + "&status=1"`. The aliim in that line is AliWangWang's key name under `[HKEY_CLASSES_ROOT]`.

In the screenshot above, opening it runs `"D:\Program Files (x86)\AliWangWang\8.60.03C\wwcmd.exe" %1`. wwcmd.exe is AliWangWang's API for handling messages from the web. When it succeeds, it opens a chat window. `%1` is the `sendmsg?touid=" + a.site + a.touid + "&site=" + a.site + "&status=1"` argument. Let's replace WWCmd.exe and see how the arguments are passed:

```cpp
 #include<stdio.h>
 int main(int argc,char **argv) {
      FILE *fp = fopen("c:/123.txt","w+");
      if(NULL == fp)
          return -1;
      while(argc-->0){
          fputs(*++argv,fp);
          fputs(" ",fp);
      }
      return 0;
  }
```

This C program writes the remaining arguments to 123.txt on drive C. After I replaced WWCmd.exe and clicked `Contact me`, a 123.txt file appeared on drive C.

![](/images/some-ideas-based-on-URLProtocol-attacks/captured-protocol-params.png)

It also passed `aliim:` in. Following that request, we can write an exe that receives the arguments. My skills are limited, so here is the rough idea.

The exe replaces the original `WWCmd.exe`, then we generate a specific plugin and implant it in the browser. Every time the user opens a site, it receives a particular base64-encoded shell from the server, then runs `aliim:cmd=服务端的base64`. If the argument is `sendmsg`, it launches AliWangWang. If it is `cmd`, it executes the code. That covers both hiding the Trojan and the condition to wake it. The same idea works for Thunder downloads and similar apps.

What is the upside? When a browser launches AliWangWang, Thunder, and similar apps, a prompt usually pops up, but most users click Don't ask again. That achieves the goal.

This is only an idea, and it is not very mature. Comments welcome.

[^urlprotocol-refs]: Details are in http://www.cnblogs.com/wang726zq/archive/2012/12/11/UrlProtocol.html and http://blog.csdn.net/zssureqh/article/details/25828683
