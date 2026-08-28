---
title: 杂谈如何绕过 WAF（Web 应用防火墙）
description: 一些绕过 WAF 的小技巧
date: 2016-08-20T19:04:31+08:00
tags:
  - web security
  - waf
translationKey: talk-about-how-to-bypass-waf
aliases:
  - /zh/2016/08/20/talk-about-how-to-bypass-WAF/
  - /zh/p/talk-about-how-to-bypass-WAF/
  - /zh/posts/杂谈如何绕过wafweb应用防火墙/
---

## 0×01 前言: {#intro}

这个议题呢，主要是教大家一个思路，而不是把现成准备好的代码放给大家。

可能在大家眼中 WAF（Web 应用防火墙）就是“不要脸”的代名词。如果没有他，我们的“世界”可能会更加美好。但是事与愿违。没有它，你让各大网站怎么活。但是呢，我是站在你们的这一边的，所以，今天我们就来谈谈如何绕过 WAF 吧。之所以叫做“杂谈”，是因为我在本次演讲里，会涉及到 webkit、nginx&apache 等。下面正式开始:）

## 0x02 直视 WAF: {#what-is-waf}

作为第一节，我先为大家简单的说下一些绕过 WAF 的方法。

### 1、 大小写转换法: {#case-swap}

看字面就知道是什么意思了，就是把大写的小写，小写的大写。比如:

```text
SQL: sEleCt vERsIoN();
‍‍XSS: <sCrIpt>alert(1)</script>
```

出现原因: 在 waf 里，使用的正则不完善或者是没有用大小写转换函数

### 2、 干扰字符污染法: {#junk-chars}

空字符、空格、TAB 换行、注释、特殊的函数等等都可以。比如下面的:

```text
SQL: sEleCt+1-1+vERsIoN   /*!*/       ();`yohehe‍‍
‍‍SQL2: select/*!*/`version`();
XSS: 下面一节会仔细的介绍
```

### 3、字符编码法: {#encoding}

就是对一些字符进行编码，常见的 SQL 编码有 unicode、HEX、URL、ascll、base64 等，XSS 编码有: HTML、URL、ASCII、JS 编码、base64 等等

```text
SQL: load_file(0x633A2F77696E646F77732F6D792E696E69)
‍‍‍‍XSS: <script%20src%3D"http%3A%2F%2F0300.0250.0000.0001"><%2Fscript>
```

出现原因: 利用浏览器上的进制转换或者语言编码规则来绕过 waf

### 4、拼凑法 {#concat}

如果过滤了某些字符串，我们可以在他们两边加上“原有字符串”的一部分。

```text
SQL: selselectect verversionsion();
‍‍‍‍XSS: <scr<script>rip>alalertert</scr</script>rip>
```

出现原因: 利用 waf 的不完整性，只验证一次字符串或者过滤的字符串并不完整。

本节是告诉大家，waf 总会有自己缺陷的，任何事物都不可能完美。

## 0x03 站在 webkit 角度来说绕过 WAF: {#webkit-bypass}

可能这时会有人问到，说绕过 WAF，怎么跑到 webkit 上去了。嗯，你没有看错，我也没有疯。之说以站在 webkit 角度来讲绕过 WAF，是因为各个代码的功能是由浏览器来解析的。那浏览器中谁又负责解析呢？那就是 webkit，既然要说到 webkit，那就不得不提 webkit 下的解析器——词法分析器，因为我们在绕过的时候，就是利用解析器中的词法分析器来完成。

就比如一个简单的绕过 WAF 的 XSS 代码:

`<iframe src="java
script: alert(1)" height=0 width=0 /><iframe> <!--Java 和 script 是回车，al 和 ert 是 Tab 换行符-->`
他可以弹窗，可以为什么他可以弹窗呢？这里面有回车、换行符啊。想要理解，我们来看看 webkit 下的 Source/javascriptcore/parser/lexer.cpp 是怎么声明的吧。

```c
while (m_current != stringQuoteCharacter) {
    if (UNLIKELY(m_current =='\\')) {
        if (stringStart != currentSourcePtr() && shouldBuildStrings)
            append8(stringStart, currentSourcePtr() - stringStart);
        shift();
        LChar escape = singleEscape(m_current);
        if (escape) {
            if (shouldBuildStrings)
                record8(escape);
            shift();
        } else if (UNLIKELY(isLineTerminator(m_current)))
            shiftLineTerminator();
```

注意倒数第二行里的 isLineTerminator 函数。这里我来说说大致的意思: 所有的内容都在一个字符串里，用 while 逐字解析，遇到换行就跳过。然后在拼成一个没有分割符的字符串，所以这时的 XSS 代码成功弹窗了。
Webkit 里的词法分析器里除了跳过换行符，还会跳过什么字符呢？

子曰: 还有回车等分隔符。

根据 webkit 词法分析器的机制，我们就可以写更多的猥琐 xss 代码。

下面再说说这个注意事项:

```html
<iframe src="java
script:alert(1)" height=0 width=0 /><iframe>  <!--这个可以弹窗-->
<iframe src=java
script:alert(1); height=0 width=0 /><iframe>  <!--这个不可以弹窗-->
```

因为在 webkit 的词法分析器里，跳过回车、换行等分隔符时有个前提，那就是必须用单/双引号围住，不然不会跳过。因为如果不使用引号，词法分析器会认为 回车、换行就是结束了，如果你运行上面这段代码，webkit 会把 java 当做地址传给 src。词法分析器跳过的前提就是建立在引号里的，切记。
这里在说一个:

