package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"strings"
	"time"
)

// ── Response types ────────────────────────────────────────────────────────────

type resourceResponse struct {
	Namespaced bool          `json:"namespaced"`
	Rows       []resourceRow `json:"rows"`
	Command    string        `json:"command"`
}

type resourceRow struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace,omitempty"`
	Status    string `json:"status,omitempty"`
	Age       string `json:"age"`
}

type topResponse struct {
	Namespaced bool     `json:"namespaced"`
	Rows       []topRow `json:"rows"`
	Command    string   `json:"command"`
}

type topRow struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace,omitempty"`
	CPU       string `json:"cpu"`
	Memory    string `json:"memory"`
}

// ── Resource registry ─────────────────────────────────────────────────────────

type resourceDef struct {
	kubectlName string
	namespaced  bool
	statusFn    func(item map[string]interface{}) string
}

var registry = map[string]resourceDef{
	// Core
	"namespaces": {
		kubectlName: "namespaces",
		statusFn:    func(i map[string]interface{}) string { return gStr(i, "status", "phase") },
	},
	"nodes": {
		kubectlName: "nodes",
		statusFn: func(i map[string]interface{}) string {
			for _, c := range gSlice(i, "status", "conditions") {
				cm, _ := c.(map[string]interface{})
				if gStrD(cm, "type") == "Ready" {
					if gStrD(cm, "status") == "True" {
						return "Ready"
					}
					return "NotReady"
				}
			}
			return "Unknown"
		},
	},
	"pods": {
		kubectlName: "pods",
		namespaced:  true,
		statusFn:    func(i map[string]interface{}) string { return gStr(i, "status", "phase") },
	},
	"services": {
		kubectlName: "services",
		namespaced:  true,
		statusFn:    func(i map[string]interface{}) string { return gStr(i, "spec", "type") },
	},
	"endpoints": {
		kubectlName: "endpoints",
		namespaced:  true,
		statusFn:    func(i map[string]interface{}) string { return "" },
	},
	"configmaps": {
		kubectlName: "configmaps",
		namespaced:  true,
		statusFn:    func(i map[string]interface{}) string { return "" },
	},
	"secrets": {
		kubectlName: "secrets",
		namespaced:  true,
		statusFn:    func(i map[string]interface{}) string { return gStr(i, "type") },
	},
	"events": {
		kubectlName: "events",
		namespaced:  true,
		statusFn: func(i map[string]interface{}) string {
			reason := gStr(i, "reason")
			msg := gStr(i, "message")
			if reason != "" && msg != "" {
				if len(msg) > 80 {
					msg = msg[:80] + "…"
				}
				return reason + ": " + msg
			}
			return reason
		},
	},
	"serviceaccounts": {
		kubectlName: "serviceaccounts",
		namespaced:  true,
		statusFn:    func(i map[string]interface{}) string { return "" },
	},
	"persistentvolumes": {
		kubectlName: "persistentvolumes",
		statusFn:    func(i map[string]interface{}) string { return gStr(i, "status", "phase") },
	},
	"persistentvolumeclaims": {
		kubectlName: "persistentvolumeclaims",
		namespaced:  true,
		statusFn:    func(i map[string]interface{}) string { return gStr(i, "status", "phase") },
	},
	"resourcequotas": {
		kubectlName: "resourcequotas",
		namespaced:  true,
		statusFn:    func(i map[string]interface{}) string { return "" },
	},
	"limitranges": {
		kubectlName: "limitranges",
		namespaced:  true,
		statusFn:    func(i map[string]interface{}) string { return "" },
	},
	// Workloads
	"deployments": {
		kubectlName: "deployments",
		namespaced:  true,
		statusFn: func(i map[string]interface{}) string {
			return fmt.Sprintf("%d/%d ready", gInt(i, "status", "readyReplicas"), gInt(i, "spec", "replicas"))
		},
	},
	"replicasets": {
		kubectlName: "replicasets",
		namespaced:  true,
		statusFn: func(i map[string]interface{}) string {
			return fmt.Sprintf("%d/%d ready", gInt(i, "status", "readyReplicas"), gInt(i, "spec", "replicas"))
		},
	},
	"statefulsets": {
		kubectlName: "statefulsets",
		namespaced:  true,
		statusFn: func(i map[string]interface{}) string {
			return fmt.Sprintf("%d/%d ready", gInt(i, "status", "readyReplicas"), gInt(i, "spec", "replicas"))
		},
	},
	"daemonsets": {
		kubectlName: "daemonsets",
		namespaced:  true,
		statusFn: func(i map[string]interface{}) string {
			return fmt.Sprintf("%d/%d ready", gInt(i, "status", "numberReady"), gInt(i, "status", "desiredNumberScheduled"))
		},
	},
	"jobs": {
		kubectlName: "jobs",
		namespaced:  true,
		statusFn: func(i map[string]interface{}) string {
			succeeded := gInt(i, "status", "succeeded")
			completions := gInt(i, "spec", "completions")
			if gInt(i, "status", "active") > 0 {
				return fmt.Sprintf("Active (%d/%d)", succeeded, completions)
			}
			return fmt.Sprintf("Complete (%d/%d)", succeeded, completions)
		},
	},
	"cronjobs": {
		kubectlName: "cronjobs",
		namespaced:  true,
		statusFn:    func(i map[string]interface{}) string { return gStr(i, "spec", "schedule") },
	},
	"horizontalpodautoscalers": {
		kubectlName: "horizontalpodautoscalers",
		namespaced:  true,
		statusFn: func(i map[string]interface{}) string {
			return fmt.Sprintf("%d/%d replicas", gInt(i, "status", "currentReplicas"), gInt(i, "spec", "maxReplicas"))
		},
	},
	// Networking
	"ingresses": {
		kubectlName: "ingresses",
		namespaced:  true,
		statusFn: func(i map[string]interface{}) string {
			var hosts []string
			for _, r := range gSlice(i, "spec", "rules") {
				if rm, ok := r.(map[string]interface{}); ok {
					if h := gStrD(rm, "host"); h != "" {
						hosts = append(hosts, h)
					}
				}
			}
			return strings.Join(hosts, ", ")
		},
	},
	"ingressclasses": {
		kubectlName: "ingressclasses",
		statusFn:    func(i map[string]interface{}) string { return gStr(i, "spec", "controller") },
	},
	"networkpolicies": {
		kubectlName: "networkpolicies",
		namespaced:  true,
		statusFn:    func(i map[string]interface{}) string { return "" },
	},
	// Storage
	"storageclasses": {
		kubectlName: "storageclasses",
		statusFn:    func(i map[string]interface{}) string { return gStr(i, "provisioner") },
	},
	"volumeattachments": {
		kubectlName: "volumeattachments",
		statusFn: func(i map[string]interface{}) string {
			if attached, ok := gPath(i, "status", "attached").(bool); ok {
				if attached {
					return "Attached"
				}
				return "Detached"
			}
			return ""
		},
	},
	// RBAC
	"roles":               {kubectlName: "roles", namespaced: true, statusFn: func(i map[string]interface{}) string { return "" }},
	"rolebindings":        {kubectlName: "rolebindings", namespaced: true, statusFn: func(i map[string]interface{}) string { return "" }},
	"clusterroles":        {kubectlName: "clusterroles", statusFn: func(i map[string]interface{}) string { return "" }},
	"clusterrolebindings": {kubectlName: "clusterrolebindings", statusFn: func(i map[string]interface{}) string { return "" }},
	// Policy
	"poddisruptionbudgets": {
		kubectlName: "poddisruptionbudgets",
		namespaced:  true,
		statusFn: func(i map[string]interface{}) string {
			return fmt.Sprintf("%d healthy / %d desired", gInt(i, "status", "currentHealthy"), gInt(i, "status", "desiredHealthy"))
		},
	},
	// CRDs
	"customresourcedefinitions": {
		kubectlName: "customresourcedefinitions",
		statusFn: func(i map[string]interface{}) string {
			for _, c := range gSlice(i, "status", "conditions") {
				cm, _ := c.(map[string]interface{})
				if gStrD(cm, "type") == "Established" {
					if gStrD(cm, "status") == "True" {
						return "Established"
					}
					return "NotEstablished"
				}
			}
			return ""
		},
	},
	// Argo CD
	"applications": {
		kubectlName: "applications",
		namespaced:  true,
		statusFn: func(i map[string]interface{}) string {
			health := gStr(i, "status", "health", "status")
			sync := gStr(i, "status", "sync", "status")
			if health != "" || sync != "" {
				return health + " / " + sync
			}
			return ""
		},
	},
	"appprojects":     {kubectlName: "appprojects", namespaced: true, statusFn: func(i map[string]interface{}) string { return "" }},
	"applicationsets": {kubectlName: "applicationsets", namespaced: true, statusFn: func(i map[string]interface{}) string { return "" }},
	// External Secrets
	"externalsecrets": {
		kubectlName: "externalsecrets",
		namespaced:  true,
		statusFn: func(i map[string]interface{}) string {
			for _, c := range gSlice(i, "status", "conditions") {
				cm, _ := c.(map[string]interface{})
				if gStrD(cm, "type") == "Ready" {
					if gStrD(cm, "status") == "True" {
						return "Ready"
					}
					return gStrD(cm, "message")
				}
			}
			return ""
		},
	},
	"secretstores": {
		kubectlName: "secretstores",
		namespaced:  true,
		statusFn: func(i map[string]interface{}) string {
			for _, c := range gSlice(i, "status", "conditions") {
				cm, _ := c.(map[string]interface{})
				if gStrD(cm, "type") == "Ready" {
					if gStrD(cm, "status") == "True" {
						return "Ready"
					}
					return gStrD(cm, "message")
				}
			}
			return ""
		},
	},
	"clustersecretstores": {
		kubectlName: "clustersecretstores",
		statusFn: func(i map[string]interface{}) string {
			for _, c := range gSlice(i, "status", "conditions") {
				cm, _ := c.(map[string]interface{})
				if gStrD(cm, "type") == "Ready" {
					if gStrD(cm, "status") == "True" {
						return "Ready"
					}
					return gStrD(cm, "message")
				}
			}
			return ""
		},
	},
	"clusterexternalsecrets": {kubectlName: "clusterexternalsecrets", statusFn: func(i map[string]interface{}) string { return "" }},
	// Monitoring
	"servicemonitors": {kubectlName: "servicemonitors", namespaced: true, statusFn: func(i map[string]interface{}) string { return "" }},
	"prometheusrules": {kubectlName: "prometheusrules", namespaced: true, statusFn: func(i map[string]interface{}) string { return "" }},
	"podmonitors":     {kubectlName: "podmonitors", namespaced: true, statusFn: func(i map[string]interface{}) string { return "" }},
	"probes":          {kubectlName: "probes", namespaced: true, statusFn: func(i map[string]interface{}) string { return "" }},
	"alertmanagers":   {kubectlName: "alertmanagers", namespaced: true, statusFn: func(i map[string]interface{}) string { return fmt.Sprintf("%d replicas", gInt(i, "spec", "replicas")) }},
	"prometheuses":    {kubectlName: "prometheuses", namespaced: true, statusFn: func(i map[string]interface{}) string { return fmt.Sprintf("%d replicas", gInt(i, "spec", "replicas")) }},
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func main() {
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir("./web")))
	mux.HandleFunc("/api/resources", resourcesHandler)
	mux.HandleFunc("/api/top", topHandler)
	mux.HandleFunc("/api/detail", detailHandler)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	addr := ":8080"
	log.Printf("server listening on http://localhost%s", addr)
	if err := http.ListenAndServe(addr, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

func resourcesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	kind := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("kind")))
	if kind == "" {
		http.Error(w, "missing required query parameter: kind", http.StatusBadRequest)
		return
	}

	def, ok := registry[kind]
	if !ok {
		http.Error(w, fmt.Sprintf("unsupported resource kind: %q", kind), http.StatusBadRequest)
		return
	}

	cmdArgs := []string{"kubectl", "get", def.kubectlName}
	if def.namespaced {
		cmdArgs = append(cmdArgs, "-A")
	}
	cmdStr := strings.Join(cmdArgs, " ")

	rows, err := runKubectl(r.Context(), def)
	if err != nil {
		log.Printf("ERROR kind=%s remote=%s: %v", kind, r.RemoteAddr, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": sanitizeError(err), "command": cmdStr})
		return
	}

	log.Printf("OK kind=%s remote=%s rows=%d", kind, r.RemoteAddr, len(rows))

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resourceResponse{Namespaced: def.namespaced, Rows: rows, Command: cmdStr})
}

