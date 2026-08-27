---
title: 基于任务量进行 k8s 集群的灵活调度处理
description: 基于任务量进行 k8s 集群的灵活调度处理，以达到节省资源的目的
date: 2019-08-20T14:55:19+08:00
tags:
  - k8s
  - golang
translationKey: flexible-scheduling-of-k8s-cluster-based-on-task-volume
aliases:
  - /zh/p/k8s-automatic-expansion-by-data/
  - /zh/p/flexible-scheduling-of-k8s-cluster-based-on-task-volume/
  - /zh/posts/基于任务量进行k8s集群的灵活调度处理/
---

## 前言 {#intro}

最近公司内有个需求是为了进一步控制某个项目的 k8s 集群的资源，避免资源浪费。

目前项目需要的资源占用率很高，需要 3 核 CPU、2G 内存。在一开始的时候是没有做灵活调度处理的。会让 `Pod` 一直处于运行状态，即使没有任务的时候也会一直运行，虽然说可以通过 `k8s` 下 `Resources` 的 `Requests` 和 `Limits` 减少一点资源，但是还是会照成一定资源的浪费。

## 介绍 {#workflow}

在正文开始前，需要把流程介绍一下，方便后文的理解。

首先别的部门会往数据库里插入一条数据，然后在由调度器去定期的扫数据库，扫到一个新数据，则由调度器去调用 k8s 的 api 去创建一个 `Job` 资源，在 Job 里有一个 `Pod`，由 `Pod` 去做一些任务。然后结束。

看起来比较简单，但是有几个需要注意的地方:

1. 由于 `Pod` 是需要环境变量的，而 `Pod` 是由调度器去创建的。那么这个时候就需要把变量一步步传进去
2. 调度器不能去更改任何的数据，只能从数据库里拿，这是为了更好的解耦。不能让调度器去关心任何的业务逻辑及数据
3. 调度器的本身不能存有任何的状态，因为一旦涉及到状态，就要去有个地方去存储它。因为要考虑到调度器本身重启。这样做只会带来更大的负担。
4. 需要考虑当前的集群是否有资源再启动 `Pod` 了

## 开始 {#implementation}

调度器使用了 `GoLang` 进行开发，所以后文都将使用 `Go` 做为主力语言。

### 创建一个可调试的 k8s 环境 {#debug-env}

目前因为使用的是 `Go` 进行开发，所以使用了 k8s 官方的 `client-go` 这个库。而这个库本身就提供了一些创建 `clientset` 的方法[^clientset]

```go
package main

import (
  "fmt"

  "k8s.io/client-go/kubernetes"
  "k8s.io/client-go/rest"
  "k8s.io/client-go/tools/clientcmd"
)

func main() {
  // 这个方法里包含了 k8s 自身对 Cluster 的配置操作
  kubeConfig, err := rest.InClusterConfig()

  if err != nil {
    // 如果是开发环境，则使用当前 minikube。需要配置 KUBECONFIG 变量
    // 如果是 minikube，KUBECONFIG 变量可以指向 $HOME/.kube/config
    kubeConfig, err = clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
      clientcmd.NewDefaultClientConfigLoadingRules(),
      &clientcmd.ConfigOverrides{}).ClientConfig()

    // 如果没有配置 KUBECONFIG 变量，且当前也没有在集群里运行
    if err != nil {
      panic("get k8s config fail: " + err.Error())
    }
  }

  // 创建 clientset 失败
  clientset, err := kubernetes.NewForConfig(kubeConfig)
  if err != nil {
    panic("failed to create k8s clientset: " + err.Error())
  }

  // 创建成功
  fmt.Println(clientset)
}
```

