// Resource groups and kinds shown in the sidebar.
// The `kind` value must match a key in the Go registry map.

export const resourceGroups = [
  {
    label: 'Core',
    items: [
      { label: 'Namespaces',               kind: 'namespaces' },
      { label: 'Nodes',                    kind: 'nodes' },
      { label: 'Pods',                     kind: 'pods' },
      { label: 'Services',                 kind: 'services' },
      { label: 'Endpoints',                kind: 'endpoints' },
      { label: 'ConfigMaps',               kind: 'configmaps' },
      { label: 'Secrets',                  kind: 'secrets' },
      { label: 'Events',                   kind: 'events' },
      { label: 'Service Accounts',         kind: 'serviceaccounts' },
      { label: 'Persistent Volumes',       kind: 'persistentvolumes' },
      { label: 'Persistent Volume Claims', kind: 'persistentvolumeclaims' },
      { label: 'Resource Quotas',          kind: 'resourcequotas' },
      { label: 'Limit Ranges',             kind: 'limitranges' },
    ],
  },
  {
    label: 'Workloads',
    items: [
      { label: 'Deployments',                  kind: 'deployments' },
      { label: 'Replica Sets',                 kind: 'replicasets' },
      { label: 'Stateful Sets',                kind: 'statefulsets' },
      { label: 'Daemon Sets',                  kind: 'daemonsets' },
      { label: 'Jobs',                         kind: 'jobs' },
      { label: 'Cron Jobs',                    kind: 'cronjobs' },
      { label: 'Horiz. Pod Autoscalers',       kind: 'horizontalpodautoscalers' },
    ],
  },
  {
    label: 'Networking',
    items: [
      { label: 'Ingresses',        kind: 'ingresses' },
      { label: 'Ingress Classes',  kind: 'ingressclasses' },
      { label: 'Network Policies', kind: 'networkpolicies' },
    ],
  },
  {
    label: 'Storage',
    items: [
      { label: 'Storage Classes',    kind: 'storageclasses' },
      { label: 'Volume Attachments', kind: 'volumeattachments' },
    ],
  },
  {
    label: 'RBAC',
    items: [
      { label: 'Roles',                kind: 'roles' },
      { label: 'Role Bindings',        kind: 'rolebindings' },
      { label: 'Cluster Roles',        kind: 'clusterroles' },
      { label: 'Cluster Role Bindings',kind: 'clusterrolebindings' },
    ],
  },
  {
    label: 'Policy',
    items: [
      { label: 'Pod Disruption Budgets', kind: 'poddisruptionbudgets' },
    ],
  },
  {
    label: 'CRDs',
    items: [
      { label: 'Custom Resource Defs', kind: 'customresourcedefinitions' },
    ],
  },
  {
    label: 'Argo CD',
    items: [
      { label: 'Applications',    kind: 'applications' },
      { label: 'App Projects',    kind: 'appprojects' },
      { label: 'Application Sets', kind: 'applicationsets' },
    ],
  },
  {
    label: 'External Secrets',
    items: [
      { label: 'External Secrets',         kind: 'externalsecrets' },
      { label: 'Secret Stores',            kind: 'secretstores' },
      { label: 'Cluster Secret Stores',    kind: 'clustersecretstores' },
      { label: 'Cluster External Secrets', kind: 'clusterexternalsecrets' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { label: 'Service Monitors', kind: 'servicemonitors' },
      { label: 'Prometheus Rules', kind: 'prometheusrules' },
      { label: 'Pod Monitors',     kind: 'podmonitors' },
      { label: 'Probes',           kind: 'probes' },
      { label: 'Alert Managers',   kind: 'alertmanagers' },
      { label: 'Prometheuses',     kind: 'prometheuses' },
    ],
  },
]
