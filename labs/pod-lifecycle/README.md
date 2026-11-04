# Pod lifecycle — the real counterpart

This lab teaches three separate mechanisms: reconciliation creates replacements,
scheduling binds a Pod once, and the kubelet can restart its container without
replacing its UID. The visual experiment runs locally; these files run against
the real Kubernetes API. Use a disposable cluster and a kubectl context you own.

## Files

- [deployment.yaml](./deployment.yaml): two replicas, one nginx container, explicit
  requests and limits, Recreate strategy, two-second termination grace.
- [pod.yaml](./pod.yaml): the same container without a controller.

Both files are checked against the initial manifests in the visual lab. This
checks input identity, not behavioral fidelity against a live cluster.

## Observe ownership and replacement

```bash
kubectl apply -f deployment.yaml
kubectl rollout status deployment/checkout --timeout=90s
kubectl get deployment,replicaset,pods -l app=checkout -o wide
kubectl get pods -l app=checkout -o custom-columns=NAME:.metadata.name,UID:.metadata.uid,NODE:.spec.nodeName,RESTARTS:.status.containerStatuses[0].restartCount
kubectl scale deployment checkout --replicas=6
kubectl get pods -l app=checkout -w
```

Delete one Pod by the name you just observed. A new UID appears because a
ReplicaSet owns the desired replicas. Inspect the node reservations with
`kubectl describe nodes`; they are based on requests, not measured CPU use.

Restore the declared state with `kubectl apply -f deployment.yaml`. Change the
image in the Pod template to a nonexistent tag and apply: assigned Pods can
remain Pending with ImagePullBackOff. Restore the valid image afterward.

## Remove the owner

First remove the Deployment, then create the standalone Pod (the manifests use
the same name deliberately):

```bash
kubectl delete -f deployment.yaml --wait=true
kubectl apply -f pod.yaml
kubectl get pod checkout -w
```

Delete `pod/checkout`. No ReplicaSet creates a replacement. Applying `pod.yaml`
again creates another Pod with another UID.

## Compare honestly

The UI uses two fixed nodes of 2000m CPU and 2048 Mi memory and deterministic
first-fit placement. Your cluster need not have those capacities, and the real
scheduler has more constraints. A 3000m request fits neither simulated node;
the corresponding real request must exceed **each** real node's allocatable
CPU to reproduce that rejection. Total cluster capacity is not enough.

The synthetic 192 Mi working set in the UI is **not an nginx measurement**.
Changing its memory limit demonstrates an OOM rule, not nginx's exact workload.
The UI shortens restart backoff and uses a fixed two-step startup. It does not
model probes, node pressure, HPA, networking, storage or the Linux kernel.
No live-cluster conformance run is claimed by this POC. An attempt with kind
v0.27.0 / Kubernetes v1.32.2 on 2026-10-16 was blocked before the API server
started: the nested node's kubelet could not open `/dev/kmsg` in this execution
environment. It has to be performed on a disposable cluster before promoting
these examples to verified material.

Cleanup: `kubectl delete -f pod.yaml --ignore-not-found`, and likewise for the
Deployment if it remains.

## Sources

- [Pod lifetime, phases and restart policy](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [Requests, limits and placement](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Deployment strategy](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#strategy)

Checked against official documentation on 2026-10-16. Manifest APIs: `v1/Pod`
and `apps/v1/Deployment`. Cluster behavior remains unverified in this workspace.
