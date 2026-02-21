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
}

type resourceRow struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace,omitempty"`
	Status    string `json:"status,omitempty"`
	Age       string `json:"age"`
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
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func main() {
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir("./web")))
	mux.HandleFunc("/api/resources", resourcesHandler)
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

	rows, err := runKubectl(r.Context(), def)
	if err != nil {
		log.Printf("ERROR kind=%s remote=%s: %v", kind, r.RemoteAddr, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": sanitizeError(err)})
		return
	}

	log.Printf("OK kind=%s remote=%s rows=%d", kind, r.RemoteAddr, len(rows))

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resourceResponse{Namespaced: def.namespaced, Rows: rows})
}

func runKubectl(ctx context.Context, def resourceDef) ([]resourceRow, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	args := []string{"get", def.kubectlName, "-o", "json"}
	if def.namespaced {
		args = append(args, "-A")
	}

	cmd := exec.CommandContext(ctx, "kubectl", args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		raw := strings.TrimSpace(string(out))
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			log.Printf("kubectl timeout: args=%v", args)
			return nil, fmt.Errorf("timed out")
		}
		log.Printf("kubectl error: args=%v output=%s", args, raw)
		return nil, fmt.Errorf("%s", raw)
	}

	var list struct {
		Items []map[string]interface{} `json:"items"`
	}
	if err := json.Unmarshal(out, &list); err != nil {
		return nil, fmt.Errorf("failed to parse kubectl output")
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

func sanitizeError(err error) string {
	msg := err.Error()
	switch {
	case strings.Contains(msg, "Forbidden"):
		return "Permission denied: the service account does not have access to this resource."
	case strings.Contains(msg, "timed out"):
		return "The kubectl command timed out. Check cluster connectivity."
	case strings.Contains(msg, "not found"), strings.Contains(msg, "No such"):
		return "Resource type not found in this cluster."
	case strings.Contains(msg, "connection refused"), strings.Contains(msg, "no such host"):
		return "Cannot reach the Kubernetes API server."
	}
	return "Failed to retrieve resources. Check server logs for details."
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