回车、换行只在属性中引号里才会起作用。如果你对标签或者属性用 回车、换行，这时你大可放心，决对不会弹窗。而且在属性值里 回车、换行随便用。如果空格出现在 xss 代码里并不会弹窗，但是如果出现在字符和符号之前，就可以弹了。如图:

![](/images/talk-about-how-to-bypass-WAF/iframe-xss-payload.png)

注意事项:
跳过回车和换行，不支持 on 事件。例如下面的代码
`<a href="java	script:alert(1)">xss</a>` 会弹窗，但是下面的代码就不行了。

`<a href="#" onclick="aler	t(1)">s</a>` 可见加了 Tab 换行，就无法弹窗了。但是还是支持字符和符号之间加入空格的。
本节就是告诉大家，想要玩的更好，最好追溯到底层，从底层来看攻击手法，你会发现很多问题迎刃而解。

## 0x04 利用 Nginx&Apache 环境 BUG 来绕过 waf: {#nginx-apache-bug}

这个 bug 比较鸡肋，需要在 nginx&apache 环境，而且管理员较大意。这是一个不是 bug 的 bug。
当网站采用前端 Nginx，后端 Apache 时，需要在 conf 配置，当遇到 PHP 后缀的时候，把请求交给 Apache 处理。但是 Nginx 判断后缀是否为 PHP 的原理是根据 URL 的。也就是说如果当 URL 的后缀不是 PHP 的时候，他并不会把 PHP 教给 Apache 处理。
配置:

![](/images/talk-about-how-to-bypass-WAF/nginx-apache-config.png)

乍一看，没什么问题。但是这里隐藏一个漏洞。

我在 test 目录建立一个 index.php:

![](/images/talk-about-how-to-bypass-WAF/index-php-source.png)

利用 nginx&apache 这个 bug，再加上浏览器默认会隐藏 index.php 文件名，那么漏洞就来了。
访问 `a.cn/test/index.php?text=<script>alert(1)</script>` 不会弹窗，被 waf.conf 给拦截了。

访问 `a.cn/test/?text=<script>alert(1)</script>` 会弹窗，没有被 waf.conf 给拦截，因为 nginx 根据 URL 判断这不是 php 文件，并没有交给 apache 处理，也就没有走第三个 location 流程。

![](/images/talk-about-how-to-bypass-WAF/xss-alert-popup.png)

本节是告诉大家，绕过 WAF 不用一直针对 WAF，也可以利用环境/第三方的缺陷来绕过。

## 0x05 从 HTTP 数据包开始说起: {#http-packet}

1、 现在有一部分网站 waf 是部署在客户端上的，利用 burp、fiddler 就可以轻松绕过。
很多时候我们遇到的情况就像这段代码一样:

```html
<input type="text" name="text">
<input type="submit" onclick="waf()">
```

把 waf 规则放到 js 里。我们可以提交一个 woaini 字符串，然后用 burp、fiddler 抓包、改包、提交，轻轻松松的绕过了客服端的 WAF 机制。

2、有的网站，他们对百度、google、soso、360 等爬虫请求并不过滤，这时我们就可以在 USER-Agent 伪造自己是搜索引擎的爬虫，就可以绕过 waf

3、有的网站使用的是 $\_REQUEST 来接受 get post cookie 参数的，这时如果 waf 只对 GET POST 参数过滤了，那么久可以在数据包里对 cookie 进行构造攻击代码，来实现绕过 waf。

4、有的 waf 对 GET POST COOKIE 都过滤了，还可以进行绕过。怎么绕过呢？
假设网站会显示你的 IP 或者你使用的浏览器，那么你就可以对 IP、user-agent 进行构造，在 PHP 里 X_FORWARDED_FOR 和 HTTP_CLIENT_IP 两个获取 IP 的函数都可以被修改。
想详细了解的可以去: [http://www.freebuf.com/articles/web/42727.html](http://www.freebuf.com/articles/web/42727.html) 0x06 节。
本节告诉我们 waf 是死的，人是活的，思想放开。不要跟着 WAF 的思路走，走出自己的思路，才是最正确的。

## 0x06 WAF 你算个屌: {#extension-bypass}

很多人认为绕过 WAF 需要根据 WAF 的规则来绕过。但是我们可以忽视他，进行攻击。
我们利用第三方插件来进行攻击，因为第三方插件的权限非常大，而且他有一个特殊的性质，就是他可以跨域。
我们可以事先在插件里调用一个 js 代码，对方安装之后浏览任何网站都可以被 XSS。
我们现在来看段 Maxthon 插件的源码:

def.json

![](/images/talk-about-how-to-bypass-WAF/maxthon-def-json.png)

test.js:

![](/images/talk-about-how-to-bypass-WAF/maxthon-xss-js.png)

统一放在一个文件夹里，再用 Mxpacke.exe 生成一个遨游插件。

![](/images/talk-about-how-to-bypass-WAF/mxpacker-tool.png)

双击就可以安装这个插件。

![](/images/talk-about-how-to-bypass-WAF/maxthon-plugin-list.png)

![](/images/talk-about-how-to-bypass-WAF/maxthon-xss-js.png)

。这不算是一个漏洞，因为插件必须要运行 js 代码，而 XSS 的宗旨就是 在网站里运行你所指定的 js 代码。
所以，这个 xss 没办法修复，而且 chrome 火狐 等浏览器都存在。
