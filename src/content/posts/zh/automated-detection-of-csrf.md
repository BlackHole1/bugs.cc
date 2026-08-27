---
title: 自动化检测 CSRF
description: 使用浏览器插件做到自动检测 CSRF 漏洞
date: 2016-06-15T20:49:37+08:00
tags:
  - web security
  - csrf
translationKey: automated-detection-of-csrf
aliases:
  - /zh/2016/06/15/automated-detection-of-CSRF/
  - /zh/p/automated-detection-of-CSRF/
  - /zh/posts/自动化检测csrf/
---

## 0x00 前言: {#intro}

***
之前写过自动化检测 XSS 插件，今天来一发自动化检测 CSRF 的插件。CSRF 有多种情况的出现方式，而本章所说的内容没有办法做的那么全面，就比如 JSON Hijacking（第二章或者第三章会写），本章我们就说说 form 表单导致的 CSRF 漏洞。
检测 form 表单类型的 CSRF 漏洞和检测 form 表单类型的 XSS 漏洞最大的不同就是: XSS 需要提交才能检测到，而 CSRF 只需要分析 form 表单就行了。

## 0x01 前期的准备工作: {#preparation}

***
既然要写，那么我们就需要 demo 来帮我们模拟真实环境的下的情况，而 0x00 节就说明了，本章只针对于 form 表单，所以我们的 demo 也就是各式各样的表单。如下图:

![](/images/automated-detection-of-CSRF/demo-form-types.png)

基本上来说网上常见的表单类别都包含了，当然如果你发现有些表单没有加入进去，请说明一下，我将会在下一版中修改。

我们先遍历整个网页上的 form 表单。代码如下:

```js
outerFor:
for(var i = 0;i < $("form").length;i++){
    var formDom = $("form").eq(i); //formDom 代表本次循环的 form 表单元素
    var imageFileSuffix = ['.jpg','.png','.jpge','.ico','.gif','.bmp']; //图片后缀白名单，用户验证图片是否为验证码
    var placeholderFilterKeyword = ['跳','搜','查','找','登陆','注册','search'];  //无用表单黑名单，用于验证这个 form 表单有没有用（针对 input 验证）
    var actionFilterKeyword = ['search','find','login','reg'];   //无用表单黑名单，用于验证这个 form 表单有没有用（针对 form 表单验证）
}
```

至于为什么要加上 `outerFor:`，是因为这只是最外层的 for 循环，里面还有 for 循环，为了方便我们在最里层的 for 循环里跳出最外层的本次循环。在最里层的 for 循环里我会使用 `continue outerFor;` 来跳出最外层 for 的本次循环。（如果没有看懂，请返回上一行重新看，这很重要）

## 0x02 去除类似搜索、页面跳转等无用的 form 表单: {#useless-forms}

***
首先我们需要假象一下有没有特殊的 form 表单，比如没有 action 属性，把请求交给 JavaScript 来完成。而这种特殊的 form 表单也很常见，所以这里我就先使用 if 判断 action 是否存在:

```js
if(formDom.attr("action") != undefined){
    //当 action 不为空的时候，进行下一步的操作
}
```

然后就是使用 JavaScript 的 some 函数来对 action 进行判断，当 action 里的值满足于我们之前设置的黑名单里的字符串时，就直接 pass，使用 `continue` 来跳出初始化表达式变量为 i 的本次循环。转化成代码就是下面这样:

```js
if(formDom.attr("action") != undefined){
    var actionCheck = actionFilterKeyword.some(function(item,index){
        return (formDom.attr("action").toLowerCase().indexOf(item)  != "-1");
    })
    if(actionCheck){
        continue;
    }
}
```

