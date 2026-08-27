---
title: macOS 10.15 下载及编译 Chromium
description: 在 macOS 10.15 下载及编译 Chromium 的一些过程
date: 2020-03-31T15:50:24+08:00
tags:
  - chromium
translationKey: macos-10.15-download-and-build-chromium
aliases:
  - /zh/p/macOS10.15-download-and-build-chromium/
  - /zh/posts/macos10.15下载及编译chromium/
---

## 下载 {#download}

下载 `Chromium` 源码具体可参见 [Checking out and building Chromium for Mac](https://chromium.googlesource.com/chromium/src/+/master/docs/mac_build_instructions.md)。但是如果按照文档上来做的话，会很难拉下来。

网上也有博主说可以利用 国内的`Gitee` 来远程克隆下载，但是目前 `Gitee` 已经不支持单个仓库那么大了（即使是企业版也无法支持单个项目容量很大的情况），毕竟现在 `Chromium` 没有任何历史记录都需要 `16G`

经过各种尝试，在拉源码时，可以使用 `fetch --nohooks --no-history chromium`，来拉，成功率会高出不少，拉下来后，再运行 `gclient sync` 来执行下 `hooks`，如果还需要历史记录的话，可以执行 `git fetch --unshallow` 这样就可以和直接运行 `fetch chromium` 有同样的结果。

不过值得一提的事，`git fetch --unshallow` 也会很慢。毕竟十几万个 `commit`，这个时候只能依靠人品，如果失败的话，最好先运行一次 `git gc --prune=now` ，再重新执行 `git fetch --unshallow` 不然你的仓库会越来越大。

以上步骤，我花了5天时间，用掉了机场的 `180G` 流量才下载完成。[^update-code]

## 编译 {#build}

目前我的电脑信息如下:

- OSVersion: macOS Catalina 10.15.3
- CPU: 2.4 GHz 八核Intel Core i9
- Memory: 32 GB 2667 MHz DDR4

 目前官网文档: [Checking out and building Chromium for Mac](https://chromium.googlesource.com/chromium/src/+/master/docs/mac_build_instructions.md) 中提到需要 `OS X 10.15 SDK` ，而我的系统是 `10.15.3` 所以这个 `SDK` 我是有的，于是开始执行 `gn gen out/Debug` 来生成构建目录，然后就报错...

相关错误如下:

```sh
********************************************************************************
 WARNING: The NaCL SDK is 32-bit only. macOS 10.15+ removed support for 32-bit
          executables. To fix, set enable_nacl=false in args.gn, or downgrade to
          macOS 10.14. For more information, see https://crbug.com/1049832.
********************************************************************************
ERROR at //components/nacl/features.gni:40:3: Assertion failed.
  assert(false, "NaCL SDK is incompatible with host macOS version")
  ^-----
NaCL SDK is incompatible with host macOS version
See //BUILD.gn:18:1: whence it was imported.
import("//components/nacl/features.gni")
^--------------------------------------
```

因为，NaCL 是 `32位` ，而目前 `macOS 10.15+` 以上已经移除了对 `32位` 的支持，上面有相关的链接。打开后显示权限不足，无法查看....

不过我看到上面的说明中，说道只需要在 `args.gn` 文件里加入 `enable_nacl=false` 即可，但是 `args.gn` 文件是需要 `gn gen out/Debug` 之后才有的，乍一看陷入了死循环。于是查了下相关资料，发现 `gn gen` 是可以指定相关参数的。于是把命令改成: `gn gen out/Debug --args="enable_nacl=false"` 即可完成构建目录。[^enable-nacl]

完成构建目录后，你可以在 `out/Debug/args.gn` 看到

```text
enable_nacl = false
```

这个时候，你还需要在此文件里，添加如下配置:

```text
# 开启 debug
is_debug = true
# 编译成动态链接库
is_component_build = true
```

这个时候如果你使用 `autoninja -C out/Debug chrome` 开始编译时，等过了半个多小时后，你会发现报错，无法继续编译，相关错误如下:

```sh
ninja: Entering directory `./out/Debug'
[1/1] Regenerating ninja files
[18588/41244] OBJCXX obj/components/viz/common/metal_context_provider/metal_api_proxy.o
FAILED: obj/components/viz/common/metal_context_provider/metal_api_proxy.o
../../third_party/llvm-build/Release+Asserts/bin/clang++ -MMD -MF obj/components/viz/common/metal_context_provider/metal_api_proxy.o.d -DVIZ_METAL_CONTEXT_PROVIDER_IMPLEMENTATION -D_LIBCPP_HAS_NO_ALIGNED_ALLOCATION -DCR_XCODE_VERSION=1140 -DCR_CLANG_REVISION=\"n345938-a1762f9c-1\" -D__STDC_CONSTANT_MACROS -D__STDC_FORMAT_MACROS -DCOMPONENT_BUILD -D_LIBCPP_ENABLE_NODISCARD -D_LIBCPP_DEBUG=0 -DCR_LIBCXX_REVISION=375504 -D__ASSERT_MACROS_DEFINE_VERSIONS_WITHOUT_UNDERSCORES=0 -D_DEBUG -DDYNAMIC_ANNOTATIONS_ENABLED=1 -DWEBP_EXTERN=extern -DUSE_EGL -DSK_CODEC_DECODES_PNG -DSK_CODEC_DECODES_WEBP -DSK_ENCODE_PNG -DSK_ENCODE_WEBP -DSK_USER_CONFIG_HEADER=\"../../skia/config/SkUserConfig.h\" -DSK_GL -DSK_CODEC_DECODES_JPEG -DSK_ENCODE_JPEG -DSK_USE_LIBGIFCODEC -DSKIA_DLL -DSKCMS_API=__attribute__\(\(visibility\(\"default\"\)\)\) -DSK_SUPPORT_GPU=1 -DSK_GPU_WORKAROUNDS_HEADER=\"gpu/config/gpu_driver_bug_workaround_autogen.h\" -DSK_BUILD_FOR_MAC -DSK_METAL -DBORINGSSL_SHARED_LIBRARY -DU_USING_ICU_NAMESPACE=0 -DU_ENABLE_DYLOAD=0 -DUSE_CHROMIUM_ICU=1 -DU_ENABLE_TRACING=1 -DU_ENABLE_RESOURCE_TRACING=0 -DICU_UTIL_DATA_IMPL=ICU_UTIL_DATA_FILE -DUCHAR_TYPE=uint16_t -DGOOGLE_PROTOBUF_NO_RTTI -DGOOGLE_PROTOBUF_NO_STATIC_INITIALIZER -DHAVE_PTHREAD -DPROTOBUF_USE_DLLS -I../.. -Igen -I../../third_party/libwebp/src -I../../third_party/khronos -I../../gpu -I../../third_party/perfetto/include -Igen/third_party/perfetto/build_config -Igen/third_party/perfetto -I../../third_party/skia -I../../third_party/libgifcodec -I../../third_party/boringssl/src/include -I../../third_party/icu/source/common -I../../third_party/icu/source/i18n -I../../third_party/ced/src -I../../third_party/protobuf/src -I../../third_party/protobuf/src -Igen/protoc_out -I../../third_party/mesa_headers  -fno-strict-aliasing -fstack-protector-strong -fcolor-diagnostics -fmerge-all-constants -fcrash-diagnostics-dir=../../tools/clang/crashreports -Xclang -mllvm -Xclang -instcombine-lower-dbg-declare=0 -fcomplete-member-pointers -arch x86_64 -Wno-builtin-macro-redefined -D__DATE__= -D__TIME__= -D__TIMESTAMP__= -Xclang -fdebug-compilation-dir -Xclang . -no-canonical-prefixes -Wall -Werror -Wextra -Wimplicit-fallthrough -Wunreachable-code -Wthread-safety -Wextra-semi -Wunguarded-availability -Wno-missing-field-initializers -Wno-unused-parameter -Wno-c++11-narrowing -Wno-unneeded-internal-declaration -Wno-undefined-var-template -Wno-ignored-pragma-optimize -Wno-implicit-int-float-conversion -Wno-final-dtor-non-final-class -Wno-builtin-assume-aligned-alignment -Wno-deprecated-copy -Wno-non-c-typedef-for-linkage -Wno-pointer-to-int-cast -O0 -fno-omit-frame-pointer -gdwarf-4 -g2 -Xclang -debug-info-kind=constructor -isysroot ../../../../../../../../Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.15.sdk -mmacosx-version-min=10.10.0 -ftrivial-auto-var-init=pattern -fvisibility=hidden -Xclang -add-plugin -Xclang find-bad-constructs -Wheader-hygiene -Wstring-conversion -Wtautological-overlap-compare -Wno-shorten-64-to-32 -Wno-undefined-bool-conversion -Wno-tautological-undefined-compare -std=c++14 -stdlib=libc++ -fobjc-call-cxx-cdtors -Wobjc-missing-property-synthesis -fno-exceptions -fno-rtti -nostdinc++ -isystem../../buildtools/third_party/libc++/trunk/include -isystem../../buildtools/third_party/libc++abi/trunk/include -fvisibility-inlines-hidden -include obj/components/viz/common/metal_context_provider/precompile.h-mm -c ../../components/viz/common/gpu/metal_api_proxy.mm -o obj/components/viz/common/metal_context_provider/metal_api_proxy.o
../../components/viz/common/gpu/metal_api_proxy.mm:224:17: error: method 'supportsRasterizationRateMapWithLayerCount:' in protocol 'MTLDevice' not implemented [-Werror,-Wprotocol]
@implementation MTLDeviceProxy
                ^
../../../../../../../../Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.15.sdk/System/Library/Frameworks/Metal.framework/Headers/MTLDevice.h:727:1: note: method 'supportsRasterizationRateMapWithLayerCount:' declared here
-(BOOL)supportsRasterizationRateMapWithLayerCount:(NSUInteger)layerCount API_AVAILABLE(macos(10.15.4), ios(13.0), macCatalyst(13.4));
^
../../components/viz/common/gpu/metal_api_proxy.mm:224:17: error: method 'newRasterizationRateMapWithDescriptor:' in protocol 'MTLDevice' not implemented [-Werror,-Wprotocol]
@implementation MTLDeviceProxy
                ^
../../../../../../../../Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.15.sdk/System/Library/Frameworks/Metal.framework/Headers/MTLDevice.h:735:1: note: method 'newRasterizationRateMapWithDescriptor:' declared here
-(nullable id<MTLRasterizationRateMap>)newRasterizationRateMapWithDescriptor:(MTLRasterizationRateMapDescriptor*)descriptor API_AVAILABLE(macos(10.15.4), ios(13.0), macCatalyst(13.4));
^
../../components/viz/common/gpu/metal_api_proxy.mm:224:17: error: method 'supportsVertexAmplificationCount:' in protocol 'MTLDevice' not implemented [-Werror,-Wprotocol]
@implementation MTLDeviceProxy
                ^
../../../../../../../../Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.15.sdk/System/Library/Frameworks/Metal.framework/Headers/MTLDevice.h:831:1: note: method 'supportsVertexAmplificationCount:' declared here
- (BOOL)supportsVertexAmplificationCount:(NSUInteger)count API_AVAILABLE(macos(10.15.4), ios(13.0), macCatalyst(13.4));
^
3 errors generated.
[18605/41244] CXX obj/components/viz/service/main/main/viz_compositor_thread_runner_impl.o
ninja: build stopped: subcommand failed.
```

去 chromium 论坛搜了下，有人说使用 `macOS 10.14 SDK` 就可以解决，于是我在 `Github` 上找到了[MacOSX-SDKs](https://github.com/phracker/MacOSX-SDKs) 项目，使用 `git clone` 拉下来，并执行 `ln -s /Users/black-hole/Code/Github/MacOSX-SDKs/MacOSX10.14.sdk /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/`。

然后重新开始构建，发现还是失败。看了错误，和之前一样。在错误详情里看到了 `MacOSX10.15.sdk` 的字样，说明编译时，没有命中 `10.14` 的 `SDK`

翻了下代码，在 `build/config/mac/mac_sdk.gni` 中找到了相关的参数定义:

```sh
# Path to a specific version of the Mac SDK, not including a slash at the end.
# If empty, the path to the lowest version greater than or equal to
# mac_sdk_min is used.
mac_sdk_path = ""
```

找到定义后，在 `args.gn` 文件里，加入 `mac_sdk_path = "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.14.sdk"`

但是发现还是编译失败，而且错误信息没有在 `Chromium` 论坛找到相关的信息。

于是又在 `Chromium` 论坛中搜了下相关帖子，找到了一个: [macOS: build with 10.15 SDK + toolchain](https://monorail-prod.appspot.com/p/chromium/issues/detail?id=973128#c10)。其中有人提供了 `patch` 。

但是因为这个 `patch` 是 2019年10月份的了，经过测试，发现有些冲突，如:

```sh
$ git apply --check ~/Downloads/compilation_10_15_wip.patch

error: 打补丁失败：build/config/mac/BUILD.gn:77
error: build/config/mac/BUILD.gn：补丁未应用
error: 打补丁失败：components/viz/common/gpu/metal_api_proxy.mm:573
error: components/viz/common/gpu/metal_api_proxy.mm：补丁未应用
error: 打补丁失败：services/device/geolocation/wifi_data_provider_mac.mm:21
error: services/device/geolocation/wifi_data_provider_mac.mm：补丁未应用
```

于是自己大致看了下 `patch` 的内容，我就只引用了 `BUILD.gn` 的改动，在 `build/config/mac/BUILD.gn` 文件里，找到 `defines = [ "__ASSERT_MACROS_DEFINE_VERSIONS_WITHOUT_UNDERSCORES=0" ]` ，把这里改成下面的样子:

```sh
defines = [
  "__ASSERT_MACROS_DEFINE_VERSIONS_WITHOUT_UNDERSCORES=0",
  "OBJC_OLD_DISPATCH_PROTOTYPES=1"
]
```

同时删除 `mac_sdk_path` 参数，即可完成编译

[^update-code]: 如果后面想获取最新代码，执行 `git rebase-update && gclient sync` 即可。

[^enable-nacl]: 此参数，一般使用不到，作用是能够从浏览器直接运行程序机器代码，而 `google` 也在 `2018 Q1` 时说明了，此技术除 `Chrome OS` 以外的项目(Chrome APP)将废弃使用，未来的工作重点将放在 `WebAssembly` 。详情: [WebAssembly Migration Guide](https://developer.chrome.com/native-client/migration)