func runKubectl(ctx context.Context, def resourceDef) ([]resourceRow, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	args := []string{"get", def.kubectlName, "-o", "json"}
	if def.namespaced {
		args = append(args, "-A")
	}

	cmd := exec.CommandContext(ctx, "kubectl", args...)
	out, err := cmd.Output()
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			log.Printf("kubectl timeout: args=%v", args)
			return nil, fmt.Errorf("timed out")
		}
		var exitErr *exec.ExitError
		raw := ""
		if errors.As(err, &exitErr) {
			raw = strings.TrimSpace(string(exitErr.Stderr))
		}
		if raw == "" {
			raw = err.Error()
		}
		log.Printf("kubectl error: args=%v stderr=%s", args, raw)
		return nil, fmt.Errorf("%s", raw)
	}

	var list struct {
		Items []map[string]interface{} `json:"items"`
	}
	// kubectl may prefix output with deprecation warnings (e.g. "Warning: v1 Endpoints is deprecated...")
	// Strip any leading non-JSON lines before parsing.
	jsonBytes := out
	if len(out) > 0 && out[0] != '{' {
		filtered := []string{}
		for _, line := range strings.Split(string(out), "\n") {
			if strings.HasPrefix(line, "{") || len(filtered) > 0 {
				filtered = append(filtered, line)
			}
		}
		jsonBytes = []byte(strings.Join(filtered, "\n"))
	}
	if err := json.Unmarshal(jsonBytes, &list); err != nil {
		return nil, fmt.Errorf("failed to parse kubectl output: %s", strings.TrimSpace(string(out)))
	}

	rows := make([]resourceRow, 0, len(list.Items))
	for _, item := range list.Items {
		meta, _ := item["metadata"].(map[string]interface{})
		if meta == nil {
			continue
		}
		created, _ := time.Parse(time.RFC3339, gStrD(meta, "creationTimestamp"))
		rows = append(rows, resourceRow{
			Name:      gStrD(meta, "name"),
			Namespace: gStrD(meta, "namespace"),
			Status:    def.statusFn(item),
			Age:       humanizeAge(created),
		})
	}
	return rows, nil
}

