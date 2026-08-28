---
title: Notes on bypassing WAFs (Web Application Firewalls)
description: A few tricks for bypassing a WAF
date: 2016-08-20T19:04:31+08:00
tags:
  - web security
  - waf
translationKey: talk-about-how-to-bypass-waf
---

## 0×01 Intro

This talk is mainly about a way of thinking, not handing you ready-made code.

In many people's eyes a WAF (Web Application Firewall) is another word for "shameless". Without it, our "world" might be a nicer place. Too bad. Without it, how would the big sites survive. That said, I am on your side, so today we talk about bypassing WAFs. I called it a ramble because this talk also goes into webkit, nginx&apache, and more. Let's get started :)

## 0x02 Facing WAF

As the first section, a few simple ways to bypass a WAF.

### 1. Case swapping

The name says it: uppercase to lowercase, lowercase to uppercase. For example:

```text
SQL: sEleCt vERsIoN();
‍‍XSS: <sCrIpt>alert(1)</script>
```

Why it works: the WAF regex is incomplete, or it never lowercases / uppercases.

### 2. Junk-character pollution

Nulls, spaces, TAB/newlines, comments, special functions, and so on. For example:

```text
SQL: sEleCt+1-1+vERsIoN   /*!*/       ();`yohehe‍‍
‍‍SQL2: select/*!*/`version`();
XSS: covered in detail in the next section
```

### 3. Character encoding

Encode some of the characters. Common SQL encodings: unicode, HEX, URL, ASCII, base64. XSS encodings: HTML, URL, ASCII, JS encoding, base64, and so on

```text
SQL: load_file(0x633A2F77696E646F77732F6D792E696E69)
‍‍‍‍XSS: <script%20src%3D"http%3A%2F%2F0300.0250.0000.0001"><%2Fscript>
```

Why it works: use the browser's base conversion or language encoding rules to bypass the WAF.

### 4. Piecing together

If some string is filtered, we put a piece of the original string on both sides of it.

```text
SQL: selselectect verversionsion();
‍‍‍‍XSS: <scr<script>rip>alalertert</scr</script>rip>
```

Why it works: the WAF is incomplete. It only checks the string once, or the filtered string is not complete.

The point of this section: a WAF always has holes. Nothing is perfect.

## 0x03 Bypassing WAF from the WebKit angle

Someone might ask: we're talking about bypassing WAFs, why WebKit? Yes, you read that right, I'm not crazy. The reason to talk about WAF bypass from the WebKit angle is that the browser is what parses the code. Who in the browser does the parsing? WebKit. And once you're in WebKit, you have to talk about its parser, the lexer, because that is what we abuse for the bypass.

A simple XSS that bypasses a WAF:

`<iframe src="java
script: alert(1)" height=0 width=0 /><iframe> <!--Java and script are a carriage return; al and ert are a Tab-->`
It pops an alert. Why can it pop an alert? There is a carriage return and a line break in there. To see why, look at how WebKit declares this in Source/javascriptcore/parser/lexer.cpp.

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

Look at `isLineTerminator` on the second-to-last line. Roughly: everything lives in one string, `while` walks it character by character, and a line break is skipped. Then it is stitched into a string with no separator, so this XSS pops. Besides line breaks, what else does the WebKit lexer skip?

Confucius said: carriage returns and other separators too.

From the WebKit lexer, we can write dirtier XSS.

One more caveat:

```html
<iframe src="java
script:alert(1)" height=0 width=0 /><iframe>  <!-- this one can pop an alert -->
<iframe src=java
script:alert(1); height=0 width=0 /><iframe>  <!-- this one cannot pop an alert -->
```

In the WebKit lexer, skipping carriage returns, line breaks, and other separators has a precondition: they must be wrapped in single or double quotes, or they are not skipped. Without quotes, the lexer treats the carriage return / line break as the end. If you run the snippet above, WebKit passes `java` to `src` as the URL. Skipping only happens inside quotes. Remember that.
One more thing:

Carriage returns and line breaks only work inside quoted attribute values. If you put a carriage return or line break on the tag or the attribute name, you can relax: it will definitely not pop. Inside the attribute value, use them as you like. A space in the XSS will not pop, but a space between a character and a symbol will. See:

