// Authoritative reference URL for each resource kind.
// Opens in a new tab via the "Ref" button.

const K8S = 'https://kubernetes.io/docs/reference/kubernetes-api'
const PROM = 'https://prometheus-operator.dev/docs/api-reference/api'
const ESO  = 'https://external-secrets.io/latest/api'
const ARGO = 'https://argo-cd.readthedocs.io/en/stable/operator-manual'

export const refLinks = {
  // Core
  namespaces:               `${K8S}/cluster-resources/namespace-v1/`,
  nodes:                    `${K8S}/cluster-resources/node-v1/`,
  pods:                     `${K8S}/workload-resources/pod-v1/`,
  services:                 `${K8S}/service-resources/service-v1/`,
  endpoints:                `${K8S}/service-resources/endpoints-v1/`,
  configmaps:               `${K8S}/config-and-storage-resources/config-map-v1/`,
  secrets:                  `${K8S}/config-and-storage-resources/secret-v1/`,
  events:                   `${K8S}/cluster-resources/event-v1/`,
  serviceaccounts:          `${K8S}/authentication-resources/service-account-v1/`,
  persistentvolumes:        `${K8S}/config-and-storage-resources/persistent-volume-v1/`,
  persistentvolumeclaims:   `${K8S}/config-and-storage-resources/persistent-volume-claim-v1/`,
  resourcequotas:           `${K8S}/policy-resources/resource-quota-v1/`,
  limitranges:              `${K8S}/policy-resources/limit-range-v1/`,

  // Workloads
  deployments:              `${K8S}/workload-resources/deployment-v1/`,
  replicasets:              `${K8S}/workload-resources/replica-set-v1/`,
  statefulsets:             `${K8S}/workload-resources/stateful-set-v1/`,
  daemonsets:               `${K8S}/workload-resources/daemon-set-v1/`,
  jobs:                     `${K8S}/workload-resources/job-v1/`,
  cronjobs:                 `${K8S}/workload-resources/cron-job-v1/`,
  horizontalpodautoscalers: `${K8S}/workload-resources/horizontal-pod-autoscaler-v2/`,

  // Networking
  ingresses:                `${K8S}/service-resources/ingress-v1/`,
  ingressclasses:           `${K8S}/service-resources/ingress-class-v1/`,
  networkpolicies:          `${K8S}/policy-resources/network-policy-v1/`,

  // Storage
  storageclasses:           `${K8S}/config-and-storage-resources/storage-class-v1/`,
  volumeattachments:        `${K8S}/config-and-storage-resources/volume-attachment-v1/`,

  // RBAC
  roles:                    `${K8S}/authorization-resources/role-v1/`,
  rolebindings:             `${K8S}/authorization-resources/role-binding-v1/`,
  clusterroles:             `${K8S}/authorization-resources/cluster-role-v1/`,
  clusterrolebindings:      `${K8S}/authorization-resources/cluster-role-binding-v1/`,

  // Policy
  poddisruptionbudgets:     `${K8S}/policy-resources/pod-disruption-budget-v1/`,

  // CRDs
  customresourcedefinitions: `${K8S}/extend-resources/custom-resource-definition-v1/`,

  // Argo CD
  applications:             `${ARGO}/declarative-setup/#applications`,
  appprojects:              `${ARGO}/declarative-setup/#projects`,
  applicationsets:          `${ARGO}/applicationset/`,

  // External Secrets
  externalsecrets:          `${ESO}/externalsecret/`,
  secretstores:             `${ESO}/secretstore/`,
  clustersecretstores:      `${ESO}/clustersecretstore/`,
  clusterexternalsecrets:   `${ESO}/clusterexternalsecret/`,

  // Monitoring
  servicemonitors:          `${PROM}/#monitoring.coreos.com/v1.ServiceMonitor`,
  prometheusrules:          `${PROM}/#monitoring.coreos.com/v1.PrometheusRule`,
  podmonitors:              `${PROM}/#monitoring.coreos.com/v1.PodMonitor`,
  probes:                   `${PROM}/#monitoring.coreos.com/v1.Probe`,
  alertmanagers:            `${PROM}/#monitoring.coreos.com/v1.Alertmanager`,
  prometheuses:             `${PROM}/#monitoring.coreos.com/v1.Prometheus`,
}
