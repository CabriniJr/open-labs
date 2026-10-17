---
title: "A Pod is not its container"
dek: "A container can restart without a Pod being replaced. A Pod can be replaced without an application being redeployed. Those two identities explain the resource tree, the restart counter and the controller's job."
handbook: kubernetes
phase: 1
lab: labs/pod-lifecycle
sources:
  - id: pod-lifecycle
    author: "Kubernetes Authors"
    year: "current"
    title: "Pod Lifecycle"
    where: "Kubernetes documentation"
    url: "https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/"
    note: "The distinction between Pod identity, container restarts, phases and display status."
  - id: resources
    author: "Kubernetes Authors"
    year: "current"
    title: "Resource Management for Pods and Containers"
    where: "Kubernetes documentation"
    url: "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/"
    note: "Requests determine placement; limits constrain resource consumption."
  - id: deployments
    author: "Kubernetes Authors"
    year: "current"
    title: "Deployments"
    where: "Kubernetes documentation"
    url: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/"
    note: "Replica counts, Pod templates and the explicitly selected Recreate strategy."
---

A restart counter goes up while the Pod's UID stays put. Delete that Pod, and its replacement has a different UID. The container and the Pod have different lifetimes. Kubernetes schedules each Pod once; a replacement is another object, even if it does the same job. [Pod lifetime](#src-pod-lifecycle)

## The owner matters

A standalone Pod has no controller responsible for replacing it. A Deployment uses ReplicaSets to maintain a desired replica count. Changing `replicas` changes that count; changing the Pod template starts a rollout. The lab explicitly selects `Recreate`, which removes old Pods before starting the new revision. It does not simulate the default RollingUpdate strategy. [Deployments](#src-deployments)

## Placement is not consumption

Requests reserve schedulable capacity. Limits constrain consumption. A low CPU limit can throttle a container; exceeding a memory limit can lead to an OOM kill. Neither setting itself scales replicas. [Resource management](#src-resources)

## Read the two status fields

`Pending` and `Running` are Pod phases. `ImagePullBackOff`, `CrashLoopBackOff` and `Terminating` are useful display statuses, not additional phases. Read the waiting or termination reason alongside the phase. [Pod status](#src-pod-lifecycle)

> [!deeper] Why can a scheduled Pod still be Pending?
>
> Binding chooses a node; it does not prove the container has started. An image-pull failure can leave a bound Pod waiting. In the lab, its node badge and reserved capacity remain while the display reports ImagePullBackOff. The reason explains more than the phase alone. [Container states](#src-pod-lifecycle)
