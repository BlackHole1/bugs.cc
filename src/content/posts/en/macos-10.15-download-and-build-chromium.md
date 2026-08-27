---
title: Download and build Chromium on macOS 10.15
description: Notes on downloading and building Chromium on macOS 10.15
date: 2020-03-31T15:50:24+08:00
tags:
  - chromium
translationKey: macos-10.15-download-and-build-chromium
---

## Download

To download the Chromium source, see [Checking out and building Chromium for Mac](https://chromium.googlesource.com/chromium/src/+/master/docs/mac_build_instructions.md). Following the docs as-is, though, makes it very hard to actually get the tree down.

Some people suggest cloning via Gitee in China, but Gitee no longer supports a single repo this large (even the enterprise plan cannot handle a project of this size). Chromium with no history already needs 16G.

After some trial and error, `fetch --nohooks --no-history chromium` is much more likely to succeed. After it finishes, run `gclient sync` to run the hooks. If you still need history, run `git fetch --unshallow`, which should give you the same result as `fetch chromium`.

One thing worth noting: `git fetch --unshallow` is also very slow. There are hundreds of thousands of commits, so this comes down to luck. If it fails, run `git gc --prune=now` first, then retry `git fetch --unshallow`, otherwise the repo just keeps growing.

These steps took me 5 days and used 180G of VPN traffic.[^update-code]

## Build

My machine at the time:

- OSVersion: macOS Catalina 10.15.3
- CPU: 2.4 GHz 8-core Intel Core i9
- Memory: 32 GB 2667 MHz DDR4

The official docs: [Checking out and building Chromium for Mac](https://chromium.googlesource.com/chromium/src/+/master/docs/mac_build_instructions.md) mention that you need the OS X 10.15 SDK. My system is 10.15.3, so I already have that SDK. I ran `gn gen out/Debug` to generate the build directory, and it errored...

The error:

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

NaCL is 32-bit, and macOS 10.15+ dropped 32-bit support. The message links to more info. Opening that link showed permission denied, so I could not read it...

The message says you only need to add `enable_nacl=false` in `args.gn`, but `args.gn` only exists after `gn gen out/Debug`. At first glance that looks like a deadlock. After looking around, `gn gen` can take args. Changing the command to `gn gen out/Debug --args="enable_nacl=false"` generates the build directory.[^enable-nacl]

After generating the build directory, `out/Debug/args.gn` contains:

```text
enable_nacl = false
```

You also need to add:

```text
# enable debug
is_debug = true
# build as a shared/dynamic library
is_component_build = true
```

If you then run `autoninja -C out/Debug chrome`, after half an hour or so it fails and cannot continue:

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

I searched the Chromium forum. Someone said using the macOS 10.14 SDK would fix it. I found [MacOSX-SDKs](https://github.com/phracker/MacOSX-SDKs) on GitHub, cloned it, and ran `ln -s /Users/black-hole/Code/Github/MacOSX-SDKs/MacOSX10.14.sdk /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/`.

Rebuild still failed. The error looked the same. The details still mentioned `MacOSX10.15.sdk`, so the build was not picking up the 10.14 SDK.

Looking through the code, `build/config/mac/mac_sdk.gni` defines:

```sh
# Path to a specific version of the Mac SDK, not including a slash at the end.
# If empty, the path to the lowest version greater than or equal to
# mac_sdk_min is used.
mac_sdk_path = ""
```

After finding that, I added `mac_sdk_path = "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX10.14.sdk"` to `args.gn`.

It still failed, and I could not find this error on the Chromium forum.

I searched the Chromium forum again and found [macOS: build with 10.15 SDK + toolchain](https://monorail-prod.appspot.com/p/chromium/issues/detail?id=973128#c10). Someone there provided a patch.

The patch was from October 2019. Trying it produced conflicts:

```sh
$ git apply --check ~/Downloads/compilation_10_15_wip.patch

error: failed to apply patch: build/config/mac/BUILD.gn:77
error: build/config/mac/BUILD.gn: patch not applied
error: failed to apply patch: components/viz/common/gpu/metal_api_proxy.mm:573
error: components/viz/common/gpu/metal_api_proxy.mm: patch not applied
error: failed to apply patch: services/device/geolocation/wifi_data_provider_mac.mm:21
error: services/device/geolocation/wifi_data_provider_mac.mm: patch not applied
```

I looked at the patch and only took the `BUILD.gn` change. In `build/config/mac/BUILD.gn`, find `defines = [ "__ASSERT_MACROS_DEFINE_VERSIONS_WITHOUT_UNDERSCORES=0" ]` and change it to:

```sh
defines = [
  "__ASSERT_MACROS_DEFINE_VERSIONS_WITHOUT_UNDERSCORES=0",
  "OBJC_OLD_DISPATCH_PROTOTYPES=1"
]
```

Also drop the `mac_sdk_path` arg, and the build completes.

[^update-code]: To pull the latest code later, run `git rebase-update && gclient sync`.

[^enable-nacl]: This flag is rarely used. It lets the browser run native machine code. Google said in 2018 Q1 that this technology would be deprecated for everything except Chrome OS (Chrome Apps), and that future work would focus on WebAssembly. Details: [WebAssembly Migration Guide](https://developer.chrome.com/native-client/migration)