![](/images/talk-about-how-to-bypass-WAF/iframe-xss-payload.png)

Note:
Skipping carriage returns and line breaks does not work on `on*` events. For example
`<a href="java	script:alert(1)">xss</a>` pops, but the next one does not.

`<a href="#" onclick="aler	t(1)">s</a>` Add a Tab and it will not pop. Spaces between a character and a symbol still work.
The point of this section: if you want to play better, go down to the bottom layer. Look at the attack from there, and a lot of problems fall apart.

## 0x04 Bypassing WAF with an Nginx&Apache environment bug

This bug is pretty lame. You need an nginx&apache setup, and a sloppy admin. It is a bug that isn't really a bug.
When the site uses Nginx in front and Apache behind, the conf has to hand PHP-suffix requests to Apache. Nginx decides whether the suffix is PHP from the URL. If the URL suffix is not PHP, it will not hand PHP to Apache.
Config:

![](/images/talk-about-how-to-bypass-WAF/nginx-apache-config.png)

Looks fine at first glance. There is a hole here.

I put an index.php under the test directory:

![](/images/talk-about-how-to-bypass-WAF/index-php-source.png)

Use the nginx&apache bug, plus the browser hiding the `index.php` filename by default, and here is the hole.
Visit `a.cn/test/index.php?text=<script>alert(1)</script>` and it will not pop. `waf.conf` blocked it.

Visit `a.cn/test/?text=<script>alert(1)</script>` and it pops. `waf.conf` did not block it, because nginx judged from the URL that this is not a php file, did not hand it to apache, and never hit the third location.

![](/images/talk-about-how-to-bypass-WAF/xss-alert-popup.png)

The point of this section: you don't have to aim at the WAF the whole time. You can bypass it through a hole in the environment or a third party.

## 0x05 Starting from the HTTP packet

1. Some sites put the WAF on the client. burp or fiddler is enough.
A lot of the time it looks like this:

```html
<input type="text" name="text">
<input type="submit" onclick="waf()">
```

The WAF rules live in js. Submit a woaini string, intercept with burp or fiddler, rewrite the packet, resend. Client-side WAF gone.

2. Some sites do not filter crawlers from Baidu, google, soso, 360, and so on. Forge USER-Agent as a search-engine crawler and you bypass the waf.

3. Some sites use \_REQUEST to take get post cookie. If the WAF only filters GET POST, you can put the attack in the cookie of the packet and bypass the waf.

4. Some WAFs filter GET POST COOKIE. You can still bypass. How?
If the site shows your IP or your browser, you can craft IP and user-agent. In PHP, both X_FORWARDED_FOR and HTTP_CLIENT_IP can be spoofed.
For more, see: [http://www.freebuf.com/articles/web/42727.html](http://www.freebuf.com/articles/web/42727.html) section 0x06.
The point of this section: the WAF is dead, people are alive. Open the thinking. Don't follow the WAF's path. Walk your own. That is the right way.

## 0x06 WAF, you ain't shit

A lot of people think bypassing a WAF means playing by the WAF's rules. We can ignore it and attack anyway.
We attack through a third-party plugin. Plugins have a lot of privilege, and they can cross origin.
Ship js in the plugin ahead of time. After they install it, every site they visit is XSS'd.
Look at a Maxthon plugin:

def.json

![](/images/talk-about-how-to-bypass-WAF/maxthon-def-json.png)

test.js:

![](/images/talk-about-how-to-bypass-WAF/maxthon-xss-js.png)

Put them in one folder, run Mxpacke.exe, get a Maxthon plugin.

![](/images/talk-about-how-to-bypass-WAF/mxpacker-tool.png)

Double-click to install.

![](/images/talk-about-how-to-bypass-WAF/maxthon-plugin-list.png)

![](/images/talk-about-how-to-bypass-WAF/maxthon-xss-js.png)

This is not a vulnerability. A plugin has to run js, and XSS is exactly running the js you specify on a site.
So this xss cannot be fixed, and chrome, Firefox, and the rest all have it.
