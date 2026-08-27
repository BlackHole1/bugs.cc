---
title: View and analyze Electron crashes on macOS
date: 2024-10-15T20:56:19+08:00
tags:
  - electron
translationKey: view-and-analyze-electron-crashes-on-macos
---

When developing an Electron application, you might encounter crashes. However, for various reasons, the application may not have integrated Sentry or other crash analysis platforms. In such cases, you need to manually check the crash logs to identify the issue.

## Locating Local Crash Logs

Since Electron is based on Chromium, the crash-related operations are largely consistent with Chromium.

In the [Chromium crash-reports], we can see that crash files are stored in the `~/Library/Application\ Support/Chromium/Crashpad/completed` directory. However, since we are using an Electron application and there is no "submission" process, the crash files are kept in the `~/Library/Application\ Support/Chromium/Crashpad/pending` directory.

Before searching, remember to replace `Chromium` in the above directories with your application name, such as `OOMOL Studio`.

If you have encountered many crashes, you’ll find numerous *.dmp files in this directory. Generally, we only need to analyze the most recent crash, so the latest file is the one we require.

## Analyzing Crash Files

### Using `breakpad`

breakpad is an open-source crash analysis tool developed by Google, specifically for Chromium. We can use this tool to analyze our *dmp* files.

```sh
git clone https://chromium.googlesource.com/breakpad/breakpad
cd breakpad
./configure
make
# Optional
make install
```

After executing the above command, you can parse the dmp using `./src/processor/minidump_stackwalk`, or you can directly use `minidump_stackwalk` (if you executed `make install`).

The basic usage method is:

```sh
minidump_stackwalk /path/to/your.dmp [/path/to/symbols]
```

If you use `minidump_stackwalk /path/to/your.dmp`, the output you get will only be addresses, and you won't be able to see the function names. Therefore, we need to provide a symbol file in order to see the function names.

You can download the symbol file by running: `wget https://github.com/electron/electron/releases/download/<ELECTEON_VERSION>/electron-<ELECTEON_VERSION>-darwin-arm64-symbols.zip`. For my own case, I downloaded:

```sh
wget https://github.com/electron/electron/releases/download/v30.5.1/electron-v30.5.1-darwin-arm64-symbols.zip
```

This file is specifically prepared for `breakpad`, so we can directly unzip it to a certain directory and then use that directory as a parameter to pass to `minidump_stackwalk`.

```sh
minidump_stackwalk ./0c6d2547-6694-4109-b82e-cc3e6331885f.dmp ./electron-v30.5.1-darwin-arm64-symbols/breakpad_symbols
```

Next, you will be able to see the detailed crash information. In my case, the result I got is:

