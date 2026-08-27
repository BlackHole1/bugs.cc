---
title: 基于 vue-simplemde 实现图片拖拽、粘贴功能的一些思考
description: 监听 drop 和 paste 事件来在 vue-simplemde 实现图片拖拽、粘贴功能
date: 2018-04-12T11:00:12+08:00
tags:
  - javascript
  - vue
  - markdown
translationKey: simplemde-realizes-some-thoughts-on-drag-and-drop-and-paste-function
aliases:
  - /zh/2018/04/12/simplemde-realizes-some-thoughts-on-drag-and-drop-and-paste-function/
  - /zh/p/simplemde-realizes-some-thoughts-on-drag-and-drop-and-paste-function/
  - /zh/posts/基于vue-simplemde实现图片拖拽粘贴/
---

## 前言 {#intro}

项目使用的是 vue 框架，需要一个 markdown 的编辑框，就在 npm 上找了一下，发现 [simplemde](https://www.npmjs.com/package/simplemde) 挺不错的，由于我比较懒，就顺便在 npm 又搜了一下，找到了 [vue-simplemde](https://www.npmjs.com/package/vue-simplemde) 这个 `package`，那就开始使用它吧。

但是这个 `vue-simplemde` 不支持图片拖拽上传、粘贴上传，也不能说是因为这个 `vue-simplemde`，因为 `vue-simplemde` 只是对 `simplemde` 的基础上封装成一个 Vue 插件。所以最后还是由于 `simplemde` 没有提供相关的功能，但是为了用户体验考虑，这个功能时必要的，除非不使用 markdown 编辑器。而去使用富文本编辑器，那样的话，项目很多的代码都要进行更改。所以就在网上查了文章，及在 github 上查了一些代码。下面将进行分析

## 拖拽 {#drag-drop}

拖拽的 API 核心是 `drop` 这个事件，就是当我们从桌面拖动一个文件到浏览器里时，松开的时候，而触发的事件名。

我们都知道，你随便拖动一个图片到浏览器里，会直接打开这个图片，这是因为浏览器默认你拖动文件到浏览器里时，将打开这个文件，所以，我们需要阻止原生的操作。

我们现在先写一段代码，让其屏蔽掉默认事件

```js
window.addEventListener("drop", e => {
  e = e || event
  if (e.target.className === 'CodeMirror-scroll') { // 如果进入到编辑器的话，将阻止默认事件
    e.preventDefault()
  }
}, false)
```

`CodeMirror-scroll` 这个 Class 就是 `simplemde` 编辑框的 Class 名称。

现在我们拖拽文件到这个编辑框，然后松掉，不会出现任何反应。如果在编辑框之外的地方，还是会继续触发默认事件。

下面就是获取 `simplemde` 方法，给他 `drop` 事件处理方法。

```js
// 假设页面一共有三个编辑窗口，所以需要循环监听事件
[ this.$refs.simplemde1,
  this.$refs.simplemde2,
  this.$refs.simplemde3
].map(({simplemde}) => {
  simplemde.codemirror.on('drop', (editor, e) => {
    if (!(e.dataTransfer && e.dataTransfer.files)) {
      // 弹窗说明，此浏览器不支持此操作
      return
    }

    let dataList = e.dataTransfer.files
    let imageFiles = [] // 要上传的文件实例数组

    // 循环，是因为可能会同时拖动几个图片文件
    for (let i = 0; i < dataList.length; i++) {
    // 如果不是图片，则弹窗警告 仅支持拖拽图片文件
      if (dataList[i].type.indexOf('image') === -1) {
        // 下面的 continue，作用是，如果用户同时拖动 2 个图片和一个文档，那么文档不给于上传，图片照常上传。
        continue
      }
      imageFiles.push(dataList[i])  // 先把当前的文件 push 进数组里，等 for 循环结束之后，统一上传。
    }
    // uploadImagesFile 方法是上传图片的方法
    // simplemde.codemirror 的作用是用于区分当前的图片上传是处于哪个编辑框
    this.uploadImagesFile(simplemde.codemirror, imageFiles)
    // 因为已经有了下面这段代码，所以上面的屏蔽默认事件代码就不用写了
    e.preventDefault()
  })
})
```

诈一看，代码好像有点多，那是因为注释的原因，下面是没有注释的代码。你可以根据下面的代码，有自己的见解和理解:

```js
[ this.$refs.simplemde1,
  this.$refs.simplemde2,
  this.$refs.simplemde3
].map(({simplemde}) => {
  simplemde.codemirror.on('drop', (editor, e) => {
    if (!(e.dataTransfer && e.dataTransfer.files)) {
      return
    }
    let dataList = e.dataTransfer.files
    let imageFiles = []
    for (let i = 0; i < dataList.length; i++) {
      if (dataList[i].type.indexOf('image') === -1) {
        continue
      }
      imageFiles.push(dataList[i])
    }
    this.uploadImagesFile(simplemde.codemirror, imageFiles)
    e.preventDefault()
  })
})
```

## 粘贴 {#paste}

粘贴的 API 是 `paste` 方法，这个不像上面一样，粘贴不需要禁止默认事件，因为我们可以看到，你复制一个图片，到浏览器里按下 `ctrl+v` 的时候，是不会发生任何变化的，所以没用必要禁止默认事件。

下面是代码:

```js
simplemde.codemirror.on('paste', (editor, e) => { // 粘贴图片的触发函数
  if (!(e.clipboardData && e.clipboardData.items)) {
    // 弹窗说明，此浏览器不支持此操作
    return
  }
  try {
    let dataList = e.clipboardData.items
    if (dataList[0].kind === 'file' && dataList[0].getAsFile().type.indexOf('image') !== -1) {
      this.uploadImagesFile(simplemde.codemirror, [dataList[0].getAsFile()])
    }
  } catch (e) {
    // 弹窗说明，只能粘贴图片
  }
})
```

之所以这里写上 `try...catch` 方法，是因为如果你粘贴的时候，如果是一个文件，`items` 将是空的，而在下面的 if 循环里，使用 `dataList[0].kind`。也就是 `e.clipboardData.items[0].kind`。当 `item` 为空时，还去访问一个不存的 `kind` 属性时，就会报错了。所以这里需要使用 `try...catch` 方法进行判断。

`dataList[0].getAsFile().type.indexOf('image') !== -1` 这个句话是判断，粘贴的东西确认是图片，而不是其他东西。

`if` 里的上传图片，不一样的地方是 `[dataList[0].getAsFile()]`，因为为了统一格式，方便 `uploadImagesFile` 函数进行处理，我加上了`[]`，使之成为数组。`dataList[0].getAsFile()` 就是获取文件实例了。

## 上传 {#upload}

上传就有一点麻烦了:

```js
uploadImagesFile (simplemde, files) {
  // 把每个文件实例使用 FormData 进行包装一下，然后返回一个数组
  let params = files.map(file => {
    let param = new FormData()
    param.append('file', file, file.name)
    return param
  })

  let makeRequest = params => {
    return this.$http.post('/Api/upload', params)
  }
  let requests = params.map(makeRequest)

  this.$http.spread = callback => {
    return arr => {
      return callback.apply(null, arr)
    }
  }

  // 服务端返回的格式是{state: Boolean，data: String}
  // state 为 false 时，data 就是返回的错误信息
  // state 为 true 时，data 是图片上传后 url 地址，这个地址是针对网站的绝对路径。如下:
  // /static/upload/2cfd6a50-3d30-11e8-b351-0d25ce9162a3.png
  Promise.all(requests)
    .then(this.$http.spread((...resps) => {
      for (let i = 0; i < resps.length; i++) {
        let {state, data} = resps[i].data
        if (!state) {
          // 弹窗显示 data 的错误信息
          continue
        }
        let url = `![](${location.origin + data})`  // 拼接成 markdown 语法
        let content = simplemde.getValue()
        simplemde.setValue(content + url + '\n')  // 和编辑框之前的内容进行拼接
      }
    }))
}
```

因为我是把 `axiox` 封装成 vue 插件来使用，这样会导致，`this.$http` 是实例化后的，而不是他本身。
`axios` 维护者说的解决方案是，重新引入 `axios` 包，来使用。但是我觉得没有必要。`axios.all` 内部是 `Promise.all`。`axios.spread` 实现代码比较少，就直接拿过来，重新赋值给 `axios` 就好了

所以上面有段代码是

```js
Promise.all(requests)
  .then(this.$http.spread((...resps) => {
    // code
  })
```

把这段代码翻译一下就是

```js
axios.all(requests)
  .then(axios.spread((...resps) => {
    // code
  })
```

关于这个问题，请看下官方的解释: [axios-all-is-not-a-function-inside-vue-component](https://forum.vuejs.org/t/axios-all-is-not-a-function-inside-vue-component/15601)。也可以看下 `axios` 的代码: [axios.js#L45-L48](https://github.com/axios/axios/blob/master/lib/axios.js#L45-L48)

这个问题，暂时就不深究了，我们回到刚刚的话题上。

上面我说到当 state 为 true 时，data 是文件相对于网站的绝对路径，如: `/static/upload/2cfd6a50-3d30-11e8-b351-0d25ce9162a3.png`

如果我们需要进行拼接一下，所以就有了 `![](${location.origin + data})` 这段代码进行拼接。最后的两行是获取指的获取之前的内容，然后在追加 url 地址。

## 结尾 {#conclusion}

下面是最终的效果图:

![](/images/simplemde-realizes-some-thoughts-on-drag-and-drop-and-paste-function/drag-paste-upload.gif)

完整代码: [Subject.vue#L378-L465](https://github.com/BlackHole1/Koler/blob/8e4677897fa7eb7545f3d269642e9ab6f5f44b5e/src/components/Subject/Subject.vue#L378-L465)

## 参考 && 感谢 {#references}

[skecozo 作者的 laravel-demo 项目里的部分代码](https://github.com/skecozo/laravel-demo/blob/c18efbffaaef59ded6180c0201de2bad0e248c4c/resources/assets/js/lib/simplemde.js)

[Lemon 作者的《simplemde 实现拖拽、粘贴图片上传》文章](https://www.it9g.com/post/simplemde-to-achieve-drag-and-drop,-paste-pictures-upload)

[f-loat 作者的 vue-simplemde 项目](https://www.npmjs.com/package/vue-simplemde)

[wescossick 作者的 simplemde 项目](https://www.npmjs.com/package/simplemde)
