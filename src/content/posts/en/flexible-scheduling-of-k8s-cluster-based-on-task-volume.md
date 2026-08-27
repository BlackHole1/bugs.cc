---
title: Flexible scheduling of a k8s cluster based on task volume
description: Flexible scheduling of a k8s cluster based on task volume, to save resources
date: 2019-08-20T14:55:19+08:00
tags:
  - k8s
  - golang
translationKey: flexible-scheduling-of-k8s-cluster-based-on-task-volume
---

## Intro

We recently needed to further control k8s cluster resources for a project, to avoid waste.

The project needs a lot of resources: 3 CPU cores and 2G of memory. At first there was no flexible scheduling. The `Pod` stayed running even when there was no work. `Requests` and `Limits` under k8s `Resources` can cut some of that, but you still waste some resources.

## Workflow

Before the main text, a quick walk through the flow, so the rest makes sense.

Another team inserts a row into the database. A scheduler periodically scans the database. When it sees a new row, it calls the k8s API to create a `Job`. The Job has a `Pod`, and the `Pod` does the work, then exits.

Simple on the surface, but a few things matter:

1. The `Pod` needs environment variables, and the `Pod` is created by the scheduler, so those values have to be passed through
2. The scheduler must not change any data. It only reads from the database. That is for decoupling. The scheduler should not care about business logic or data
3. The scheduler itself must not hold any state. Once you have state, you need somewhere to store it, including across scheduler restarts. That only adds burden.
4. You need to consider whether the cluster still has resources to start another `Pod`

## Implementation

The scheduler is written in `GoLang`, so the rest uses `Go`.

### Set up a debuggable k8s environment

Because this is `Go`, I used the official k8s `client-go` library. The library already has helpers for creating a `clientset`.[^clientset]

```go
package main

import (
  "fmt"

  "k8s.io/client-go/kubernetes"
  "k8s.io/client-go/rest"
  "k8s.io/client-go/tools/clientcmd"
)

func main() {
  // this method contains k8s's own configuration operations for the Cluster
  kubeConfig, err := rest.InClusterConfig()

  if err != nil {
    // in a dev environment, use the current minikube. The KUBECONFIG variable must be set
    // for minikube, KUBECONFIG can point to $HOME/.kube/config
    kubeConfig, err = clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
      clientcmd.NewDefaultClientConfigLoadingRules(),
      &clientcmd.ConfigOverrides{}).ClientConfig()

    // KUBECONFIG is not set, and we are not running inside a cluster either
    if err != nil {
      panic("get k8s config fail: " + err.Error())
    }
  }

  // failed to create clientset
  clientset, err := kubernetes.NewForConfig(kubeConfig)
  if err != nil {
    panic("failed to create k8s clientset: " + err.Error())
  }

  // created successfully
  fmt.Println(clientset)
}
```