```text
Operating system: Mac OS X
                  14.6.1 23G93
CPU: arm64
     12 CPUs

GPU: UNKNOWN

Crash reason:  EXC_BREAKPOINT / 0x00000001
Crash address: 0x1129666c8
Process uptime: 0 seconds

Thread 0 (crashed)
 0  Electron Framework!v8::base::OS::Abort() [platform-posix.cc : 699 + 0x0]
     x0 = 0x0000000000000000    x1 = 0x0000000000000000
     x2 = 0x00000000000120a8    x3 = 0x00000001117656e0
     x4 = 0x00000001804b5a5f    x5 = 0x000000016b046af0
     x6 = 0x000000000000000a    x7 = 0x0000000000000000
     x8 = 0x0000000000000001    x9 = 0x00000001e83ff610
    x10 = 0x0000000000000002   x11 = 0x00000000fffffffd
    x12 = 0x0000010000000000   x13 = 0x0000000000000000
    x14 = 0x0000000000000000   x15 = 0x0000000000000000
    x16 = 0x00000001805657d4   x17 = 0x00000001f2af63e0
    x18 = 0x0000000000000000   x19 = 0x0000013c002cf000
    x20 = 0x0000000115675980   x21 = 0x0000013c002c0000
    x22 = 0x000000016b04fc28   x23 = 0x000000000000ded0
    x24 = 0x000000016b04fd0e   x25 = 0x000000016b047448
    x26 = 0x0000000000010820   x27 = 0x000000000000e838
    x28 = 0x0000013c002d0540    fp = 0x000000016b0473e0
     lr = 0x000000011295e6ec    sp = 0x000000016b0473e0
     pc = 0x00000001129666c8
    Found by: given as instruction pointer in context
 1  Electron Framework!v8::base::FatalOOM(v8::base::OOMType, char const*) [logging.cc : 94 + 0x0]
    x19 = 0x0000013c002cf000   x20 = 0x0000000115675980
    x21 = 0x0000013c002c0000   x22 = 0x000000016b04fc28
    x23 = 0x000000000000ded0   x24 = 0x000000016b04fd0e
    x25 = 0x000000016b047448   x26 = 0x0000000000010820
    x27 = 0x000000000000e838   x28 = 0x0000013c002d0540
     fp = 0x000000016b047400    sp = 0x000000016b0473f0
     pc = 0x000000011295e6ec
    Found by: call frame info
 2  Electron Framework!v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [api.cc : 341 + 0x0]
    x19 = 0x0000013c002cf000   x20 = 0x0000000115675980
    x21 = 0x0000013c002c0000   x22 = 0x000000016b04fc28
    x23 = 0x000000000000ded0   x24 = 0x000000016b04fd0e
    x25 = 0x000000016b047448   x26 = 0x0000000000010820
    x27 = 0x000000000000e838   x28 = 0x0000013c002d0540
     fp = 0x000000016b047420    sp = 0x000000016b047410
     pc = 0x000000010f5c66f4
    Found by: call frame info
 3  Electron Framework!v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [api.cc : 301 + 0xc]
    x19 = 0x0000000115e75e8d   x20 = 0x0000000115675980
    x21 = 0x0000013c002c0000   x22 = 0x000000016b04fc28
    x23 = 0x000000000000ded0   x24 = 0x000000016b04fd0e
    x25 = 0x000000016b047448   x26 = 0x0000000000010820
    x27 = 0x000000000000e838   x28 = 0x0000013c002d0540
     fp = 0x000000016b050150    sp = 0x000000016b047430
     pc = 0x000000010f5c6638
    Found by: call frame info
 4  Electron Framework!v8::internal::(anonymous namespace)::InitProcessWideCodeRange(v8::PageAllocator*, unsigned long) [code-range.cc : 458 + 0x14]
    x19 = 0x0000013c000c1a40   x20 = 0x0000000010000000
    x21 = 0x0000013c000c1a80   x22 = 0x0000013c002cf2d8
    x23 = 0x0000000000000000   x24 = 0x0000000000000000
    x25 = 0x0000013c002c0110   x26 = 0x0000000000010820
    x27 = 0x000000000000e838   x28 = 0x0000013c002d0540
     fp = 0x000000016b050180    sp = 0x000000016b050160
     pc = 0x000000010f71ce70
    Found by: call frame info
 5  Electron Framework!v8::base::CallOnceImpl(std::__Cr::atomic<unsigned char>*, std::__Cr::function<void ()>) [function.h : 428 + 0x8]
    x19 = 0x0000000116de0e90   x20 = 0x0000013c000d0b40
    x21 = 0x0000013c002cdec0   x22 = 0x0000013c002cf2d8
    x23 = 0x0000000000000000   x24 = 0x0000000000000000
    x25 = 0x0000013c002c0110   x26 = 0x0000000000010820
    x27 = 0x000000000000e838   x28 = 0x0000013c002d0540
     fp = 0x000000016b0501a0    sp = 0x000000016b050190
     pc = 0x0000000112962d28
    Found by: call frame info
 6  Electron Framework!v8::internal::CodeRange::EnsureProcessWideCodeRange(v8::PageAllocator*, unsigned long) [once.h : 101 + 0x10]
    x19 = 0x000000016b0501b8   x20 = 0x0000013c000d0b40
    x21 = 0x0000013c002cdec0   x22 = 0x0000013c002cf2d8
    x23 = 0x0000000000000000   x24 = 0x0000000000000000
    x25 = 0x0000013c002c0110   x26 = 0x0000000000010820
    x27 = 0x000000000000e838   x28 = 0x0000013c002d0540
     fp = 0x000000016b0501f0    sp = 0x000000016b0501b0
     pc = 0x000000010f71cd64
    Found by: call frame info
 7  Electron Framework!v8::internal::Heap::SetUp(v8::internal::LocalHeap*) [heap.cc : 5530 + 0x4]
    x19 = 0x0000013c002cded0   x20 = 0x0000000010000000
    x21 = 0x0000013c002cdec0   x22 = 0x0000013c002cf2d8
    x23 = 0x0000000000000000   x24 = 0x0000000000000000
    x25 = 0x0000013c002c0110   x26 = 0x0000000000010820
    x27 = 0x000000000000e838   x28 = 0x0000013c002d0540
     fp = 0x000000016b0502a0    sp = 0x000000016b050200
     pc = 0x000000010f791418
    Found by: call frame info
 8  Electron Framework!v8::internal::Isolate::Init(v8::internal::SnapshotData*, v8::internal::SnapshotData*, v8::internal::SnapshotData*, bool) [isolate.cc : 4719 + 0x0]
    x19 = 0x0000013c002c0000   x20 = 0x000000016b050930
    x21 = 0x0000013c002cdec0   x22 = 0x0000013c002cf2d8
    x23 = 0x0000000000000000   x24 = 0x0000000000000000
    x25 = 0x0000013c002c0110   x26 = 0x0000000000010820
    x27 = 0x000000000000e838   x28 = 0x0000013c002d0540
     fp = 0x000000016b0508e0    sp = 0x000000016b0502b0
     pc = 0x000000010f6f5218
    Found by: call frame info
 9  Electron Framework!v8::internal::Isolate::InitWithSnapshot(v8::internal::SnapshotData*, v8::internal::SnapshotData*, v8::internal::SnapshotData*, bool) [isolate.cc : 4376 + 0x0]
    x19 = 0x0000013c002c0000   x20 = 0x0000000116dfabd8
    x21 = 0x0000013c002d0680   x22 = 0x0000013c002cee98
    x23 = 0x0000000000000000   x24 = 0x0000013c002c0000
    x25 = 0x0000013c000a0280   x26 = 0x0000000116d82000
    x27 = 0x0000000000000000   x28 = 0x000000016b0510c0
     fp = 0x000000016b0508f0    sp = 0x000000016b0508f0
     pc = 0x000000010f6f5d80
    Found by: call frame info
10  Electron Framework!v8::internal::Snapshot::Initialize(v8::internal::Isolate*) [snapshot.cc : 198 + 0x10]
    x19 = 0x0000013c002c0000   x20 = 0x0000000116dfabd8
    x21 = 0x0000013c002d0680   x22 = 0x0000013c002cee98
    x23 = 0x0000000000000000   x24 = 0x0000013c002c0000
    x25 = 0x0000013c000a0280   x26 = 0x0000000116d82000
    x27 = 0x0000000000000000   x28 = 0x000000016b0510c0
     fp = 0x000000016b0509d0    sp = 0x000000016b050900
     pc = 0x000000010fb92e5c
    Found by: call frame info
11  Electron Framework!v8::Isolate::Initialize(v8::Isolate*, v8::Isolate::CreateParams const&) [api.cc : 9725 + 0x4]
    x19 = 0x0000013c002c0000   x20 = 0x0000013c00042f40
    x21 = 0x0000013c002d0680   x22 = 0x0000013c002cee98
    x23 = 0x0000000000000000   x24 = 0x0000013c002c0000
    x25 = 0x0000013c000a0280   x26 = 0x0000000116d82000
    x27 = 0x0000000000000000   x28 = 0x000000016b0510c0
     fp = 0x000000016b050a10    sp = 0x000000016b0509e0
     pc = 0x000000010f5ea6ac
    Found by: call frame info
12  Electron Framework!gin::IsolateHolder::IsolateHolder(scoped_refptr<base::SingleThreadTaskRunner>, gin::IsolateHolder::AccessMode, gin::IsolateHolder::IsolateType, std::__Cr::unique_ptr<v8::Isolate::CreateParams, std::__Cr::default_delete<v8::Isolate::CreateParams>>, gin::IsolateHolder::IsolateCreationMode, scoped_refptr<base::SingleThreadTaskRunner>, v8::Isolate*) [isolate_holder.cc : 122 + 0x0]
    x19 = 0x0000013c00161688   x20 = 0x0000013c00020360
    x21 = 0x000000016b050a88   x22 = 0x0000000000000000
    x23 = 0x0000000000000000   x24 = 0x0000013c002c0000
    x25 = 0x0000013c000a0280   x26 = 0x0000000116d82000
    x27 = 0x0000000000000000   x28 = 0x000000016b0510c0
     fp = 0x000000016b050a60    sp = 0x000000016b050a20
     pc = 0x0000000112aff208
    Found by: call frame info
13  Electron Framework!electron::JavascriptEnvironment::JavascriptEnvironment(uv_loop_s*, bool) [javascript_environment.cc : 97 + 0x1c]
    x19 = 0x0000013c00161680   x20 = 0x0000013c00161688
    x21 = 0x0000013c002c0000   x22 = 0x0000000000000000
    x23 = 0x0000000000000000   x24 = 0x000000016b050d20
    x25 = 0x0000000116d82000   x26 = 0x0000013c00092ac8
    x27 = 0x0000000000000000   x28 = 0x000000016b0510c0
     fp = 0x000000016b050ab0    sp = 0x000000016b050a70
     pc = 0x000000010e4cd8e8
    Found by: call frame info
14  Electron Framework!electron::NodeService::Initialize(mojo::StructPtr<node::mojom::NodeServiceParams>) [unique_ptr.h : 621 + 0x8]
    x19 = 0x0000013c00170d20   x20 = 0x000000016b050c70
    x21 = 0x0000000116dd4c08   x22 = 0x0000000000000000
    x23 = 0x0000000000000000   x24 = 0x000000016b050d20
    x25 = 0x0000000116d82000   x26 = 0x0000013c00092ac8
    x27 = 0x0000000000000000   x28 = 0x000000016b0510c0
     fp = 0x000000016b050c60    sp = 0x000000016b050ac0
     pc = 0x000000010e581fac
    Found by: call frame info
15  Electron Framework!node::mojom::NodeServiceStubDispatch::Accept(node::mojom::NodeService*, mojo::Message*) [node_service.mojom.cc : 278 + 0x10]
    x19 = 0x0000013c00170d20   x20 = 0x000000016b051150
    x21 = 0x0000013c00082d00   x22 = 0x0000000000000000
    x23 = 0x0000000000000000   x24 = 0x000000016b050d20
    x25 = 0x0000000116d82000   x26 = 0x0000013c00092ac8
    x27 = 0x0000000000000000   x28 = 0x000000016b0510c0
     fp = 0x000000016b050c90    sp = 0x000000016b050c70
     pc = 0x000000011147d9bc
    Found by: call frame info
16  Electron Framework!mojo::InterfaceEndpointClient::HandleValidatedMessage(mojo::Message*) [interface_endpoint_client.cc : 1021 + 0xc]
    x19 = 0x0000013c00082d00   x20 = 0x000000016b051150
    x21 = 0x0000013c00082d00   x22 = 0x0000000000000000
    x23 = 0x0000000000000000   x24 = 0x000000016b050d20
    x25 = 0x0000000116d82000   x26 = 0x0000013c00092ac8
    x27 = 0x0000000000000000   x28 = 0x000000016b0510c0
     fp = 0x000000016b050dd0    sp = 0x000000016b050ca0
     pc = 0x00000001119d1108
    Found by: call frame info
17  Electron Framework!mojo::MessageDispatcher::Accept(mojo::Message*) [message_dispatcher.cc : 43 + 0xc]
    x19 = 0x000000016b051150   x20 = 0x0000013c00082de8
    x21 = 0x000000016b051150   x22 = 0x0000013c00082d00
    x23 = 0x0000000000000000   x24 = 0x000000016b0510c0
    x25 = 0x0000000000000000   x26 = 0x0000013c00092ac8
    x27 = 0x0000000000000000   x28 = 0x000000016b0510c0
     fp = 0x000000016b050e30    sp = 0x000000016b050de0
     pc = 0x00000001119d5b78
    Found by: call frame info
18  Electron Framework!mojo::InterfaceEndpointClient::HandleIncomingMessage(mojo::Message*) [interface_endpoint_client.cc : 706 + 0x4]
    x19 = 0x00000001158a778e   x20 = 0x0000000028bc8f23
    x21 = 0x000000016b051150   x22 = 0x0000013c00082d00
    x23 = 0x0000000000000000   x24 = 0x000000016b0510c0
    x25 = 0x0000000000000000   x26 = 0x0000013c00092ac8
    x27 = 0x0000000000000000   x28 = 0x000000016b0510c0
     fp = 0x000000016b050fa0    sp = 0x000000016b050e40
     pc = 0x00000001119d2d40
    Found by: call frame info
19  Electron Framework!mojo::internal::MultiplexRouter::Accept(mojo::Message*) [multiplex_router.cc : 1096 + 0x8]
    x19 = 0x0000013c00092800   x20 = 0x0000013c000c1040
    x21 = 0x0000000000000000   x22 = 0x0000013c00082d00
    x23 = 0x0000000000000000   x24 = 0x000000016b0510c0
    x25 = 0x0000000000000000   x26 = 0x0000013c00092ac8
    x27 = 0x0000000000000000   x28 = 0x000000016b0510c0
     fp = 0x000000016b051230    sp = 0x000000016b050fb0
     pc = 0x00000001119de6cc
    Found by: call frame info
20  Electron Framework!mojo::MessageDispatcher::Accept(mojo::Message*) [message_dispatcher.cc : 43 + 0xc]
    x19 = 0x000000016b051300   x20 = 0x0000013c00092830
    x21 = 0x0000000000000000   x22 = 0x0000013c000509e0
    x23 = 0x000000016b051300   x24 = 0xaaaaaaaaaaaaaaaa
    x25 = 0x000000016b051380   x26 = 0x0000000000000000
    x27 = 0x0000000000000008   x28 = 0x0000000116d82000
     fp = 0x000000016b051290    sp = 0x000000016b051240
     pc = 0x00000001119d5b78
    Found by: call frame info
21  Electron Framework!base::internal::Invoker<base::internal::FunctorTraits<void (mojo::Connector::* const&)(char const*, unsigned int), mojo::Connector*, char const* const&>, base::internal::BindState<true, true, false, void (mojo::Connector::*)(char const*, unsigned int), base::internal::UnretainedWrapper<mojo::Connector, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>, base::internal::UnretainedWrapper<char const, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>>, void (unsigned int)>::Run(base::internal::BindStateBase*, unsigned int) [connector.cc : 554 + 0xc]
    x19 = 0x0000013c00092860   x20 = 0x0000013c00092a10
    x21 = 0x0000000000000000   x22 = 0x0000013c000509e0
    x23 = 0x000000016b051300   x24 = 0xaaaaaaaaaaaaaaaa
    x25 = 0x000000016b051380   x26 = 0x0000000000000000
    x27 = 0x0000000000000008   x28 = 0x0000000116d82000
     fp = 0x000000016b051420    sp = 0x000000016b0512a0
     pc = 0x00000001119ce6a8
    Found by: call frame info
22  Electron Framework!base::internal::Invoker<base::internal::FunctorTraits<void (* const&)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)> const&>, base::internal::BindState<false, true, false, void (*)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)>>, void (unsigned int, mojo::HandleSignalsState const&)>::Run(base::internal::BindStateBase*, unsigned int, mojo::HandleSignalsState const&) [callback.h : 344 + 0x4]
    x19 = 0x0000013c00073070   x20 = 0x0000013c001603c0
    x21 = 0x0000013c00160240   x22 = 0x0000000000000000
    x23 = 0x0000013c00062f80   x24 = 0x000000016b0514e8
    x25 = 0x0000000116d82000   x26 = 0x0000000000000000
    x27 = 0x0000000116eda000   x28 = 0x00000001158a778e
     fp = 0x000000016b051440    sp = 0x000000016b051430
     pc = 0x000000010e404a4c
    Found by: call frame info
23  Electron Framework!base::internal::Invoker<base::internal::FunctorTraits<void (mojo::SimpleWatcher::*&&)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>&&, int&&, unsigned int&&, mojo::HandleSignalsState&&>, base::internal::BindState<true, true, false, void (mojo::SimpleWatcher::*)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>, int, unsigned int, mojo::HandleSignalsState>, void ()>::RunOnce(base::internal::BindStateBase*) [callback.h : 344 + 0x8]
    x19 = 0x0000000116d82000   x20 = 0x0000013c001603c0
    x21 = 0x0000013c00160240   x22 = 0x0000000000000000
    x23 = 0x0000013c00062f80   x24 = 0x000000016b0514e8
    x25 = 0x0000000116d82000   x26 = 0x0000000000000000
    x27 = 0x0000000116eda000   x28 = 0x00000001158a778e
     fp = 0x000000016b051580    sp = 0x000000016b051450
     pc = 0x00000001119f2388
    Found by: call frame info
24  Electron Framework!base::TaskAnnotator::RunTaskImpl(base::PendingTask&) [callback.h : 156 + 0x0]
    x19 = 0x0000013c00261000   x20 = 0x0000012800440270
    x21 = 0x0000000000000000   x22 = 0x0000000000000000
    x23 = 0x0000013c00080000   x24 = 0xaaaaaaaaaaaaaaaa
    x25 = 0x0000000116d82000   x26 = 0x0000000000000000
    x27 = 0xaaaaaaaaaaaaaa00   x28 = 0x0000000000000000
     fp = 0x000000016b051600    sp = 0x000000016b051590
     pc = 0x00000001116bea7c
    Found by: call frame info
25  Electron Framework!base::sequence_manager::internal::ThreadControllerWithMessagePumpImpl::DoWorkImpl(base::LazyNow*) [task_annotator.h : 90 + 0x8]
    x19 = 0x0000013c00261000   x20 = 0xaaaaaaaaaaaaaa00
    x21 = 0x0000000000000019   x22 = 0x0000000000000000
    x23 = 0x0000013c00080000   x24 = 0xaaaaaaaaaaaaaaaa
    x25 = 0x0000000116d82000   x26 = 0x0000000000000000
    x27 = 0xaaaaaaaaaaaaaa00   x28 = 0x0000000000000000
     fp = 0x000000016b051880    sp = 0x000000016b051610
     pc = 0x00000001116d8f5c
    Found by: call frame info
26  Electron Framework!non-virtual thunk to base::sequence_manager::internal::ThreadControllerWithMessagePumpImpl::DoWork() [thread_controller_with_message_pump_impl.cc : 338 + 0xc]
    x19 = 0x000000016b051920   x20 = 0x0000013c000800e8
    x21 = 0x0000013c00080000   x22 = 0xaaaaaaaaaaaaaaaa
    x23 = 0x7fffffffffffffff   x24 = 0x0000000000000000
    x25 = 0x0000000000000016   x26 = 0x0000000000000000
    x27 = 0x0000000000000000   x28 = 0x0000000000000000
     fp = 0x000000016b051910    sp = 0x000000016b051890
     pc = 0x00000001116d956c
    Found by: call frame info
27  Electron Framework!base::MessagePumpDefault::Run(base::MessagePump::Delegate*) [message_pump_default.cc : 40 + 0x8]
    x19 = 0x0000013c00060440   x20 = 0x0000013c000800e8
    x21 = 0x0000000000000001   x22 = 0xaaaaaaaaaaaaaaaa
    x23 = 0x7fffffffffffffff   x24 = 0x0000000000000000
    x25 = 0x0000000000000016   x26 = 0x0000000000000000
    x27 = 0x0000000000000000   x28 = 0x0000000000000000
     fp = 0x000000016b051980    sp = 0x000000016b051920
     pc = 0x000000011168056c
    Found by: call frame info
28  Electron Framework!base::sequence_manager::internal::ThreadControllerWithMessagePumpImpl::Run(bool, base::TimeDelta) [thread_controller_with_message_pump_impl.cc : 641 + 0x0]
    x19 = 0x0000013c00080000   x20 = 0x0000000000000001
    x21 = 0x7fffffffffffffff   x22 = 0x0000000000000001
    x23 = 0x7ffffffffffffff7   x24 = 0x000000016b051b58
    x25 = 0x0000000000000016   x26 = 0x0000000000000000
    x27 = 0x0000000000000000   x28 = 0x0000000000000000
     fp = 0x000000016b0519d0    sp = 0x000000016b051990
     pc = 0x00000001116d9bd4
    Found by: call frame info
29  Electron Framework!base::RunLoop::Run(base::Location const&) [run_loop.cc : 134 + 0x4]
    x19 = 0x000000016b051b10   x20 = 0x000000016b051ad0
    x21 = 0x000000016b0519e8   x22 = 0x0000000000000000
    x23 = 0x7ffffffffffffff7   x24 = 0x000000016b051b58
    x25 = 0x0000000000000016   x26 = 0x0000000000000000
    x27 = 0x0000000000000000   x28 = 0x0000000000000000
     fp = 0x000000016b051ab0    sp = 0x000000016b0519e0
     pc = 0x00000001116a4f04
    Found by: call frame info
30  Electron Framework!content::UtilityMain(content::MainFunctionParams) [utility_main.cc : 439 + 0x24]
    x19 = 0x00000128002ce5b0   x20 = 0x0000000000000007
    x21 = 0x0000000115652ec1   x22 = 0x000000016b051ad7
    x23 = 0x7ffffffffffffff7   x24 = 0x000000016b051b58
    x25 = 0x0000000000000016   x26 = 0x0000000000000000
    x27 = 0x0000000000000000   x28 = 0x0000000000000000
     fp = 0x000000016b051c50    sp = 0x000000016b051ac0
     pc = 0x00000001110e24c4
    Found by: call frame info
31  Electron Framework!content::RunOtherNamedProcessTypeMain(std::__Cr::basic_string<char, std::__Cr::char_traits<char>, std::__Cr::allocator<char>> const&, content::MainFunctionParams, content::ContentMainDelegate*) [content_main_runner_impl.cc : 775 + 0x4]
    x19 = 0x00000001110e1dd8   x20 = 0x000000016b0521f0
    x21 = 0x000000016b051dd0   x22 = 0x0000000116ae4668
    x23 = 0x000000016b051e98   x24 = 0x0000000000000007
    x25 = 0x000000018028fe0b   x26 = 0x0000000000000000
    x27 = 0x0000000000000000   x28 = 0x0000000000000000
     fp = 0x000000016b051db0    sp = 0x000000016b051c60
     pc = 0x000000010e6ef7e4
    Found by: call frame info
32  Electron Framework!content::ContentMainRunnerImpl::Run() [content_main_runner_impl.cc : 1150 + 0x8]
    x19 = 0x00000128002e0280   x20 = 0x000000016b051dd0
    x21 = 0x000000016b051e50   x22 = 0x000000016b051e98
    x23 = 0x0000000000000007   x24 = 0x0000000000000007
    x25 = 0x000000018028fe0b   x26 = 0x0000000000000000
    x27 = 0x0000000000000000   x28 = 0x0000000000000000
     fp = 0x000000016b051ef0    sp = 0x000000016b051dc0
     pc = 0x000000010e6f04e0
    Found by: call frame info
33  Electron Framework!content::RunContentProcess(content::ContentMainParams, content::ContentMainRunner*) [content_main.cc : 331 + 0x4]
    x19 = 0x00000128002e0280   x20 = 0x0000000000000007
    x21 = 0x000000016b051f08   x22 = 0x0000000000000007
    x23 = 0x000000016b052040   x24 = 0x000000016b052380
    x25 = 0x000000018028fe0b   x26 = 0x0000000000000000
    x27 = 0x0000000000000000   x28 = 0x0000000000000000
     fp = 0x000000016b052100    sp = 0x000000016b051f00
     pc = 0x000000010e6eee84
    Found by: call frame info
34  Electron Framework!content::ContentMain(content::ContentMainParams) [content_main.cc : 344 + 0x4]
    x19 = 0x000000016b052178   x20 = 0x000000016b052110
    x21 = 0x0000000116d82000   x22 = 0x0000000000000080
    x23 = 0x000000016b0522f0   x24 = 0x000000016b052380
    x25 = 0x000000018028fe0b   x26 = 0x0000000000000000
    x27 = 0x0000000000000000   x28 = 0x0000000000000000
     fp = 0x000000016b052160    sp = 0x000000016b052110
     pc = 0x000000010e6ef048
    Found by: call frame info
35  Electron Framework!ElectronMain [electron_library_main.mm : 26 + 0x4]
    x19 = 0x000000016b0524f0   x20 = 0x0000000000000014
    x21 = 0x0000000116d82000   x22 = 0x0000000000000080
    x23 = 0x000000016b0522f0   x24 = 0x000000016b052380
    x25 = 0x000000018028fe0b   x26 = 0x0000000000000000
    x27 = 0x0000000000000000   x28 = 0x0000000000000000
     fp = 0x000000016b052250    sp = 0x000000016b052170
     pc = 0x000000010e3c852c
    Found by: call frame info
36  Electron Framework!ElectronMain [electron_library_main.mm : 26 + 0x4]
     fp = 0x000000016b0522a0    lr = 0x0000000104daca50
     sp = 0x000000016b052260    pc = 0x000000010e3c852c
    Found by: previous frame's frame pointer
37  OOMOL Studio Helper (Plugin) + 0xa4c
     fp = 0x000000016b0524d0    lr = 0x000000018021b154
     sp = 0x000000016b0522b0    pc = 0x0000000104daca50
    Found by: previous frame's frame pointer
38  dyld + 0x6150
     fp = 0x0000000000000000    lr = 0x534b800000000000
     sp = 0x000000016b0524e0    pc = 0x000000018021b154
    Found by: previous frame's frame pointer
...
...
```