// ── Detail endpoint ─────────────────────────────────────────────────────────

// detailMode controls what kubectl verb is used for the detail view.
type detailMode int

const (
	detailLogs     detailMode = iota // kubectl logs
	detailYAML                       // kubectl get -o yaml
	detailDescribe                   // kubectl describe
)

type detailDef struct {
	mode        detailMode
	kubectlName string
	namespaced  bool
	tailLines   int // only for logs
}

var detailRegistry = map[string]detailDef{
	// logs
	"pods": {mode: detailLogs, kubectlName: "pod", namespaced: true, tailLines: 200},

	// yaml — raw content most useful
	"secrets":                {mode: detailYAML, kubectlName: "secret", namespaced: true},
	"configmaps":             {mode: detailYAML, kubectlName: "configmap", namespaced: true},
	"persistentvolumes":      {mode: detailYAML, kubectlName: "pv"},
	"persistentvolumeclaims": {mode: detailYAML, kubectlName: "pvc", namespaced: true},
	"resourcequotas":         {mode: detailYAML, kubectlName: "resourcequota", namespaced: true},
	"limitranges":            {mode: detailYAML, kubectlName: "limitrange", namespaced: true},
	"ingresses":              {mode: detailYAML, kubectlName: "ingress", namespaced: true},
	"ingressclasses":         {mode: detailYAML, kubectlName: "ingressclass"},
	"networkpolicies":        {mode: detailYAML, kubectlName: "networkpolicy", namespaced: true},
	"storageclasses":         {mode: detailYAML, kubectlName: "storageclass"},
	"volumeattachments":      {mode: detailYAML, kubectlName: "volumeattachment"},
	"roles":                  {mode: detailYAML, kubectlName: "role", namespaced: true},
	"rolebindings":           {mode: detailYAML, kubectlName: "rolebinding", namespaced: true},
	"clusterroles":           {mode: detailYAML, kubectlName: "clusterrole"},
	"clusterrolebindings":    {mode: detailYAML, kubectlName: "clusterrolebinding"},
	"poddisruptionbudgets":   {mode: detailYAML, kubectlName: "pdb", namespaced: true},
	"serviceaccounts":        {mode: detailYAML, kubectlName: "serviceaccount", namespaced: true},
	"cronjobs":               {mode: detailYAML, kubectlName: "cronjob", namespaced: true},
	"endpoints":              {mode: detailYAML, kubectlName: "endpoints", namespaced: true},
	"services":               {mode: detailYAML, kubectlName: "service", namespaced: true},

	// describe — human summary most useful
	"namespaces":               {mode: detailDescribe, kubectlName: "namespace"},
	"nodes":                    {mode: detailDescribe, kubectlName: "node"},
	"events":                   {mode: detailDescribe, kubectlName: "event", namespaced: true},
	"deployments":              {mode: detailDescribe, kubectlName: "deployment", namespaced: true},
	"replicasets":              {mode: detailDescribe, kubectlName: "replicaset", namespaced: true},
	"statefulsets":             {mode: detailDescribe, kubectlName: "statefulset", namespaced: true},
	"daemonsets":               {mode: detailDescribe, kubectlName: "daemonset", namespaced: true},
	"jobs":                     {mode: detailDescribe, kubectlName: "job", namespaced: true},
	"horizontalpodautoscalers": {mode: detailDescribe, kubectlName: "hpa", namespaced: true},
	// CRDs
	"customresourcedefinitions": {mode: detailYAML, kubectlName: "crd"},
	// Argo CD
	"applications":    {mode: detailDescribe, kubectlName: "application", namespaced: true},
	"appprojects":     {mode: detailYAML, kubectlName: "appproject", namespaced: true},
	"applicationsets": {mode: detailYAML, kubectlName: "applicationset", namespaced: true},
	// External Secrets
	"externalsecrets":        {mode: detailYAML, kubectlName: "externalsecret", namespaced: true},
	"secretstores":           {mode: detailYAML, kubectlName: "secretstore", namespaced: true},
	"clustersecretstores":    {mode: detailYAML, kubectlName: "clustersecretstore"},
	"clusterexternalsecrets": {mode: detailYAML, kubectlName: "clusterexternalsecret"},
	// Monitoring
	"servicemonitors": {mode: detailYAML, kubectlName: "servicemonitor", namespaced: true},
	"prometheusrules": {mode: detailYAML, kubectlName: "prometheusrule", namespaced: true},
	"podmonitors":     {mode: detailYAML, kubectlName: "podmonitor", namespaced: true},
	"probes":          {mode: detailYAML, kubectlName: "probe", namespaced: true},
	"alertmanagers":   {mode: detailDescribe, kubectlName: "alertmanager", namespaced: true},
	"prometheuses":    {mode: detailDescribe, kubectlName: "prometheus", namespaced: true},
}

func topHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	kind := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("kind")))

	var args []string
	var namespaced bool
	switch kind {
	case "top-nodes":
		args = []string{"top", "nodes"}
	case "top-pods":
		args = []string{"top", "pods", "-A"}
		namespaced = true
	default:
		http.Error(w, fmt.Sprintf("unsupported top kind: %q", kind), http.StatusBadRequest)
		return
	}

	cmdStr := "kubectl " + strings.Join(args, " ")

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "kubectl", args...)
	out, err := cmd.Output()
	if err != nil {
		raw := ""
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			raw = "timed out"
		} else {
			var exitErr *exec.ExitError
			if errors.As(err, &exitErr) {
				raw = strings.TrimSpace(string(exitErr.Stderr))
			}
			if raw == "" {
				raw = err.Error()
			}
		}
		log.Printf("top error: kind=%s: %v stderr=%s", kind, err, raw)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": sanitizeError(fmt.Errorf("%s", raw)), "command": cmdStr})
		return
	}

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	rows := make([]topRow, 0, len(lines))
	for _, line := range lines[1:] { // skip header line
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		var row topRow
		if namespaced && len(fields) >= 4 {
			row = topRow{Namespace: fields[0], Name: fields[1], CPU: fields[2], Memory: fields[3]}
		} else if !namespaced && len(fields) >= 3 {
			row = topRow{Name: fields[0], CPU: fields[1], Memory: fields[2]}
		} else {
			continue
		}
		rows = append(rows, row)
	}

	log.Printf("top OK kind=%s remote=%s rows=%d", kind, r.RemoteAddr, len(rows))
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(topResponse{Namespaced: namespaced, Rows: rows, Command: cmdStr})
}

func detailHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	kind := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("kind")))
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	ns := strings.TrimSpace(r.URL.Query().Get("namespace"))

	if kind == "" || name == "" {
		http.Error(w, "missing required query parameters: kind, name", http.StatusBadRequest)
		return
	}

	def, ok := detailRegistry[kind]
	if !ok {
		http.Error(w, fmt.Sprintf("no detail view for kind: %q", kind), http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var args []string
	switch def.mode {
	case detailLogs:
		args = []string{"logs", name, fmt.Sprintf("--tail=%d", def.tailLines)}
		if def.namespaced && ns != "" {
			args = append(args, "-n", ns)
		}
	case detailYAML:
		args = []string{"get", def.kubectlName, name, "-o", "yaml"}
		if def.namespaced && ns != "" {
			args = append(args, "-n", ns)
		}
	case detailDescribe:
		args = []string{"describe", def.kubectlName, name}
		if def.namespaced && ns != "" {
			args = append(args, "-n", ns)
		}
	}

	cmd := exec.CommandContext(ctx, "kubectl", args...)
	cmdStr := "kubectl " + strings.Join(args, " ")
	out, err := cmd.Output()
	if err != nil {
		var raw string
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			log.Printf("detail timeout: kind=%s name=%s", kind, name)
			raw = "kubectl command timed out"
		} else {
			var exitErr *exec.ExitError
			if errors.As(err, &exitErr) {
				raw = strings.TrimSpace(string(exitErr.Stderr))
			}
			if raw == "" {
				raw = err.Error()
			}
			log.Printf("detail error: kind=%s name=%s: %v stderr=%s", kind, name, err, raw)
			raw = sanitizeError(fmt.Errorf("%s", raw))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": raw, "command": cmdStr})
		return
	}

	log.Printf("detail OK kind=%s name=%s remote=%s", kind, name, r.RemoteAddr)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"output": strings.TrimSpace(string(out)), "command": cmdStr})
}

