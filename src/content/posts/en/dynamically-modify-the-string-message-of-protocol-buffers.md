---
title: Dynamically modifying a Protocol Buffers string message
description: Dynamically modifying an already-encoded pb message
date: 2021-05-27T16:02:30+08:00
tags:
  - protobuf
  - golang
translationKey: dynamically-modify-the-string-message-of-protocol-buffers
---

## Preface

Requirements changed: we had to move logs that used to go to *Alibaba Cloud* onto our internal log platform, which speaks `Protocol Buffers`.

Because reporting used to live on *Alibaba Cloud*, we let `logtail` record the user's request *IP* for us.

The internal platform's `RESTful` API is only a forwarder: the frontend encodes with *pb* -> sends to the `RESTful` API -> the server forwards over UDP to the *data platform*.

So the user's request *IP* has to be recorded by that `RESTful` relay. The problem is the relay is a generic service: it does not turn *json* into *pb*. The frontend has to do that. Once the frontend has encoded the log, the relay cannot change it.

That makes it hard for the relay to add an *IP*.

After thinking it through, three options:

1. The frontend fetches the *IP* by requesting a third-party resource
2. The relay does the encoding
3. The relay patches the pb message

The first was ruled out immediately: CDN and other issues, too many things we don't control

The second isn't great either. As I said, this is a generic service. If we encode here, every pb payload would have to be encoded on the relay later, and it would be slow

So we have to go with the third option.

## Notes on string encoding

Before we fix it, one thing has to be true: the *IP* is a string. So we need to know how `Protocol Buffers` encodes a *string message*.

I'll cite a third-party write-up: [Protocol Buffer encoding: strings](https://halfrost.com/protobuf_encode/#toc-22)

For easier reading, here's a screenshot of the relevant part:

![](/images/dynamically-modify-the-string-message-of-protocol-buffers/protobuf-string-encoding.png)

## Implementation

Now that we know how it's encoded, we can patch the bytes.

Here's the original JSON:

```json
{
  "level": "info",
  "message": "test",
  "lts": 1622078077630,
  "clientIP": "__inject-ip__"
}
```

`Protocol Buffers` schema:

```proto
syntax = "proto3";

message Log {
    int64 lts = 1; // timestamp
    string level = 2; // log level
    string message = 3; // main log message
    string clientIP = 4; // IP
}
```

`__inject-ip__` is a placeholder that tells the relay what to patch.

After `Protocol Buffers` encoding, that *JSON* object becomes:

```c
08 be f5 8c db 9a 2f 22 04 69 6e 66 6f 2a 04 74 65 73 74 3a 0d 5f 5f 69 6e 6a 65 63 74 2d 69 70 5f 5f
```

`5f 5f 69 6e 6a 65 63 74 2d 69 70 5f 5f` is the hex encoding of `__inject-ip__`

Per that article, the `3a 0d` in front is required `Protocol Buffers` metadata

1. *3a* is the field type and ID
2. *0d* is the value length

So we only need to care about `0d` and `5f 5f 69 6e 6a 65 63 74 2d 69 70 5f 5f`

Suppose the relay sees the user's IP as `127.0.0.1`

Then we should change `0d` to `hexadecimal(len(127.0.0.1))`, and change `5f 5f 69 6e 6a 65 63 74 2d 69 70 5f 5f` to `hexadecimal(127.0.0.1)`

With the mechanics clear, we can write it:

```go
package main

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
)

func main() {
	// base64 representation of the pb Buffer (byte => base64)
	payloadBase64 := "CMK+w7XCjMObwpovIgRpbmZvKgR0ZXN0Og1fX2luamVjdC1pcF9f"

	// decode base64
	payload, err := base64.StdEncoding.DecodeString(payloadBase64); if err != nil {
		panic(err)
	}

	// string to hex
	// 08C2BEC3B5C28CC39BC29A2F2204696E666F2A04746573743A0D5F5F696E6A6563742D69705F5F
	payloadBinaryStr := fmt.Sprintf("%X", payload)

	// hex of the __inject-ip__ placeholder
	ipPlaceholder := "5F5F696E6A6563742D69705F5F"

	// index where the placeholder appears
	placeholderIndex := strings.Index(payloadBinaryStr, ipPlaceholder)

	// the user's IP
	clientIP := "127.0.0.1"

	// hex of clientIP
	clientIPBinaryStr := fmt.Sprintf("%X", clientIP)

	// length of the IP (in hex), used to modify the length of clientIP in the pb
	// because the max length of an IP address is 15 (255.255.255.255), which is no more than 255, we can guarantee clientIPLen is always 2 hex digits (i.e. one byte)
    // %02 also ensures that if there are fewer than 2 digits, it is left-padded with a zero
	clientIPLen := fmt.Sprintf("%02X", len(clientIP))

	payloadBinaryStrPrefix := payloadBinaryStr[:placeholderIndex - 2]
	payloadBinaryStrSuffix := payloadBinaryStr[placeholderIndex + len(ipPlaceholder):]
	payloadBinaryStrNewContent := clientIPLen + clientIPBinaryStr

	// 08C2BEC3B5C28CC39BC29A2F2204696E666F2A04746573743A093132372E302E302E31
	// as you can see, the previous 0D has now been replaced with 09
	payloadBinaryStr = payloadBinaryStrPrefix + payloadBinaryStrNewContent + payloadBinaryStrSuffix

	payloadBinaryByte, err := hex.DecodeString(payloadBinaryStr); if err != nil {
		panic(err)
	}

	newPayloadBase64 := base64.StdEncoding.EncodeToString(payloadBinaryByte)

    // CMK+w7XCjMObwpovIgRpbmZvKgR0ZXN0OgkxMjcuMC4wLjE=
	fmt.Println(newPayloadBase64)
}
```

Then I changed the original JSON, replaced `__inject-ip__` with `127.0.0.1`, encoded it with `Protocol Buffers` again, and the result was identical. So this works.
