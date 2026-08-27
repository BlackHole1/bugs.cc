---
title: "('b' + 'a' + + 'a' + 'a').toLowerCase() 输出 banana 的剖析"
description: 一步步解析为何会输出 banana
date: 2019-08-15T18:35:26+08:00
tags:
  - javascript
translationKey: javascript-output-banana
aliases:
  - /zh/p/javascript-output-banana/
  - /zh/posts/b-+-a-+-+-a-+-a.tolowercase输出banana的剖析/
---

## 前言 {#intro}

今天逛微博的时候看到有个博主发的一个问题，代码如下:

```js
('b' + 'a' + + 'a' + 'a').toLowerCase()
// "banana"
```

当时第一反应是 JavaScript 会报错，但是并没有。然后就来了兴趣

## 剖析 {#analysis}

后来仔细一想，估计和 JavaScript 运算符优先级、隐式转化有关系。

于是先去 MDN 查了一下 [JavaScript 运算符优先级](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Operator_Precedence#Table)

我先把上面代码用到的运算符和优先级列举出来:

| 优先级 | 运算类型 | 关联性   | 运算符      |
| ------ | -------- | -------- | ----------- |
| 20     | 圆括号   | n/a      | `(...)`     |
| 16     | 一元正号 | 从右至左 | `+ ...`     |
| 13     | 加法     | 从左至右 | `... + ...` |

OK，了解了上面的运算符后，我们现在来拆分下上面的代码

首先把 `toLowerCase` 去掉，这个函数没啥用，只是起到一个迷惑的作用。

```js
'b' + 'a' + + 'a' + 'a'
// to
'b' + 'a' + (+ 'a') + 'a'
```

这就是主要的，因为一元正号的优先级是比加法高的，所以这里用括号标注一下。

现在我们来看下`一元正号`的说明:

> 一元正号运算符位于其操作数前面，计算其操作数的数值，如果操作数不是一个数值，会尝试将其转换成一个数值。尽管一元负号也能转换非数值类型，但是一元正号是转换其他对象到数值的最快方法，也是最推荐的做法，因为它不会对数值执行任何多余操作。它可以将字符串转换成整数和浮点数形式，也可以转换非字符串值 true，false 和 null。小数和十六进制格式字符串也可以转换成数值。负数形式字符串也可以转换成数值（对于十六进制不适用）。如果它不能解析一个值，则计算结果为 NaN。

注意看上面的这段话: `如果操作数不是一个数值，会尝试将其转换成一个数值`和 `如果它不能解析一个值，则计算结果为 NaN`

那上面代码的 `+ 'a'` 就是会变成 `NaN`，过程如下:

```js
'b' + 'a' + (+ 'a') + 'a'
// to
'b' + 'a' + Number('a') + 'a'
// to
'b' + 'a' + NaN + 'a'
```

是不是清晰很多了，然后又涉及到了隐式转化，加号在 JavaScript 规则里有一条是，当操作符有一个是字符串类型时，另一个也要转成字符串类型。也就是说 `NaN` 要进行 `toString`。那 `NaN` 在执行是什么呢？在 `ECMA-262` 中有说明，如图:

![ECMA-262 第 9.8.1 节 ToString Applied to the Number Type: 若 m 为 NaN，则返回字符串 NaN](/images/javascript-output-banana/ecma-tostring-nan.png)

也就是说 `NaN` 会转成 `"NaN"`。所以上面的代码就变成了这样:

```js
'b' + 'a' + NaN + 'a'
// to
'b' + 'a' + "NaN" + 'a'
```

最终在调用 `toLowerCase` 函数转成小写，就变成了 `banana`