`rest.InClusterConfig()` is also simple: it reads `token` and `ca` from `/var/run/secrets/kubernetes.io/serviceaccount/` on the current machine, plus `KUBERNETES_SERVICE_HOST` and `KUBERNETES_SERVICE_PORT`, then joins them. If you are curious, see the [source](https://github.com/kubernetes/client-go/blob/40d852a94d979475341d3624f7a2de00730ea68e/rest/config.go#L403-L433).

From the above, `rest.InClusterConfig()` is for a machine that is already in the cluster. That will not work in a local dev environment, so we need another path.

I already handled that above. When `InClusterConfig` fails, it falls through to:

```go
kubeConfig, err = clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
  clientcmd.NewDefaultClientConfigLoadingRules(),
  &clientcmd.ConfigOverrides{}).ClientConfig()
```

This is also simple: read `KUBECONFIG` from the environment for the local k8s config path. If that variable is missing, use `.kube/config` in the current user's home. Then turn that file into the config we need. Main source: [NewDefaultClientConfigLoadingRules](https://github.com/kubernetes/client-go/blob/40d852a94d/tools/clientcmd/loader.go#L141-L161), [ClientConfig](https://github.com/kubernetes/client-go/blob/40d852a94d/tools/clientcmd/client_config.go#L477-L503)

As long as you have a local `minikube`, you can debug and develop.[^rook]

### Create Job and Pod

I will not go into the database query. Adapt it to your own business. This is only a starting point. It does not have to be a database. Anything works; it depends on what fits the business.

Assume we got a row from the database and need to pass those values into the Pod, so the Pod does not query again. First define the Job:

```go
import (
  batchv1 "k8s.io/api/batch/v1"
  apiv1 "k8s.io/api/core/v1"
  "k8s.io/apimachinery/pkg/api/resource"
  metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// config required by the job
type JobsSpec struct {
  Namespace string
  Image     string
  Prefix    string
}

// returns the specified cpu and memory resource values
// style follows k8s, see: https://github.com/kubernetes/kubernetes/blob/b3875556b0edf3b5eaea32c69678edcf4117d316/pkg/kubelet/cm/helpers_linux_test.go#L36-L53
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

// returns a ResourceRequirements object; see the getResourceList comment for details
func getResourceRequirements(requests, limits apiv1.ResourceList) apiv1.ResourceRequirements {
  res := apiv1.ResourceRequirements{}
  res.Requests = requests
  res.Limits = limits
  return res
}

// convert to pointer
func newInt64(i int64) *int64 {
  return &i
}

// config for creating the job
// returns the specified cpu and memory resource values
// style follows k8s, see: https://github.com/kubernetes/kubernetes/blob/b3875556b0edf3b5eaea32c69678edcf4117d316/pkg/kubelet/cm/helpers_linux_test.go#L36-L53
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

// returns a ResourceRequirements object; see the getResourceList comment for details
func getResourceRequirements(requests, limits apiv1.ResourceList) apiv1.ResourceRequirements {
  res := apiv1.ResourceRequirements{}
  res.Requests = requests
  res.Limits = limits
  return res
}

// config required by the job
type jobsSpec struct {
  Namespace string
  Image     string
  Prefix    string
}

// config for creating the job
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

Not much to say here. It is mostly resource definitions, and there are comments above.

The code above is missing a piece: injecting variables. That is `EnvToVars`. Core code:

```go
// convert an object into the environment variable format k8s accepts
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

// get all variables of the current system and convert them into a map
func GetAllEnvToMap() map[string]string {
  item := make(map[string]string)
  for _, k := range os.Environ() {
    splits := strings.Split(k, "=")
    item[splits[0]] = splits[1]
  }

  return item
}

// merge two maps; use a closure for better performance, so sourceMap only needs to be passed once
func MergeMap(sourceMap map[string]string) func(insertMap map[string]string) map[string]string {
  return func(insertMap map[string]string) map[string]string {
    for k, v := range insertMap {
      sourceMap[k] = v
    }

    return sourceMap
  }
}
```

Usage:

```go
job := jobsSpec{
  Prefix:    "project-" + "dev" + "-job",
  Image:     "docker image name",
  Namespace: "default",
}

willMergeMap := MergeMap(GetAllEnvToMap())

// dbData is the data fetched from the database, roughly in this format
// [ { id: 1, url: 'xxx' }, { id: 2, url: 'yyy' } ]
for _, data := range dbData {
  currentEnvMap := willMergeMap(data)

  // create the Job
  _, err = api.CreateJob(currentEnvMap)

  if err != nil {
    panic("create job fail", err.Error())
  }
}
```

That passes the current environment and the row into the `Pod` as variables. You only need to make sure the scheduler has whatever the `Pod` might need, such as `S3 Token` and `DB Host`. This way the `Pod` does not have to care. The variables it needs come from the scheduler. Clear split of work.

### Optimization

The above already covers the core. The logic is not hard. It is not enough on its own. There is more to consider.

#### Resource checks

One premise first: the scheduler must not change any data. Only the container in the `Pod` may change data.

That creates a problem.

If the cluster cannot allocate resources, the `Pod` stays `Pending`. Variables are already injected, and because the container never starts, the data is never updated. The scheduler keeps treating the row as new, and starts another Job for it, looping until the cluster has enough resources and one Pod updates the data.

Example: the database has a `status` field. When the value is `wating`, the scheduler treats it as new, injects it as environment variables into the Pod, and the Pod changes `waiting` to `process`. The scheduler scans every 3 minutes, so the Pod must update the row within 3 minutes.

If resources are short, k8s creates the Pod but the code inside never runs, so the data is never updated, and the scheduler keeps creating Pods for the same row.

The fix is simple: check whether any Pod is `Pending`. If so, do not create more. Core code:

```go
func HavePendingPod() (bool, error) {
  // get all pods in the current namespace
  pods, err := clientset.CoreV1().Pods(Namespace).List(metaV1.ListOptions{})
  if err != nil {
    return false, err
  }

  // loop over the pods and check whether each one matches the current prefix; if so, this environment already has a Pending pod
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

When this is `true`, do not create a `Job`.

#### Max Job count

Cluster resources are not infinite. We handled `Pending`, but that is only a defense. We still need a cap: when the Job count hits a value, stop creating Jobs. The code is simple. Here is how to get the Job count in the current environment:

```go
// get the job Item instances of the same environment in the current namespace
func GetJobListByNS() ([]v1.Job, error) {
  var jobList, err = clientset.BatchV1().Jobs(Namespace).List(metaV1.ListOptions{})
    if err != nil {
    return nil, err
  }

  // filter out Jobs that do not share the prefix
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
      return maxValue, err
  }

  return len(jobItem), nil
}
```

#### Delete completed and failed Jobs

The code above is wrong in one way. A k8s `Job` does not delete itself when it succeeds or fails. Even after it finishes, the object stays. So the code above also counts completed and failed Jobs. Eventually you cannot create any more Jobs.

Two fixes. First, set `spec.ttlSecondsAfterFinished` on the `Job` so k8s garbage-collects finished and failed Jobs. That field only exists on newer versions, and we were on an old one. So the second approach: before counting, call the API to delete completed and failed Jobs:

```go
func DeleteCompleteJob() error {
  jobItem, err := GetJobListByNS()
  if err != nil {
    return err
  }

  // without this property, deleting a job does not delete its pods
  propagationPolicy := metaV1.DeletePropagationForeground
  for _, v := range jobItem {
    // only delete jobs that have already finished
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

### Conclusion

The scheduler is simple. There is no need to extract it into a library. Once you have the idea, you can build a scheduler that fits your project.

Thanks to [@qqshfox](https://github.com/qqshfox) for the idea.

[^clientset]: Think of `clientset` as a pipe to the cluster master.

[^rook]: The approach above follows [rook](https://github.com/rook/rook/blob/823018b1c8c1475fa2a1433aae3c99382c4269cf/cmd/rook/rook/rook.go#L95-L160).