如果对 some 函数不明白的，请移步: [https://msdn.microsoft.com/zh-cn/library/ff679978(v=vs.94).aspx](https://msdn.microsoft.com/zh-cn/library/ff679978(v=vs.94).aspx)
而在 JavaScript 里是严格区分大小写的，所以在上面的代码中我使用了 toLowerCase() 函数，来把 action 里的值全部转化成小写，然后在其中搜索之前设置的 action 黑名单，看是否存在。而对比过程如下:
>action 的值--search（如果此次比对为 true，则不会向下进行比对）

>action 的值--find

>......

其返回的结果是布尔型。在《JavaScript 高级程序设计》里是这样说明 some 函数的:

`对数组中的每一项运行给定函数，如果该函数对任意一项返回true，则返回true。`

这个时候我们可以看到 some 前面有一个变量。因为 some 返回的是布尔型，那么 actionCheck 变量也是一个布尔型，假设当前这个 form 表单里的 action 的值为"/searchArticle.php"。那么就会匹配到黑名单里的 search 字符串，那么 some 就会停止向下循环，直接返回 true。
如下图:

![](/images/automated-detection-of-CSRF/array-some-console.png)

然后使用 if 判断 `actionCheck` 变量。如果为 true，那么就使用 `continue` 来跳出当前的循环，不向下运行，直接开始下一个循环。

OK，上面的已经完成对 form 的 action 属性过滤了，那么下面的将对 input 进过白名单过滤。

```js
for(var x = 0;x < formDom.find(":text").length;x++){
    var inputTextCheck;
    var inputText =  formDom.find(":text").eq(x);
    if(inputText.attr("placeholder") == undefined){
        continue;
    }
    inputTextCheck = placeholderFilterKeyword.some(function(item,index){
        return (inputText.attr("placeholder").toLowerCase().indexOf(item)  != "-1");
    })
    if(inputTextCheck){
        continue outerFor;
    }
}
```

首先使用 `(":text")` 来遍历当前 form 表单下所有 type 为 text 的 input 标签。

inputTextCheck 变量是为了存放 some 函数的布尔结果。而 inputText 变量代表了当前的 input 标签。

然后使用 if 判断当前 input 里的 placeholder 属性是否存在，如果不存在，则跳出初始化表达式变量为 x 的本次循环。不向下运行，且对下一个 input 标签进行之前的操作。如果存在且有值的话，if 里的表达式会返回 false。则这个 if 判断不会运行，而是向下运行，而代码:

```js
inputTextCheck = placeholderFilterKeyword.some(function(item,index){
    return (inputText.attr("placeholder").toLowerCase().indexOf(item)  != "-1");
})
if(inputTextCheck){
    continue outerFor;
}
```

和之前判断 action 的情况的是一样的，这里就不在阐述了。

## 0x03 去除没有提交按钮的 form 表单: {#no-submit-forms}

***
为什么要写这个，因为有些 form 表单不是给用户使用的，他没有提交按钮。对用户来说也是不可见状态。而且也不涉及较为核心的操作，那么我们就需要把这个表单剔除掉。代码如下:

```js
if(formDom.find(":submit").length < 1){
    continue;
}
```

这段代码较为简单，这里也不在阐述了。

## 0x04 去除具有 token 的 form 表单: {#token-forms}

***
大家都知道对于 CSRF 来说，具有 token 的 form 表单基本是可以断定是不存在 CSRF 漏洞的了，当然排除同页面存在 XSS 漏洞和 CSRF 漏洞。

而 token，我们应该怎么样发现呢？type 为 hidden？name 包含 token？，不不不。这些都不准确，没办法减少误报和扩大结果。那我们应该怎么做呢？<b>判断 type 为 hidden 的 input 标签里的 value 值的长度是否大于 10</b>。

具有 token 功能的 input 标签的特殊性:
>
> 1. type 为 hidden

> 2. 为了安全起见，token 一般是不会小于 10 位数的。

> 3. 总是以 input 标签为媒介的方式传输给后端服务器中。

OK，那么我们可以遍历当前 form 表单下所有 type 为 hidden 的 input 标签，再判断 value 值是否大于 10。如果大于 10，说明这个表单很大程度上是具有 token 验证的表单，将会被程序丢弃。跳出初始化表达式变量为 i 的本次循环。把上面的话转化成代码就是下面这样:

```js
for(var j = 0;j < formDom.find(":hidden").length;j++){
    if(formDom.find(":hidden").eq(j).val().length > 10){
        continue outerFor;
    }
}
```

程序不复杂，复杂的思路。所以这里看起来代码其实也了没多少，而且相当的简单。所以这里就不对代码进行阐述了。

## 0x05 去除带有验证码的 form 表单: {#captcha-forms}

***
有了之前写自动化检测 XSS 项目的经验，这里思路就清晰多了。获取 img 的 src 属性里的值，判断后缀是否为图片格式。代码如下:

```js
if(formDom.find("img").length > 0){
    var imageCheck;
    for(var z = 0;z < formDom.find("img").length;z++){
        var img = formDom.find("img").eq(z);
        var imgSrc = img.attr("src")
        if(!!imgSrc){
            if(imgSrc.indexOf("?") != "-1"){
                imgSrc = imgSrc.slice(0,imgSrc.indexOf("?"));
            }
            imgSrc = imgSrc.substr(imgSrc.lastIndexOf("."),imgSrc.length);
            imageCheck = imageFileSuffix.some(function(item,index){
                return (imgSrc == item);
            })
            if(!imageCheck){
                continue outerFor;
            }
        }
    }
}
```

首先使用 `formDom.find("img").length` 来判断当前的 form 表单里是否存在图片，如果存在，那么 if 判断会返回 true。进入 if 判断里面后，首先是一个变量，而这个变量是存放 some 函数返回的布尔结果的。

然后就是一个 for 循环，对当前 form 表单里的 img 表单进行遍历。而变量 `img` 代表了当前的 img 标签。而 imgSrc 变量代表了当前 img 标签里的 src。

下面是一段 if 代码 `if(!!imgSrc)` 为什么要这样写呢，是强制把 imgSrc 变量转成布尔型的，如果当前这个 img 标签是不存在 src 属性或没有值的情况下，将会返回 false，如果存在 src 且有值的情况下会返回 true。

而下面的代码的是为了剔除`?`后面的字符串:

```js
if(imgSrc.indexOf("?") != "-1"){
    imgSrc = imgSrc.slice(0,imgSrc.indexOf("?"));
}
```

为什么要写这样的代码呢？原因很简单，未来防止验证码图片被浏览器缓存，需要再后面跟上问号和随机数字，来达到每刷新一次，就会重新请求这个图片。防止浏览器缓存图片。

而 `imgSrc = imgSrc.substr(imgSrc.lastIndexOf("."),imgSrc.length);` 这段代码是剔除，除了后缀之外所有的字符串。只保留后缀。举个例子，有段 img 标签是这样写的:
`<img src="https://wwww.baidu.com/code.php?rand=458711541">`，而运行上面的代码后，结果只有 `.php` 了，剩下的字符串已经被剔除掉了。

而下面的 some 函数，和之前是一样的，不做阐述。只是 if 里面的表达式里多了一个`!取反`感叹号。为什么要这样写呢。因为之前的都是黑名单的形式，而这里的白名单的形式，既然是相反的，那么就使用`!取反`就行了。

## 0x06 其他: {#misc}

整套代码如下:

```js
outerFor:
for(var i = 0;i < $("form").length;i++){
    var formDom = $("form").eq(i);
    var imageFileSuffix = ['.jpg','.png','.jpge','.ico','.gif','.bmp'];
    var placeholderFilterKeyword = ['跳','搜','查','找','登陆','注册','search'];
    var actionFilterKeyword = ['search','find','login','reg'];
    //去除类似搜索、页面跳转等无用的 form 表单
    if(formDom.attr("action") != undefined){
        var actionCheck = actionFilterKeyword.some(function(item,index){
            return (formDom.attr("action").toLowerCase().indexOf(item)  != "-1");
        })
        if(actionCheck){
            continue;
        }
    }
    for(var x = 0;x < formDom.find(":text").length;x++){
        var inputTextCheck;
        var inputText =  formDom.find(":text").eq(x);
        if(inputText.attr("placeholder") == undefined){
            continue;
        }
        inputTextCheck = placeholderFilterKeyword.some(function(item,index){
            return (inputText.attr("placeholder").toLowerCase().indexOf(item)  != "-1");
        })
        if(inputTextCheck){
            continue outerFor;
        }
    }
    //去除没有提交按钮的 form 表单
    if(formDom.find(":submit").length < 1){
        continue;
    }
    //去除具有 token 的 form 表单
    for(var j = 0;j < formDom.find(":hidden").length;j++){
        if(formDom.find(":hidden").eq(j).val().length > 10){
            continue outerFor;
        }
    }
    //去除带有验证码的 form 表单
    if(formDom.find("img").length > 0){
        var imageCheck;
        for(var z = 0;z < formDom.find("img").length;z++){
            var img = formDom.find("img").eq(z);
            var imgSrc = img.attr("src")
            if(!!imgSrc){
                if(imgSrc.indexOf("?") != "-1"){
                    imgSrc = imgSrc.slice(0,imgSrc.indexOf("?"));
                }
                imgSrc = imgSrc.substr(imgSrc.lastIndexOf("."),imgSrc.length);
                imageCheck = imageFileSuffix.some(function(item,index){
                    return (imgSrc == item);
                })
                if(!imageCheck){
                    continue outerFor;
                }
            }
        }
    }
    console.log(formDom)
}
```

这里的 console.log(formDom) 可以改为 ajax 等方式发包，或者 alert 直接提醒此页面可能具有 csrf 漏洞。至于如何使用，需要大伙手工打包成浏览器插件的形式。而这里我为大家附上我之前写的自动化检测 XSS 的插件: [http://pan.baidu.com/s/1ge5VTcf](http://pan.baidu.com/s/1ge5VTcf)。大家可以直接解包，修改里面的 JavaScript 代码为上面完整的代码，再重新打包就行了。

文章呢，还有很多地方不足。而这套程序还只能说是雏形，所以我没有附上直接利用的工具给大家，也是第一次这样。而且有很多地方没有考虑到，比如 JSON Hijacking 检测。当然下一章会完成的，也会放出可以直接利用的工具。第二章或者第三章可能会把之前写的 XSS 自动化检测与本章所说的自动化检测 CSRF 相结合起来。毕竟 XSS+CSRF 的危害是非常大的。