其中 `rest.InClusterConfig()` 代码也十分简单，就是去当前机器下的 `/var/run/secrets/kubernetes.io/serviceaccount/` 读取 `token` 和 `ca`。以及读取 `KUBERNETES_SERVICE_HOST` 和 `KUBERNETES_SERVICE_PORT` 环境变量，再把他们拼在一起，感兴趣的同学可以去看下[源码](https://github.com/kubernetes/client-go/blob/40d852a94d979475341d3624f7a2de00730ea68e/rest/config.go#L403-L433)。

根据上文可以知道 `rest.InClusterConfig()` 是针对以及身在集群中的机器而言的。在本地开发环境是肯定不行的。所以我们需要另一个方法去解决这个问题。

可以看到上面我已经做了处理，当发现 `InClusterConfig` 失败后，会转而执行下面的代码:

```go
kubeConfig, err = clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
  clientcmd.NewDefaultClientConfigLoadingRules(),
  &clientcmd.ConfigOverrides{}).ClientConfig()
```

这段代码其实也比较简单，就是去读取当前环境下的 `KUBECONFIG` 获取本地 k8s 的配置路径。如果没有这个变量，再去获取当前用户目录下的 `.kube/config` 文件。最终根据文件改造成所需要的配置。主要源码可见: [NewDefaultClientConfigLoadingRules](https://github.com/kubernetes/client-go/blob/40d852a94d/tools/clientcmd/loader.go#L141-L161)、[ClientConfig](https://github.com/kubernetes/client-go/blob/40d852a94d/tools/clientcmd/client_config.go#L477-L503)

现在只要保证你本机有 `minikube` 环境就可以正常调试、开发了。[^rook]

### 创建 Job 及 Pod {#create-job-pod}

数据库查询的这里就不再阐述了，可以根据自身的业务进行适配、开发。这里只是起到一个抛砖引玉的效果。不止是数据库，其他任何东西都可以，主要还是要看自身的业务适合什么。

我们先假设，这里从数据库里拿到了一条数据，我们需要把数据库的值传给 Pod。避免 Pod 里再做一次查询。现在我们需要先把 Job 定义好:

```go
import (
  batchv1 "k8s.io/api/batch/v1"
  apiv1 "k8s.io/api/core/v1"
  "k8s.io/apimachinery/pkg/api/resource"
  metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// job 所需配置
type JobsSpec struct {
  Namespace string
  Image     string
  Prefix    string
}

// 返回指定的 cpu、memory 资源值
// 写法参考 k8s 见: https://github.com/kubernetes/kubernetes/blob/b3875556b0edf3b5eaea32c69678edcf4117d316/pkg/kubelet/cm/helpers_linux_test.go#L36-L53
func getResourceList(cpu, memory string) apiv1.ResourceList {
  res := apiv1.ResourceList{}
  if cpu != "" {
    res[apiv1.ResourceCPU] = resource.MustParse(cpu)
  }
  if memory != "" {
    res[apiv1.ResourceMemory] = resource.MustParse(memory)
  }
  return res
}

// 返回 ResourceRequirements 对象，详细见 getResourceList 函数注释
func getResourceRequirements(requests, limits apiv1.ResourceList) apiv1.ResourceRequirements {
  res := apiv1.ResourceRequirements{}
  res.Requests = requests
  res.Limits = limits
  return res
}

// 转为指针
func newInt64(i int64) *int64 {
  return &i
}

// 创建 job 的配置
// 返回指定的 cpu、memory 资源值
// 写法参考 k8s 见: https://github.com/kubernetes/kubernetes/blob/b3875556b0edf3b5eaea32c69678edcf4117d316/pkg/kubelet/cm/helpers_linux_test.go#L36-L53
func getResourceList(cpu, memory string) apiv1.ResourceList {
  res := apiv1.ResourceList{}
  if cpu != "" {
    res[apiv1.ResourceCPU] = resource.MustParse(cpu)
  }
  if memory != "" {
    res[apiv1.ResourceMemory] = resource.MustParse(memory)
  }
  return res
}

// 返回 ResourceRequirements 对象，详细见 getResourceList 函数注释
func getResourceRequirements(requests, limits apiv1.ResourceList) apiv1.ResourceRequirements {
  res := apiv1.ResourceRequirements{}
  res.Requests = requests
  res.Limits = limits
  return res
}

// job 所需配置
type jobsSpec struct {
  Namespace string
  Image     string
  Prefix    string
}

// 创建 job 的配置
func (j *jobsSpec) Create(envMap map[string]string) *batchv1.Job {
  u2 := uuid.NewV4().String()[:8]
  name := fmt.Sprint(j.Prefix, "-", u2)

  return &batchv1.Job{
    ObjectMeta: metav1.ObjectMeta{
      Name:      name,
      Namespace: j.Namespace,
    },
    Spec: batchv1.JobSpec{
      Template: apiv1.PodTemplateSpec{
        Spec: apiv1.PodSpec{
          RestartPolicy: "Never",
          Containers: []apiv1.Container{
            {
              Name:            name,
              Image:           j.Image,
              Env:             EnvToVars(envMap),
              ImagePullPolicy: "Always",
              Resources:       getResourceRequirements(getResourceList("2500m", "2048Mi"), getResourceList("3000m", "2048Mi")),
            },
          },
        },
      },
    },
  }
}
```

这里没什么好说的，基本就是资源定义，以及上门还有注释。

上面的代码其实少了一部分，这部分是把变量注入进去的。也就是 `EnvToVars`，核心代码如下:

```go
// 把对象转化成 k8s 所能接受的环境变量格式
func EnvToVars(envMap map[string]string) []v1.EnvVar {
  var envVars []v1.EnvVar
  for k, v := range envMap {
    envVar := v1.EnvVar{
      Name:  k,
      Value: v,
    }
    envVars = append(envVars, envVar)
  }
  return envVars
}

// 获取当前系统中所有的变量，并转成 map 方式
func GetAllEnvToMap() map[string]string {
  item := make(map[string]string)
  for _, k := range os.Environ() {
    splits := strings.Split(k, "=")
    item[splits[0]] = splits[1]
  }

  return item
}

// 合并两个 map，为了更好的性能，使用闭包的方式，这样 sourceMap 只需要调用一次即可
func MergeMap(sourceMap map[string]string) func(insertMap map[string]string) map[string]string {
  return func(insertMap map[string]string) map[string]string {
    for k, v := range insertMap {
      sourceMap[k] = v
    }

    return sourceMap
  }
}
```

然后在使用的时候就是这样了:

```go
job := jobsSpec{
  Prefix:    "project-" + "dev" + "-job",
  Image:     "docker image name",
  Namespace: "default",
}

willMergeMap := MergeMap(GetAllEnvToMap())

// dbData 是从数据库里拿到的数据，格式大致如下
// [ { id: 1, url: 'xxx' }, { id: 2, url: 'yyy' } ]
for _, data := range dbData {
  currentEnvMap := willMergeMap(data)

  // 创建 Job
  _, err = api.CreateJob(currentEnvMap)

  if err != nil {
    panic("create job fail", err.Error())
  }
}
```

这样一来，就实现了把当前环境变量及数据通过变量的方式传给 `Pod`。这样的话，只需要保证当前的调度器里存在一些 `Pod` 可能会用到的变量就行了，如: `S3 Token`、`DB Host` 等。通过这种方式，`Pod` 基本上什么都不用关系，它所需要的变量，会由调度器传给它，分工明确。

### 优化 {#optimization}

其实以上其实就已经完成了最核心的东西，本身也不是特别的难。很简单的逻辑。只不过光有这些是不够的，还有很多地方需要考虑。

#### 资源判断 {#resource-check}

这里在说之前有个前提，之前说过这个调度器是不能去更改任何数据的，更改数据只能由 `Pod` 里的容器去更改。

那么这个时候就有问题了。

集群如果资源不够分配的话，那 `Pod` 将会一直处于 `Pending` 状态，根据上文，变量已经注入到 Pod 里了，而且由于里面的容器没有启动。那就会导致数据没有更改，而没有更改的数据，调度器就会一直认为他的新的。导致会为这条数据再启动一个 Job，一直循环到当集群资源足够后其中的一个 Pod 去更改了数据。

举个例子，假设数据库里有一个 `status` 的字段，当值为 `wating` 时，调度器就认为这是一条新数据，会把这个数据转变成环境变量注入到 Pod 里，再由 Pod 去把 `waiting` 更改成 `process`。调度器每 3 分钟去扫一次数据，所以 Pod 必须在 3 分钟内把数据更改完毕。

而这时由于资源不够，k8s 创建了这个 Pod，但是里面的代码没有运行，导致没有去更改数据，就会导致调度器一直去为同一条数据创建 Pod。

解决方案也比较简单，只要去判断下 Pod 的状态是否为 `Pending`，如果是，则不再创建 Pod。下面是核心代码:

```go
func HavePendingPod() (bool, error) {
  // 获取当前 namespace 下所有的 pod
  pods, err := clientset.CoreV1().Pods(Namespace).List(metaV1.ListOptions{})
  if err != nil {
    return false, err
  }

  // 循环 pod，判断每个 pod 是否符合当前的前缀，如果符合，则说明当前的环境已经存在 Pending 状态了
  for _, v := range pods.Items {
    phase := v.Status.Phase
    if phase == "Pending" {
      if strings.HasPrefix(v.Name, Prefix) {
        return true, nil
      }
    }
  }

  return false, nil
}
```

当为 `true` 时，就不再创建 `Job`

#### Job 数量最大值 {#max-jobs}

集群的资源也不是无限的，虽然我们对 `Pending` 情况做了处理，但是这只是一种防御手段。我们还是要对数量进行一个管控，当 Job 数量等于某个值时，不在创建 Job 了。代码也很简单，我这里就把获取当前环境下 Job 数量的代码放出来:

```go
// 获取当前 namespace 下同环境的 job Item 实例
func GetJobListByNS() ([]v1.Job, error) {
  var jobList, err = clientset.BatchV1().Jobs(Namespace).List(metaV1.ListOptions{})
    if err != nil {
    return nil, err
  }

  // 过滤非同前缀的 Job
  var item []v1.Job
  for _, v := range jobList.Items {
    if strings.HasPrefix(v.Name, Prefix) {
      item = append(item, v)
    }
  }

  return item, nil
}

func GetJobLenByNS() (int, error) {
  jobItem, err := api.GetJobListByNS()
  if err != nil {
      return 最大值, err
  }

  return len(jobItem), nil
}
```

#### 删除已完成和失败的 {#delete-finished-jobs}

上面的代码其实是有问题的，k8s 的 `Job` 资源类型是有一个特性是，当完成或者失败的时候，并不会删除自身，也就说即使他完成了，它的数据还会一直停留在那。所以上面的代码会把一些已经完成或者失败的 Job 也统计进去。到最后会出现一直无法创建 Job 的窘迫。

解决方案有两个，第一个是在声明 `Job` 资源时，添加 `spec.ttlSecondsAfterFinished` 属性来做到 k8s 自动回收完成、失败的 Job。可惜的是这是高版本才有的属性，我司很遗憾是低版本的。那就只能用第二种方法了，就是在每次获取数量前，调用 api 把完成、失败的 Job 删除:

```go
func DeleteCompleteJob() error {
  jobItem, err := GetJobListByNS()
  if err != nil {
    return err
  }

  // 如果不指定此属性，删除 job 时，不会删除 pod
  propagationPolicy := metaV1.DeletePropagationForeground
  for _, v := range jobItem {
    // 只删除已经结束的 job
    if v.Status.Failed == 1 || v.Status.Succeeded == 1 {
      err := clientset.BatchV1().Jobs(Namespace).Delete(v.Name, &metaV1.DeleteOptions{
        PropagationPolicy: &propagationPolicy,
      })

      if err != nil {
        return err
      }
    }
  }

  return nil
}
```

### 结尾 {#conclusion}

整个调度器的代码比较简单，没有必要专门抽成一个库来做。只要知道大概的思路，就可以根据自己的项目需求做出适合自己项目组的调度器。

感谢我司大佬 [@qqshfox](https://github.com/qqshfox) 提供的思路

[^clientset]: 可以把 `clientset` 理解成一个可以和当前集群 master 通信的管道。

[^rook]: 以上的方法参考 [rook](https://github.com/rook/rook/blob/823018b1c8c1475fa2a1433aae3c99382c4269cf/cmd/rook/rook/rook.go#L95-L160) 的写法。