It can be seen that the cause of the crash here is that the `Helper (Plugin)` process (corresponding to `AppName Helper (Plugin).app` in electron) failed to allocate memory when using `UtilityMain` (corresponding to [utilityProcess] in electron), leading to the crash.

Combining this with our business needs: when we use electron's `utilityProcess.fork` method, the v8 engine in the forked script is unable to allocate memory, resulting in a crash.

Ultimately, we found that this was caused by the lack of the `com.apple.security.cs.allow-jit` entitlement in the `entitlements` we declared for `AppName Helper (Plugin).app` during the code signing process.

### Using `lldb`

Personally, I would prefer using `lldb` to investigate the cause of the crash, as its output is more intuitive.

First, use the following command to download the dsym file:

```sh
wget https://github.com/electron/electron/releases/download/v30.5.1/electron-v30.5.1-darwin-arm64-dsym.zip
```

After decompressing is complete, we need to set the search path for `lldb` and execute `bt` to view:

```sh
lldb -c ./0c6d2547-6694-4109-b82e-cc3e6331885f.dmp -o "settings set target.exec-search-paths ./electron-v30.5.1-darwin-arm64-dsym" -o "bt"
```

The final output is as follows:

```text
* thread #1, stop reason = EXC_BREAKPOINT (code=1, subcode=0x1129666c8)
  * frame #0: 0x00000001129666c8 Electron Framework`v8::base::OS::Abort() [inlined] v8::base::OS::Abort()::$_0::operator()(this=<unavailable>) const at platform-posix.cc:699:7 [opt]
    frame #1: 0x00000001129666c8 Electron Framework`v8::base::OS::Abort() at platform-posix.cc:699:7 [opt]
    frame #2: 0x000000011295e6ec Electron Framework`v8::base::FatalOOM(type=<unavailable>, msg=<unavailable>) at logging.cc:94:3 [opt]
    frame #3: 0x000000010f5c66f4 Electron Framework`v8::Utils::ReportOOMFailure(i_isolate=<unavailable>, location=<unavailable>, details=<unavailable>) at api.cc:341:7 [opt]
    frame #4: 0x000000010f5c6638 Electron Framework`v8::internal::V8::FatalProcessOutOfMemory(i_isolate=0x0000013c002c0000, location="", details=0x0000000115675980) at api.cc:301:3 [opt]
    frame #5: 0x000000010f71ce70 Electron Framework`v8::internal::(anonymous namespace)::InitProcessWideCodeRange(page_allocator=<unavailable>, requested_size=<unavailable>) at code-range.cc:458:5 [opt]
    frame #6: 0x0000000112962d28 Electron Framework`v8::base::CallOnceImpl(std::__Cr::atomic<unsigned char>*, std::__Cr::function<void ()>) [inlined] std::__Cr::__function::__value_func<void ()>::operator()(this=<unavailable>) const at function.h:428:12 [opt]
    frame #7: 0x0000000112962d14 Electron Framework`v8::base::CallOnceImpl(std::__Cr::atomic<unsigned char>*, std::__Cr::function<void ()>) [inlined] std::__Cr::function<void ()>::operator()(this=<unavailable>) const at function.h:981:10 [opt]
    frame #8: 0x0000000112962d14 Electron Framework`v8::base::CallOnceImpl(once=0x0000000116de0e90, init_func=<unavailable>) at once.cc:36:5 [opt]
    frame #9: 0x000000010f71cd64 Electron Framework`v8::internal::CodeRange::EnsureProcessWideCodeRange(v8::PageAllocator*, unsigned long) [inlined] void v8::base::CallOnce<v8::PageAllocator*, unsigned long, void>(once=<unavailable>, init_func=<unavailable>, args=<unavailable>, args=<unavailable>) at once.h:101:5 [opt]
    frame #10: 0x000000010f71cd10 Electron Framework`v8::internal::CodeRange::EnsureProcessWideCodeRange(page_allocator=0x0000013c000d0b40, requested_size=<unavailable>) at code-range.cc:475:3 [opt]
    frame #11: 0x000000010f791418 Electron Framework`v8::internal::Heap::SetUp(this=0x0000013c002cded0, main_thread_local_heap=<unavailable>) at heap.cc:5530:19 [opt]
    frame #12: 0x000000010f6f5218 Electron Framework`v8::internal::Isolate::Init(this=0x0000013c002c0000, startup_snapshot_data=0x000000016b050960, read_only_snapshot_data=0x000000016b050948, shared_heap_snapshot_data=0x000000016b050930, can_rehash=true) at isolate.cc:4719:9 [opt]
    frame #13: 0x000000010f6f5d80 Electron Framework`v8::internal::Isolate::InitWithSnapshot(this=<unavailable>, startup_snapshot_data=<unavailable>, read_only_snapshot_data=<unavailable>, shared_heap_snapshot_data=<unavailable>, can_rehash=<unavailable>) at isolate.cc:4376:10 [opt]
    frame #14: 0x000000010fb92e5c Electron Framework`v8::internal::Snapshot::Initialize(isolate=0x0000013c002c0000) at snapshot.cc:198:19 [opt]
    frame #15: 0x000000010f5ea6ac Electron Framework`v8::Isolate::Initialize(v8_isolate=0x0000013c002c0000, params=0x0000013c00042f40) at api.cc:9725:8 [opt]
    frame #16: 0x0000000112aff208 Electron Framework`gin::IsolateHolder::IsolateHolder(this=0x0000013c00161688, task_runner=scoped_refptr<base::SingleThreadTaskRunner> @ x20, access_mode=<unavailable>, isolate_type=<unavailable>, params=v8::Isolate::CreateParams @ 0x0000013c00042f40, isolate_creation_mode=kNormal, low_priority_task_runner=scoped_refptr<base::SingleThreadTaskRunner> @ scalar, isolate=<unavailable>) at isolate_holder.cc:122:5 [opt]
    frame #17: 0x000000010e4cd8e8 Electron Framework`electron::JavascriptEnvironment::JavascriptEnvironment(uv_loop_s*, bool) [inlined] electron::(anonymous namespace)::CreateIsolateHolder(isolate=0x0000013c002c0000) at javascript_environment.cc:97:10 [opt]
    frame #18: 0x000000010e4cd884 Electron Framework`electron::JavascriptEnvironment::JavascriptEnvironment(this=0x0000013c00161680, event_loop=<unavailable>, setup_wasm_streaming=<unavailable>) at javascript_environment.cc:108:23 [opt]
    frame #19: 0x000000010e581fac Electron Framework`electron::NodeService::Initialize(mojo::StructPtr<node::mojom::NodeServiceParams>) [inlined] std::__Cr::__unique_if<electron::JavascriptEnvironment>::__unique_single std::__Cr::make_unique<electron::JavascriptEnvironment, uv_loop_s*>(__args=<unavailable>) at unique_ptr.h:621:30 [opt]
    frame #20: 0x000000010e581f98 Electron Framework`electron::NodeService::Initialize(this=0x0000013c00170d20, params=node::mojom::NodeServiceParamsPtr @ 0x000000016b050c70) at node_service.cc:81:13 [opt]
    frame #21: 0x000000011147d9bc Electron Framework`node::mojom::NodeServiceStubDispatch::Accept(impl=0x0000013c00170d20, message=0x000000016b051150) at node_service.mojom.cc:278:13 [opt]
    frame #22: 0x00000001119d1108 Electron Framework`mojo::InterfaceEndpointClient::HandleValidatedMessage(this=<unavailable>, message=<unavailable>) at interface_endpoint_client.cc:1021:54 [opt]
    frame #23: 0x00000001119d5b78 Electron Framework`mojo::MessageDispatcher::Accept(this=0x0000013c00082de8, message=0x000000016b051150) at message_dispatcher.cc:43:19 [opt]
    frame #24: 0x00000001119d2d40 Electron Framework`mojo::InterfaceEndpointClient::HandleIncomingMessage(this=0x0000013c00082d00, message=0x000000016b051150) at interface_endpoint_client.cc:706:20 [opt]
    frame #25: 0x00000001119de6cc Electron Framework`mojo::internal::MultiplexRouter::Accept(mojo::Message*) at multiplex_router.cc:1096:42 [opt]
    frame #26: 0x00000001119de6b4 Electron Framework`mojo::internal::MultiplexRouter::Accept(this=0x0000013c00092800, message=<unavailable>) at multiplex_router.cc:710:7 [opt]
    frame #27: 0x00000001119d5b78 Electron Framework`mojo::MessageDispatcher::Accept(this=0x0000013c00092830, message=0x000000016b051300) at message_dispatcher.cc:43:19 [opt]
    frame #28: 0x00000001119ce6a8 Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::Connector::* const&)(char const*, unsigned int), mojo::Connector*, char const* const&>, base::internal::BindState<true, true, false, void (mojo::Connector::*)(char const*, unsigned int), base::internal::UnretainedWrapper<mojo::Connector, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>, base::internal::UnretainedWrapper<char const, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>>, void (unsigned int)>::Run(base::internal::BindStateBase*, unsigned int) [inlined] mojo::Connector::DispatchMessage(this=0x0000013c00092860, handle=mojo::ScopedMessageHandle @ 0x000000016b0512c0) at connector.cc:554:49 [opt]
    frame #29: 0x00000001119ce5bc Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::Connector::* const&)(char const*, unsigned int), mojo::Connector*, char const* const&>, base::internal::BindState<true, true, false, void (mojo::Connector::*)(char const*, unsigned int), base::internal::UnretainedWrapper<mojo::Connector, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>, base::internal::UnretainedWrapper<char const, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>>, void (unsigned int)>::Run(base::internal::BindStateBase*, unsigned int) at connector.cc:611:14 [opt]
    frame #30: 0x00000001119ce51c Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::Connector::* const&)(char const*, unsigned int), mojo::Connector*, char const* const&>, base::internal::BindState<true, true, false, void (mojo::Connector::*)(char const*, unsigned int), base::internal::UnretainedWrapper<mojo::Connector, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>, base::internal::UnretainedWrapper<char const, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>>, void (unsigned int)>::Run(base::internal::BindStateBase*, unsigned int) [inlined] mojo::Connector::OnHandleReadyInternal(this=0x0000013c00092860, result=<unavailable>) at connector.cc:444:3 [opt]
    frame #31: 0x00000001119ce51c Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::Connector::* const&)(char const*, unsigned int), mojo::Connector*, char const* const&>, base::internal::BindState<true, true, false, void (mojo::Connector::*)(char const*, unsigned int), base::internal::UnretainedWrapper<mojo::Connector, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>, base::internal::UnretainedWrapper<char const, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>>, void (unsigned int)>::Run(base::internal::BindStateBase*, unsigned int) [inlined] mojo::Connector::OnWatcherHandleReady(this=0x0000013c00092860, interface_name="", result=<unavailable>) at connector.cc:410:3 [opt]
    frame #32: 0x00000001119ce51c Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::Connector::* const&)(char const*, unsigned int), mojo::Connector*, char const* const&>, base::internal::BindState<true, true, false, void (mojo::Connector::*)(char const*, unsigned int), base::internal::UnretainedWrapper<mojo::Connector, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>, base::internal::UnretainedWrapper<char const, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>>, void (unsigned int)>::Run(base::internal::BindStateBase*, unsigned int) [inlined] void base::internal::DecayedFunctorTraits<void (mojo::Connector::*)(char const*, unsigned int), mojo::Connector*, char const* const&>::Invoke<void (mojo::Connector::*)(char const*, unsigned int), mojo::Connector*, char const*, unsigned int>(method=<unavailable>, receiver_ptr=<unavailable>, args=<unavailable>, args=<unavailable>) at bind_internal.h:738:12 [opt]
    frame #33: 0x00000001119ce51c Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::Connector::* const&)(char const*, unsigned int), mojo::Connector*, char const* const&>, base::internal::BindState<true, true, false, void (mojo::Connector::*)(char const*, unsigned int), base::internal::UnretainedWrapper<mojo::Connector, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>, base::internal::UnretainedWrapper<char const, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>>, void (unsigned int)>::Run(base::internal::BindStateBase*, unsigned int) [inlined] void base::internal::InvokeHelper<false, base::internal::FunctorTraits<void (mojo::Connector::* const&)(char const*, unsigned int), mojo::Connector*, char const* const&>, void, 0ul, 1ul>::MakeItSo<void (mojo::Connector::* const&)(char const*, unsigned int), std::__Cr::tuple<base::internal::UnretainedWrapper<mojo::Connector, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>, base::internal::UnretainedWrapper<char const, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>> const&, unsigned int>(functor=<unavailable>, bound=<unavailable>, args=<unavailable>) at bind_internal.h:930:12 [opt]
    frame #34: 0x00000001119ce51c Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::Connector::* const&)(char const*, unsigned int), mojo::Connector*, char const* const&>, base::internal::BindState<true, true, false, void (mojo::Connector::*)(char const*, unsigned int), base::internal::UnretainedWrapper<mojo::Connector, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>, base::internal::UnretainedWrapper<char const, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>>, void (unsigned int)>::Run(base::internal::BindStateBase*, unsigned int) [inlined] void base::internal::Invoker<base::internal::FunctorTraits<void (mojo::Connector::* const&)(char const*, unsigned int), mojo::Connector*, char const* const&>, base::internal::BindState<true, true, false, void (mojo::Connector::*)(char const*, unsigned int), base::internal::UnretainedWrapper<mojo::Connector, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>, base::internal::UnretainedWrapper<char const, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>>, void (unsigned int)>::RunImpl<void (mojo::Connector::* const&)(char const*, unsigned int), std::__Cr::tuple<base::internal::UnretainedWrapper<mojo::Connector, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>, base::internal::UnretainedWrapper<char const, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>> const&, 0ul, 1ul>(functor=<unavailable>, bound=<unavailable>, (null)=<unavailable>, unbound_args=<unavailable>) at bind_internal.h:1067:14 [opt]
    frame #35: 0x00000001119ce51c Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::Connector::* const&)(char const*, unsigned int), mojo::Connector*, char const* const&>, base::internal::BindState<true, true, false, void (mojo::Connector::*)(char const*, unsigned int), base::internal::UnretainedWrapper<mojo::Connector, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>, base::internal::UnretainedWrapper<char const, base::unretained_traits::MayNotDangle, (partition_alloc::internal::RawPtrTraits)0>>, void (unsigned int)>::Run(base=<unavailable>, unbound_args=<unavailable>) at bind_internal.h:987:12 [opt]
    frame #36: 0x000000010e404a4c Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (* const&)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)> const&>, base::internal::BindState<false, true, false, void (*)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)>>, void (unsigned int, mojo::HandleSignalsState const&)>::Run(base::internal::BindStateBase*, unsigned int, mojo::HandleSignalsState const&) [inlined] base::RepeatingCallback<void (unsigned int)>::Run(this=<unavailable>, args=<unavailable>) const & at callback.h:344:12 [opt]
    frame #37: 0x000000010e404a18 Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (* const&)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)> const&>, base::internal::BindState<false, true, false, void (*)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)>>, void (unsigned int, mojo::HandleSignalsState const&)>::Run(base::internal::BindStateBase*, unsigned int, mojo::HandleSignalsState const&) [inlined] mojo::SimpleWatcher::DiscardReadyState(callback=<unavailable>, result=<unavailable>, state=<unavailable>) at simple_watcher.h:192:14 [opt]
    frame #38: 0x000000010e404a18 Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (* const&)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)> const&>, base::internal::BindState<false, true, false, void (*)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)>>, void (unsigned int, mojo::HandleSignalsState const&)>::Run(base::internal::BindStateBase*, unsigned int, mojo::HandleSignalsState const&) [inlined] void base::internal::DecayedFunctorTraits<void (*)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)> const&>::Invoke<void (* const&)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&>(function=<unavailable>, args=<unavailable>, args=<unavailable>, args=<unavailable>) at bind_internal.h:671:12 [opt]
    frame #39: 0x000000010e404a04 Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (* const&)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)> const&>, base::internal::BindState<false, true, false, void (*)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)>>, void (unsigned int, mojo::HandleSignalsState const&)>::Run(base::internal::BindStateBase*, unsigned int, mojo::HandleSignalsState const&) [inlined] void base::internal::InvokeHelper<false, base::internal::FunctorTraits<void (* const&)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)> const&>, void, 0ul>::MakeItSo<void (* const&)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), std::__Cr::tuple<base::RepeatingCallback<void (unsigned int)>> const&, unsigned int, mojo::HandleSignalsState const&>(functor=<unavailable>, bound=<unavailable>, args=<unavailable>, args=<unavailable>) at bind_internal.h:930:12 [opt]
    frame #40: 0x000000010e404a04 Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (* const&)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)> const&>, base::internal::BindState<false, true, false, void (*)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)>>, void (unsigned int, mojo::HandleSignalsState const&)>::Run(base::internal::BindStateBase*, unsigned int, mojo::HandleSignalsState const&) [inlined] void base::internal::Invoker<base::internal::FunctorTraits<void (* const&)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)> const&>, base::internal::BindState<false, true, false, void (*)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)>>, void (unsigned int, mojo::HandleSignalsState const&)>::RunImpl<void (* const&)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), std::__Cr::tuple<base::RepeatingCallback<void (unsigned int)>> const&, 0ul>(functor=<unavailable>, bound=<unavailable>, (null)=<unavailable>, unbound_args=<unavailable>, unbound_args=<unavailable>) at bind_internal.h:1067:14 [opt]
    frame #41: 0x000000010e404a04 Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (* const&)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)> const&>, base::internal::BindState<false, true, false, void (*)(base::RepeatingCallback<void (unsigned int)> const&, unsigned int, mojo::HandleSignalsState const&), base::RepeatingCallback<void (unsigned int)>>, void (unsigned int, mojo::HandleSignalsState const&)>::Run(base=<unavailable>, unbound_args=<unavailable>, unbound_args=<unavailable>) at bind_internal.h:987:12 [opt]
    frame #42: 0x00000001119f2388 Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::SimpleWatcher::*&&)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>&&, int&&, unsigned int&&, mojo::HandleSignalsState&&>, base::internal::BindState<true, true, false, void (mojo::SimpleWatcher::*)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>, int, unsigned int, mojo::HandleSignalsState>, void ()>::RunOnce(base::internal::BindStateBase*) [inlined] base::RepeatingCallback<void (unsigned int, mojo::HandleSignalsState const&)>::Run(this=0x000000016b051468, args=0, args=<unavailable>) const & at callback.h:344:12 [opt]
    frame #43: 0x00000001119f237c Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::SimpleWatcher::*&&)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>&&, int&&, unsigned int&&, mojo::HandleSignalsState&&>, base::internal::BindState<true, true, false, void (mojo::SimpleWatcher::*)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>, int, unsigned int, mojo::HandleSignalsState>, void ()>::RunOnce(base::internal::BindStateBase*) at simple_watcher.cc:278:14 [opt]
    frame #44: 0x00000001119f237c Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::SimpleWatcher::*&&)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>&&, int&&, unsigned int&&, mojo::HandleSignalsState&&>, base::internal::BindState<true, true, false, void (mojo::SimpleWatcher::*)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>, int, unsigned int, mojo::HandleSignalsState>, void ()>::RunOnce(base::internal::BindStateBase*) [inlined] void base::internal::DecayedFunctorTraits<void (mojo::SimpleWatcher::*)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>&&, int&&, unsigned int&&, mojo::HandleSignalsState&&>::Invoke<void (mojo::SimpleWatcher::*)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher> const&, int, unsigned int, mojo::HandleSignalsState>(method=(Electron Framework`mojo::SimpleWatcher::OnHandleReady(int, unsigned int, mojo::HandleSignalsState const&) at simple_watcher.cc:247), receiver_ptr=<unavailable>, args=0x0000013c00160280, args=0x0000013c00160284, args=<unavailable>) at bind_internal.h:738:12 [opt]
    frame #45: 0x00000001119f237c Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::SimpleWatcher::*&&)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>&&, int&&, unsigned int&&, mojo::HandleSignalsState&&>, base::internal::BindState<true, true, false, void (mojo::SimpleWatcher::*)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>, int, unsigned int, mojo::HandleSignalsState>, void ()>::RunOnce(base::internal::BindStateBase*) [inlined] void base::internal::InvokeHelper<true, base::internal::FunctorTraits<void (mojo::SimpleWatcher::*&&)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>&&, int&&, unsigned int&&, mojo::HandleSignalsState&&>, void, 0ul, 1ul, 2ul, 3ul>::MakeItSo<void (mojo::SimpleWatcher::*)(int, unsigned int, mojo::HandleSignalsState const&), std::__Cr::tuple<base::WeakPtr<mojo::SimpleWatcher>, int, unsigned int, mojo::HandleSignalsState>>(functor=0x0000013c00160260, bound=<unavailable>) at bind_internal.h:954:5 [opt]
    frame #46: 0x00000001119f2298 Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::SimpleWatcher::*&&)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>&&, int&&, unsigned int&&, mojo::HandleSignalsState&&>, base::internal::BindState<true, true, false, void (mojo::SimpleWatcher::*)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>, int, unsigned int, mojo::HandleSignalsState>, void ()>::RunOnce(base::internal::BindStateBase*) [inlined] void base::internal::Invoker<base::internal::FunctorTraits<void (mojo::SimpleWatcher::*&&)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>&&, int&&, unsigned int&&, mojo::HandleSignalsState&&>, base::internal::BindState<true, true, false, void (mojo::SimpleWatcher::*)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>, int, unsigned int, mojo::HandleSignalsState>, void ()>::RunImpl<void (mojo::SimpleWatcher::*)(int, unsigned int, mojo::HandleSignalsState const&), std::__Cr::tuple<base::WeakPtr<mojo::SimpleWatcher>, int, unsigned int, mojo::HandleSignalsState>, 0ul, 1ul, 2ul, 3ul>(functor=0x0000013c00160260, bound=<unavailable>, (null)=<unavailable>) at bind_internal.h:1067:14 [opt]
    frame #47: 0x00000001119f2298 Electron Framework`base::internal::Invoker<base::internal::FunctorTraits<void (mojo::SimpleWatcher::*&&)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>&&, int&&, unsigned int&&, mojo::HandleSignalsState&&>, base::internal::BindState<true, true, false, void (mojo::SimpleWatcher::*)(int, unsigned int, mojo::HandleSignalsState const&), base::WeakPtr<mojo::SimpleWatcher>, int, unsigned int, mojo::HandleSignalsState>, void ()>::RunOnce(base=0x0000013c00160240) at bind_internal.h:980:12 [opt]
    frame #48: 0x00000001116bea7c Electron Framework`base::TaskAnnotator::RunTaskImpl(base::PendingTask&) [inlined] base::OnceCallback<void ()>::Run(this=0x0000013c00261078) && at callback.h:156:12 [opt]
    frame #49: 0x00000001116bea64 Electron Framework`base::TaskAnnotator::RunTaskImpl(this=<unavailable>, pending_task=0x0000013c00261000) at task_annotator.cc:203:34 [opt]
    frame #50: 0x00000001116d8f5c Electron Framework`base::sequence_manager::internal::ThreadControllerWithMessagePumpImpl::DoWorkImpl(base::LazyNow*) [inlined] void base::TaskAnnotator::RunTask<base::sequence_manager::internal::ThreadControllerWithMessagePumpImpl::DoWorkImpl(base::LazyNow*)::$_0>(this=<unavailable>, event_name=<unavailable>, pending_task=0x0000013c00261000, args=<unavailable>) at task_annotator.h:90:5 [opt]
    frame #51: 0x00000001116d8f3c Electron Framework`base::sequence_manager::internal::ThreadControllerWithMessagePumpImpl::DoWorkImpl(this=0x0000013c00080000, continuation_lazy_now=0x000000016b0518c8) at thread_controller_with_message_pump_impl.cc:473:23 [opt]
    frame #52: 0x00000001116d956c Electron Framework`non-virtual thunk to base::sequence_manager::internal::ThreadControllerWithMessagePumpImpl::DoWork() [inlined] base::sequence_manager::internal::ThreadControllerWithMessagePumpImpl::DoWork(this=0x0000013c00080000) at thread_controller_with_message_pump_impl.cc:338:40 [opt]
    frame #53: 0x00000001116d952c Electron Framework`non-virtual thunk to base::sequence_manager::internal::ThreadControllerWithMessagePumpImpl::DoWork() at thread_controller_with_message_pump_impl.cc:0 [opt]
    frame #54: 0x000000011168056c Electron Framework`base::MessagePumpDefault::Run(this=0x0000013c00060440, delegate=0x0000013c000800e8) at message_pump_default.cc:40:55 [opt]
    frame #55: 0x00000001116d9bd4 Electron Framework`base::sequence_manager::internal::ThreadControllerWithMessagePumpImpl::Run(this=0x0000013c00080000, application_tasks_allowed=true, timeout=<unavailable>) at thread_controller_with_message_pump_impl.cc:641:12 [opt]
    frame #56: 0x00000001116a4f04 Electron Framework`base::RunLoop::Run(this=0x000000016b051b10, location=<unavailable>) at run_loop.cc:134:14 [opt]
    frame #57: 0x00000001110e24c4 Electron Framework`content::UtilityMain(parameters=<unavailable>) at utility_main.cc:439:12 [opt]
    frame #58: 0x000000010e6ef7e4 Electron Framework`content::RunOtherNamedProcessTypeMain(process_type=<unavailable>, main_function_params=MainFunctionParams @ 0x000000016b051dd0, delegate=0x000000016b0521f0) at content_main_runner_impl.cc:775:14 [opt]
    frame #59: 0x000000010e6f04e0 Electron Framework`content::ContentMainRunnerImpl::Run(this=0x00000128002e0280) at content_main_runner_impl.cc:1150:10 [opt]
    frame #60: 0x000000010e6eee84 Electron Framework`content::RunContentProcess(params=<unavailable>, content_main_runner=<unavailable>) at content_main.cc:331:36 [opt]
    frame #61: 0x000000010e6ef048 Electron Framework`content::ContentMain(params=ContentMainParams @ 0x000000016b052178) at content_main.cc:344:10 [opt]
    frame #62: 0x000000010e3c852c Electron Framework`ElectronMain(argc=<unavailable>, argv=<unavailable>) at electron_library_main.mm:26:10 [opt]
    frame #63: 0x0000000104daca50 OOMOL Studio Helper (Plugin)`main(argc=20, argv=0x000000016b0524f0) at electron_main_mac.cc:84:10 [opt]
    frame #64: 0x000000018021b154 dyld`start + 2476
```

[chromium crash-reports]: https://www.chromium.org/developers/crash-reports/#on-mac
[utilityProcess]: https://www.electronjs.org/docs/latest/api/utility-process
