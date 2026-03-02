import { useState, useEffect, useRef } from 'react'

// Same djb2 palette used in ResourceTable
const NS_COLORS = [
  '#1565c0','#6a1b9a','#00695c','#c62828','#e65100',
  '#2e7d32','#283593','#4527a0','#00838f','#558b2f',
  '#f9a825','#6d4c41','#37474f','#ad1457','#0277bd',
]
function nsColor(name) {
  if (!name) return NS_COLORS[0]
  let hash = 5381
  for (let i = 0; i < name.length; i++) hash = (hash * 33) ^ name.charCodeAt(i)
  return NS_COLORS[Math.abs(hash) % NS_COLORS.length]
}

// Which mode label to show in the header badge
const MODE_LABEL = {
  pods: 'Logs',
  secrets: 'YAML', configmaps: 'YAML', persistentvolumes: 'YAML',
  persistentvolumeclaims: 'YAML', resourcequotas: 'YAML', limitranges: 'YAML',
  ingresses: 'YAML', ingressclasses: 'YAML', networkpolicies: 'YAML',
  storageclasses: 'YAML', volumeattachments: 'YAML', roles: 'YAML',
  rolebindings: 'YAML', clusterroles: 'YAML', clusterrolebindings: 'YAML',
  poddisruptionbudgets: 'YAML', serviceaccounts: 'YAML', cronjobs: 'YAML',
  endpoints: 'YAML', services: 'YAML',
  // CRDs
  customresourcedefinitions: 'YAML',
  // Argo CD
  appprojects: 'YAML', applicationsets: 'YAML',
  // External Secrets
  externalsecrets: 'YAML', secretstores: 'YAML',
  clustersecretstores: 'YAML', clusterexternalsecrets: 'YAML',
  // Monitoring
  servicemonitors: 'YAML', prometheusrules: 'YAML', podmonitors: 'YAML', probes: 'YAML',
}