func sanitizeError(err error) string {
	msg := err.Error()
	switch {
	case strings.Contains(msg, "Forbidden"):
		return "Permission denied: the service account does not have access to this resource."
	case strings.Contains(msg, "timed out"):
		return "The kubectl command timed out. Check cluster connectivity."
	case strings.Contains(msg, "connection refused"), strings.Contains(msg, "no such host"):
		return "Cannot reach the Kubernetes API server."
	}
	// Return the raw kubectl output so the user sees exactly what went wrong
	return msg
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func gPath(m map[string]interface{}, keys ...string) interface{} {
	var cur interface{} = m
	for _, k := range keys {
		cm, ok := cur.(map[string]interface{})
		if !ok {
			return nil
		}
		cur = cm[k]
	}
	return cur
}

func gStr(m map[string]interface{}, keys ...string) string {
	if s, ok := gPath(m, keys...).(string); ok {
		return s
	}
	return ""
}

func gStrD(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	if s, ok := m[key].(string); ok {
		return s
	}
	return ""
}

func gInt(m map[string]interface{}, keys ...string) int64 {
	switch n := gPath(m, keys...).(type) {
	case float64:
		return int64(n)
	case int64:
		return n
	}
	return 0
}

func gSlice(m map[string]interface{}, keys ...string) []interface{} {
	if s, ok := gPath(m, keys...).([]interface{}); ok {
		return s
	}
	return nil
}

func humanizeAge(created time.Time) string {
	if created.IsZero() {
		return "unknown"
	}
	d := time.Since(created)
	if d < 0 {
		return "0m"
	}
	switch {
	case d < time.Hour:
		return fmt.Sprintf("%dm", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%dh", int(d.Hours()))
	case d < 30*24*time.Hour:
		return fmt.Sprintf("%dd", int(d.Hours()/24))
	case d < 365*24*time.Hour:
		return fmt.Sprintf("%dmo", int(d.Hours()/(24*30)))
	default:
		return fmt.Sprintf("%dy", int(d.Hours()/(24*365)))
	}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
