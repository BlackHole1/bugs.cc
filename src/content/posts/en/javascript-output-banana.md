---
title: "Why ('b' + 'a' + + 'a' + 'a').toLowerCase() prints banana"
description: Step-by-step walkthrough of why it prints banana
date: 2019-08-15T18:35:26+08:00
tags:
  - javascript
translationKey: javascript-output-banana
---

## Intro

I was on Weibo today and saw someone post this:

```js
('b' + 'a' + + 'a' + 'a').toLowerCase()
// "banana"
```

My first thought was that JavaScript would throw. It did not. So I got curious.

## Analysis

After thinking about it, I figured it had to do with JavaScript operator precedence and implicit conversion.

So I looked up [JavaScript operator precedence](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Operator_Precedence#Table) on MDN.

Here are the operators used in that snippet, with their precedence:

| Precedence | Operator type | Associativity | Operator    |
| ---------- | ------------- | ------------- | ----------- |
| 20         | Parentheses   | n/a           | `(...)`     |
| 16         | Unary plus    | Right to left | `+ ...`     |
| 13         | Addition      | Left to right | `... + ...` |

OK, with that in mind, let's break the expression apart.

First drop `toLowerCase`. That function is useless; it is only there to throw you off.

```js
'b' + 'a' + + 'a' + 'a'
// to
'b' + 'a' + (+ 'a') + 'a'
```

That is the important part: unary plus binds tighter than addition, so I marked it with parentheses.

Here is what MDN says about unary plus:

> The unary plus operator precedes its operand and evaluates it as a number. If the operand is not a number, it tries to convert it to one. Unary minus can also convert non-numeric types, but unary plus is the fastest way to convert other objects to numbers, and the recommended one, because it does not perform any extra operations on the number. It can convert strings to integers and floats, and it can also convert the non-string values true, false, and null. Decimal and hexadecimal strings can be converted to numbers. Negative numeric strings can be converted too (this does not apply to hex). If it cannot parse a value, the result is NaN.

Pay attention to these two bits: `if the operand is not a number, it tries to convert it to a number` and `if it cannot parse a value, the result is NaN`.

So `+ 'a'` in the snippet becomes `NaN`. The steps:

```js
'b' + 'a' + (+ 'a') + 'a'
// to
'b' + 'a' + Number('a') + 'a'
// to
'b' + 'a' + NaN + 'a'
```

Clearer already. Next comes implicit conversion. One of JavaScript's rules for `+` is that if either operand is a string, the other is converted to a string too. So `NaN` goes through `toString`. What does that produce? `ECMA-262` covers it:

![ECMA-262 section 9.8.1 ToString Applied to the Number Type: if m is NaN, return the string NaN](/images/javascript-output-banana/ecma-tostring-nan.png)

In other words, `NaN` becomes `"NaN"`. So the expression is now:

```js
'b' + 'a' + NaN + 'a'
// to
'b' + 'a' + "NaN" + 'a'
```

Finally `toLowerCase` lowercases it, and you get `banana`.
