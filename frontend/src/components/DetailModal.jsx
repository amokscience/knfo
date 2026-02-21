import { useState, useEffect, useRef } from 'react'

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
}

export default function DetailModal({ item, kind, onClose }) {
  const { name, namespace } = item ?? {}
  const [output, setOutput] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const backdropRef = useRef()

  const modeLabel = MODE_LABEL[kind] ?? 'Describe'
  const title = namespace ? `${name}  ·  ${namespace}` : name

  useEffect(() => {
    if (!item) return
    setOutput(null)
    setError('')
    setLoading(true)

    const params = new URLSearchParams({ kind, name })
    if (namespace) params.set('namespace', namespace)

    fetch(`/api/detail?${params}`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          let msg
          try { msg = JSON.parse(text)?.error } catch (_) { msg = text.trim() }
          throw new Error(msg || `Request failed (${res.status})`)
        }
        return res.json()
      })
      .then((data) => setOutput(data.output ?? ''))
      .catch((err) => setError(err.message || 'Failed to load detail'))
      .finally(() => setLoading(false))
  }, [item, kind, name, namespace])

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
          <div className="d-flex align-items-center gap-2 text-truncate">
            <span className="badge text-bg-primary text-uppercase" style={{ fontSize: '0.7rem' }}>
              {modeLabel}
            </span>
            <span className="fw-semibold text-white text-truncate">{title}</span>
          </div>
          <button
            className="btn-close btn-close-white ms-3"
            style={{ flexShrink: 0 }}
            onClick={onClose}
            aria-label="Close"
          />
        </div>

        {/* Body */}
        <div className="overflow-auto p-3" style={{ flex: 1 }}>
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
