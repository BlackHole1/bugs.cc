---
title: 动态修改 Protocol Buffers 的 string message
description: 动态修改已编码的 pb message
date: 2021-05-27T16:02:30+08:00
tags:
  - protobuf
  - golang
translationKey: dynamically-modify-the-string-message-of-protocol-buffers
aliases:
  - /zh/p/dynamically-modify-the-string-message-of-protocol-buffers/
  - /zh/posts/动态修改-protocol-buffers-的-string-message/
---

## 前言 {#intro}

因为需求变动，我们需要把之前发到 *阿里云* 的日志迁移到我们公司内部的日志平台，而公司内部的日志平台使用的是 `Protocol Buffers` 协议。

而因之前的上报都是在 *阿里云* ，所以我们在记录用户请求的 *IP* 时，都是使用 `logtail` 来自动记录的。

而公司内部日志平台提供的 `RESTful` 接口，只是用于转发使用，也就是 前端使用 *pb* 编码 -> 发送到 `RESTful` 服务器接口 -> 通过 UDP 转发到 *数据平台*

也就说，自动记录用户请求的 *IP* 地址，必须由 `RESTful` 这个中转服务器来做，但是问题在于，因为这个中转服务器是通用的，所以它并不负责把 *json* -> *pb* ，而必须由前端去做，而因为前端已经编码后了，中转服务器无法在对已经编码的日志进行修改。

这也就导致了，中转服务器很难为我们添加 *IP* 地址。

于是经过思考得出以下三种方案:

1. 前端通过请求第三方资源，去获取 *IP* 地址
2. 由 中转服务器进行编码
3. 中转服务器修改 pb message

第一种方案，是首先被过滤掉的，因为需要考虑 *CDN* 等其他问题，不可控因素较多

第二种方案，也不太可行，因为上文提到过，这是一个通用服务，如果这么做的话，以后所有的 pb 都要在 中转服务器里进行编码，效率将比较低

那么只能选择第三种方案

## 引用说明 {#string-encoding}

在正式解决前，我们需要先确定一点，*IP* 地址一定是 字符串类型，所以我们现在需要知道 `Protocol Buffers` 是怎么编码 *string message* 的。

这里我将引用第三方的说明: [Protocol Buffer 编码原理 - 字符串](https://halfrost.com/protobuf_encode/#toc-22)

为了方便阅读，这里我把相关说明的截图贴上来:

![](/images/dynamically-modify-the-string-message-of-protocol-buffers/protobuf-string-encoding.png)

## 开始处理 {#implementation}

现在我们知道了其编码原理，此时我们就可以进行修改编码了

现在我们先看下我们的 原始 JSON 格式:

```json
{
  "level": "info",
  "message": "test",
  "lts": 1622078077630,
  "clientIP": "__inject-ip__"
}
```

`Protocol Buffers` 格式:

```proto
syntax = "proto3";

message Log {
    int64 lts = 1; // 时间戳
    string level = 2; // 日志等级
    string message = 3; // 日志主体信息
    string clientIP = 4; // IP
}
```

其中 `__inject-ip__` 的作用就是占位符，用于告诉中转服务器应该修改哪里。

现在经过 `Protocol Buffers` 编码后，上面的 *JSON* 对象将会被编码成:

```c
08 be f5 8c db 9a 2f 22 04 69 6e 66 6f 2a 04 74 65 73 74 3a 0d 5f 5f 69 6e 6a 65 63 74 2d 69 70 5f 5f
```

其中 `5f 5f 69 6e 6a 65 63 74 2d 69 70 5f 5f` 就是 `__inject-ip__` 的十六进制编码

而根据文章所说，前面的 `3a 0d` 是 `Protocol Buffers` 必要的信息

1. *3a* 代表了当前字段的类型及 ID
2. *0d* 代表了当前 value 的长度

所以我们只需要关心 `0d` 和 `5f 5f 69 6e 6a 65 63 74 2d 69 70 5f 5f` 就可以了

现在我们假设 中转服务器获得的用户 IP 为: `127.0.0.1`

那么我们应该把 `0d` 改为 `hexadecimal(len(127.0.0.1))`，同时把 `5f 5f 69 6e 6a 65 63 74 2d 69 70 5f 5f` 改为: `hexadecimal(127.0.0.1)`

那么原理和细节清楚后，我们就可以写代码来完成这件事了:

```go
package main

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
)

func main() {
	// pb Buffer 的 base64 编码表现形式(byte => base64)
	payloadBase64 := "CMK+w7XCjMObwpovIgRpbmZvKgR0ZXN0Og1fX2luamVjdC1pcF9f"

	// 解码 base64
	payload, err := base64.StdEncoding.DecodeString(payloadBase64); if err != nil {
		panic(err)
	}

	// string 转 十六进制
	// 08C2BEC3B5C28CC39BC29A2F2204696E666F2A04746573743A0D5F5F696E6A6563742D69705F5F
	payloadBinaryStr := fmt.Sprintf("%X", payload)

	// 此为 __inject-ip__ 占位符的 十六进制
	ipPlaceholder := "5F5F696E6A6563742D69705F5F"

	// 占位符出现的下标
	placeholderIndex := strings.Index(payloadBinaryStr, ipPlaceholder)

	// 用户的IP
	clientIP := "127.0.0.1"

	// clientIP 的十六进制
	clientIPBinaryStr := fmt.Sprintf("%X", clientIP)

	// IP 的长度(十六进制格式)，用于修改 pb 中 clientIP 的长度
	// 因为 ip地址的最大长度为15(255.255.255.255)，不超过 255，所以我们这里是可以保证 clientIPLen 的长度一定是 2 位(即: 一个字节)
    // 同时通过 %02 来保证，不满2位，则在前方补零
	clientIPLen := fmt.Sprintf("%02X", len(clientIP))

	payloadBinaryStrPrefix := payloadBinaryStr[:placeholderIndex - 2]
	payloadBinaryStrSuffix := payloadBinaryStr[placeholderIndex + len(ipPlaceholder):]
	payloadBinaryStrNewContent := clientIPLen + clientIPBinaryStr

	// 08C2BEC3B5C28CC39BC29A2F2204696E666F2A04746573743A093132372E302E302E31
	// 可以看到，此时，之前的 0D 已经被替换成 09
	payloadBinaryStr = payloadBinaryStrPrefix + payloadBinaryStrNewContent + payloadBinaryStrSuffix

	payloadBinaryByte, err := hex.DecodeString(payloadBinaryStr); if err != nil {
		panic(err)
	}

	newPayloadBase64 := base64.StdEncoding.EncodeToString(payloadBinaryByte)

    // CMK+w7XCjMObwpovIgRpbmZvKgR0ZXN0OgkxMjcuMC4wLjE=
	fmt.Println(newPayloadBase64)
}
```

然后我们修改 原始JSON，把 `__inject-ip__` 更换成 `127.0.0.1`，再使用 `Protocol Buffers` 进行编码，发现是一模一样的，说明是没问题的。
