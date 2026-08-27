---
title: Some thoughts on implementing image drag-and-drop and paste with vue-simplemde
description: Listen to drop and paste events to add image drag-and-drop and paste in vue-simplemde
date: 2018-04-12T11:00:12+08:00
tags:
  - javascript
  - vue
  - markdown
translationKey: simplemde-realizes-some-thoughts-on-drag-and-drop-and-paste-function
---

## Intro

The project uses Vue and needed a markdown editor. I looked on npm, found [simplemde](https://www.npmjs.com/package/simplemde) was decent. I'm pretty lazy, so I searched npm again, found the [vue-simplemde](https://www.npmjs.com/package/vue-simplemde) `package`, and started using it.

But `vue-simplemde` does not support drag-and-drop image upload or paste upload. You can't really blame `vue-simplemde`; it is only a Vue wrapper around `simplemde`. So it comes down to `simplemde` not shipping this. For UX this feature is necessary, unless you drop the markdown editor and switch to a rich-text one, in which case a lot of the project would have to change. I looked up articles and some GitHub code. Analysis below.

## Drag and drop

The core of the drag-and-drop API is the `drop` event: it fires when you drag a file from the desktop into the browser and release.

We all know that if you drag an image into the browser, it just opens the image. That is the default: dragging a file into the browser opens the file. We need to block that native behavior.

First, a snippet that suppresses the default:

```js
window.addEventListener("drop", e => {
  e = e || event
  if (e.target.className === 'CodeMirror-scroll') { // if it enters the editor, prevent the default event
    e.preventDefault()
  }
}, false)
```

`CodeMirror-scroll` is the class name of the `simplemde` editor.

Now if we drag a file onto the editor and release, nothing happens. Outside the editor, the default still fires.

Next, get the `simplemde` instance and attach a `drop` handler.

```js
// assume the page has three editor windows, so we loop to bind listeners
[ this.$refs.simplemde1,
  this.$refs.simplemde2,
  this.$refs.simplemde3
].map(({simplemde}) => {
  simplemde.codemirror.on('drop', (editor, e) => {
    if (!(e.dataTransfer && e.dataTransfer.files)) {
      // alert that this browser does not support this operation
      return
    }

    let dataList = e.dataTransfer.files
    let imageFiles = [] // array of file instances to upload

    // loop because several image files may be dragged at once
    for (let i = 0; i < dataList.length; i++) {
    // if not an image, warn that only dragging image files is supported
      if (dataList[i].type.indexOf('image') === -1) {
        // the continue below means: if the user drags 2 images and one document at once, the document is not uploaded while the images are uploaded as usual.
        continue
      }
      imageFiles.push(dataList[i])  // push the current file into the array first, then upload them all together after the for loop ends.
    }
    // uploadImagesFile is the method that uploads images
    // simplemde.codemirror is used to tell which editor the current image upload belongs to
    this.uploadImagesFile(simplemde.codemirror, imageFiles)
    // because the code below already exists, the default-event blocking code above is unnecessary
    e.preventDefault()
  })
})
```

At first glance it looks like a lot of code; that's the comments. Here it is without comments. Read it and form your own take:

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

## Paste

The paste API is the `paste` event. Unlike drop, paste does not need `preventDefault`. If you copy an image and press `ctrl+v` in the browser, nothing happens, so there is no need to block the default.

Code:

```js
simplemde.codemirror.on('paste', (editor, e) => { // handler triggered when pasting an image
  if (!(e.clipboardData && e.clipboardData.items)) {
    // alert that this browser does not support this operation
    return
  }
  try {
    let dataList = e.clipboardData.items
    if (dataList[0].kind === 'file' && dataList[0].getAsFile().type.indexOf('image') !== -1) {
      this.uploadImagesFile(simplemde.codemirror, [dataList[0].getAsFile()])
    }
  } catch (e) {
    // alert that only images can be pasted
  }
})
```

The `try...catch` is there because if you paste a file, `items` is empty, and the `if` below reads `dataList[0].kind`, i.e. `e.clipboardData.items[0].kind`. Accessing `kind` on a missing item throws. So we need `try...catch`.

`dataList[0].getAsFile().type.indexOf('image') !== -1` checks that what you pasted is actually an image, not something else.

The upload call inside `if` differs in `[dataList[0].getAsFile()]`. I wrap it in `[]` so the shape matches what `uploadImagesFile` expects. `dataList[0].getAsFile()` is the file instance.

## Upload

Upload is a bit more of a hassle:

```js
uploadImagesFile (simplemde, files) {
  // wrap each file instance with FormData and return an array
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

  // the server returns the format {state: Boolean, data: String}
  // when state is false, data is the returned error message
  // when state is true, data is the uploaded image's url, an absolute path relative to the site, like below:
  // /static/upload/2cfd6a50-3d30-11e8-b351-0d25ce9162a3.png
  Promise.all(requests)
    .then(this.$http.spread((...resps) => {
      for (let i = 0; i < resps.length; i++) {
        let {state, data} = resps[i].data
        if (!state) {
          // alert showing the error message in data
          continue
        }
        let url = `![](${location.origin + data})`  // assemble into markdown syntax
        let content = simplemde.getValue()
        simplemde.setValue(content + url + '\n')  // concatenate with the editor's existing content
      }
    }))
}
```

I wrapped `axios` as a Vue plugin, so `this.$http` is the instance, not axios itself.
The axios maintainers' fix is to import the `axios` package again. I don't think that is needed. Internally `axios.all` is `Promise.all`. `axios.spread` is small, so I copied it and assigned it back onto `axios`.

So the snippet above is

```js
Promise.all(requests)
  .then(this.$http.spread((...resps) => {
    // code
  })
```

Which is equivalent to

```js
axios.all(requests)
  .then(axios.spread((...resps) => {
    // code
  })
```

For this, see the official thread: [axios-all-is-not-a-function-inside-vue-component](https://forum.vuejs.org/t/axios-all-is-not-a-function-inside-vue-component/15601). You can also look at the `axios` source: [axios.js#L45-L48](https://github.com/axios/axios/blob/master/lib/axios.js#L45-L48)

I won't go further on this. Back to the topic.

When `state` is true, `data` is an absolute path on the site, e.g. `/static/upload/2cfd6a50-3d30-11e8-b351-0d25ce9162a3.png`

We need to concatenate, hence `![](${location.origin + data})`. The last two lines get the previous content and append the url.

## Wrap-up

Here is the final result:

![](/images/simplemde-realizes-some-thoughts-on-drag-and-drop-and-paste-function/drag-paste-upload.gif)

Full code: [Subject.vue#L378-L465](https://github.com/BlackHole1/Koler/blob/8e4677897fa7eb7545f3d269642e9ab6f5f44b5e/src/components/Subject/Subject.vue#L378-L465)

## References && thanks

[code from skecozo's laravel-demo](https://github.com/skecozo/laravel-demo/blob/c18efbffaaef59ded6180c0201de2bad0e248c4c/resources/assets/js/lib/simplemde.js)

[Lemon's article "Implementing drag-and-drop and paste image upload in simplemde"](https://www.it9g.com/post/simplemde-to-achieve-drag-and-drop,-paste-pictures-upload)

[f-loat's vue-simplemde package](https://www.npmjs.com/package/vue-simplemde)

[wescossick's simplemde package](https://www.npmjs.com/package/simplemde)
