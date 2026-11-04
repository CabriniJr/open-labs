/** Manifestos nativos, também conferidos contra os arquivos da contraparte real. */
export const DEPLOYMENT_MANIFEST = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout
  namespace: default
spec:
  replicas: 2
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: checkout
  template:
    metadata:
      labels:
        app: checkout
    spec:
      terminationGracePeriodSeconds: 2
      containers:
        - name: web
          image: nginx:1.27
          resources:
            requests:
              cpu: 500m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 512Mi
`;

export const POD_MANIFEST = `apiVersion: v1
kind: Pod
metadata:
  name: checkout
  namespace: default
spec:
  restartPolicy: Always
  terminationGracePeriodSeconds: 2
  containers:
    - name: web
      image: nginx:1.27
      resources:
        requests:
          cpu: 500m
          memory: 256Mi
        limits:
          cpu: 1000m
          memory: 512Mi
`;

export const EXPERIMENTS = [
  { id: "healthy", title: "Healthy deployment", hint: "Two replicas, one declared owner.", manifest: DEPLOYMENT_MANIFEST },
  { id: "scale", title: "Scale to six", hint: "The controller creates; the scheduler places.", manifest: DEPLOYMENT_MANIFEST.replace("replicas: 2", "replicas: 6") },
  { id: "pending", title: "A request that cannot fit", hint: "3000m cannot fit on either 2000m node.", manifest: DEPLOYMENT_MANIFEST.replace("cpu: 500m", "cpu: 3000m").replace("cpu: 1000m", "cpu: 4000m") },
  { id: "image", title: "Image pull fails", hint: "A scheduled Pod can still be Pending.", manifest: DEPLOYMENT_MANIFEST.replace("nginx:1.27", "nginx:missing") },
  { id: "oom", title: "Memory limit exceeded", hint: "192 Mi of synthetic demand does not fit a 128Mi limit.", manifest: DEPLOYMENT_MANIFEST.replace("memory: 256Mi", "memory: 64Mi").replace("memory: 512Mi", "memory: 128Mi") },
  { id: "pod", title: "A Pod without a controller", hint: "Delete it. Nobody is responsible for replacing it.", manifest: POD_MANIFEST },
] as const;