export default function DetailModal({ item, kind, onClose }) {
  const { name, namespace } = item ?? {}
  const [output, setOutput] = useState(null)
  const [detailCmd, setDetailCmd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null) // null | 'ok' | 'error'
  const [syncError, setSyncError] = useState('')
  const [syncCmd, setSyncCmd] = useState('')
  const backdropRef = useRef()

  const modeLabel = MODE_LABEL[kind] ?? 'Describe'

  useEffect(() => {
    if (!item) return
    setOutput(null)
    setError('')
    setLoading(true)

    const params = new URLSearchParams({ kind, name })
    if (namespace) params.set('namespace', namespace)

    fetch(`/api/detail?${params}`)
      .then(async (res) => {
        const text = await res.text()
        let data
        try { data = JSON.parse(text) } catch (_) { data = {} }
        if (!res.ok) {
          setDetailCmd(data.command ?? '')
          throw new Error(data.error || text.trim() || `Request failed (${res.status})`)
        }
        setDetailCmd(data.command ?? '')
        return data
      })
      .then((data) => setOutput(data.output ?? ''))
      .catch((err) => setError(err.message || 'Failed to load detail'))
      .finally(() => setLoading(false))
  }, [item, kind, name, namespace])

  // Reset copied + sync state when item changes
  useEffect(() => {
    setCopied(false)
    setCopiedCmd(false)
    setDetailCmd('')
    setSyncing(false)
    setSyncResult(null)
    setSyncError('')
    setSyncCmd('')
  }, [item])

  const handleSync = () => {
    if (!name) return
    setSyncing(true)
    setSyncResult(null)
    setSyncError('')
    setSyncCmd('')
    const params = new URLSearchParams({ name })
    if (namespace) params.set('namespace', namespace)
    fetch(`/api/argo-sync?${params}`, { method: 'POST' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (data.command) setSyncCmd(data.command)
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
        setSyncResult('ok')
      })
      .catch((err) => {
        setSyncResult('error')
        setSyncError(err.message || 'Sync failed')
      })
      .finally(() => setSyncing(false))
  }

  const handleCopy = () => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleCopyCmd = () => {
    if (!detailCmd) return
    navigator.clipboard.writeText(detailCmd).then(() => {
      setCopiedCmd(true)
      setTimeout(() => setCopiedCmd(false), 2000)
    })
  }

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!item) return null

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: '#1e293b',
          borderRadius: '10px',
          width: '100%',
          maxWidth: 'min(1720px, 95vw)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="d-flex align-items-center justify-content-between px-4 py-3"
          style={{ borderBottom: '1px solid #334155', flexShrink: 0 }}
        >
          <div className="d-flex align-items-center gap-3" style={{ minWidth: 0 }}>
            <div style={{ flexShrink: 0 }}>
              <span className="badge text-bg-primary text-uppercase" style={{ fontSize: '0.7rem' }}>
                {modeLabel}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="fw-semibold text-white text-truncate" style={{ userSelect: 'text' }}>{name}</div>
            </div>
            {namespace && (
              <div style={{ flexShrink: 0 }}>
                <span
                  className="badge"
                  style={{ backgroundColor: nsColor(namespace), color: '#fff', fontSize: '0.75rem', userSelect: 'text' }}
                >
                  {namespace}
                </span>
              </div>
            )}
            {/* Copy button — lives in title row, right of namespace */}
            <div style={{ flexShrink: 0 }}>
              <button
                style={{
                  background: 'transparent',
                  border: '1px solid #64748b',
                  borderRadius: '4px',
                  color: copied ? '#4ade80' : '#f1f5f9',
                  padding: '2px 7px',
                  lineHeight: 1.4,
                  fontSize: '0.78rem',
                  cursor: output ? 'pointer' : 'not-allowed',
                  opacity: output ? 1 : 0.4,
                }}
                onClick={handleCopy}
                disabled={!output}
                title="Copy contents to clipboard"
              >
                {copied
                  ? <i className="bi bi-check2" />
                  : <i className="bi bi-clipboard" />}
              </button>
              <button
                style={{
                  background: 'transparent',
                  border: '1px solid #64748b',
                  borderRadius: '4px',
                  color: copiedCmd ? '#4ade80' : '#f1f5f9',
                  padding: '2px 7px',
                  lineHeight: 1.4,
                  fontSize: '0.78rem',
                  cursor: detailCmd ? 'pointer' : 'not-allowed',
                  opacity: detailCmd ? 1 : 0.4,
                }}
                onClick={handleCopyCmd}
                disabled={!detailCmd}
                title={detailCmd ? `Copy command: ${detailCmd}` : 'Copy command'}
              >
                {copiedCmd
                  ? <i className="bi bi-check2" />
                  : <i className="bi bi-terminal" />}
              </button>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 ms-3" style={{ flexShrink: 0 }}>
            {kind === 'applications' && (
              <button
                className={`btn btn-sm ${
                  syncResult === 'ok' ? 'btn-success' :
                  syncResult === 'error' ? 'btn-danger' :
                  'btn-warning'
                }`}
                style={{ fontSize: '0.78rem', minWidth: '80px' }}
                onClick={handleSync}
                disabled={syncing}
                title={syncResult === 'error' ? 'See error below' : 'Trigger an Argo CD sync for this application'}
              >
                {syncing
                  ? <><span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />Syncing…</>
                  : syncResult === 'ok' ? <><i className="bi bi-check2 me-1" />Synced!</>
                  : syncResult === 'error' ? <><i className="bi bi-exclamation-triangle me-1" />Failed</>
                  : <><i className="bi bi-arrow-repeat me-1" />Sync</>}
              </button>
            )}
            <button
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Close"
            />
          </div>
        </div>

        {/* Body */}
        <div className="overflow-auto p-3" style={{ flex: 1 }}>
          {detailCmd && (
            <div className="d-inline-flex align-items-center gap-1 mb-2">
              <code style={{ fontSize: '0.78rem', background: '#0f172a', borderRadius: '4px', padding: '3px 8px', color: '#94a3b8', userSelect: 'text' }}>
                {detailCmd}
              </code>
            </div>
          )}
          {syncCmd && !loading && (
            <div className="d-inline-flex align-items-center gap-1 mb-2">
              <code style={{ fontSize: '0.78rem', background: '#0f172a', borderRadius: '4px', padding: '3px 8px', color: '#94a3b8', userSelect: 'text' }}>
                {syncCmd}
              </code>
            </div>
          )}
          {syncResult === 'error' && syncError && (
            <div className="alert alert-danger d-flex align-items-start gap-2 mb-2" role="alert">
              <i className="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1" />
              <div>
                <strong>Sync failed</strong><br />
                <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{syncError}</span>
              </div>
            </div>
          )}
          {loading && (
            <div className="d-flex align-items-center gap-2 text-secondary py-4 justify-content-center">
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              Loading {modeLabel.toLowerCase()}…
            </div>
          )}
          {error && (
            <div className="alert alert-danger mb-0">{error}</div>
          )}
          {!loading && !error && output !== null && (
            output === '' ? (
              <p className="text-secondary mb-0">No output returned.</p>
            ) : (
              <pre style={{
                margin: 0,
                fontSize: '0.78rem',
                color: '#e2e8f0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {output}
              </pre>
            )
          )}
        </div>
      </div>
    </div>
  )
}
