import { useState, useRef, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ResourceTable from './components/ResourceTable'
import DetailModal from './components/DetailModal'
import { resourceGroups } from './resources'
import { refLinks } from './refLinks'
import { rowsHealth } from './utils/statusSeverity'

const firstKind = resourceGroups[0].items[0].kind
// All kinds in sidebar display order
const allKinds = resourceGroups.flatMap(g => g.items.map(i => i.kind))

function timeAgo(ts, now = Date.now()) {
  if (!ts) return ''
  const secs = Math.floor((now - ts) / 1000)
  if (secs < 5)  return 'just now'
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

function fmtTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString()
}

export default function App() {
  const [selectedKind, setSelectedKind] = useState(firstKind)
  const [rows, setRows] = useState(null)       // null = not yet fetched
  const [namespaced, setNamespaced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCached, setIsCached] = useState(false)
  const [cacheTime, setCacheTime] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [command, setCommand] = useState('')
  const [copiedListCmd, setCopiedListCmd] = useState(false)
  const [modalItem, setModalItem] = useState(null)
  // Per-kind fetch status for sidebar indicators: 'loading' | 'ok' | 'error'
  const [kindStatus, setKindStatus] = useState({})
  // Per-kind data health: 'error' | 'warning' | null (based on row statuses)
  const [kindHealth, setKindHealth] = useState({})

  // Cache: { [kind]: { rows, namespaced, error } }
  const cache = useRef({})
  // Mirror of selectedKind readable inside async callbacks without stale closure
  const selectedKindRef = useRef(selectedKind)
  // Set to false to stop the background prefetch loop
  const prefetchRunning = useRef(true)

  // Tick 'now' every second while showing a cached result
  useEffect(() => {
    if (!isCached) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isCached])

  const handleSelect = (kind) => {
    selectedKindRef.current = kind
    setSelectedKind(kind)
    if (cache.current[kind]) {
      const cached = cache.current[kind]
      setRows(cached.rows)
      setNamespaced(cached.namespaced)
      setError(cached.error)
      setCommand(cached.command ?? '')
      setIsCached(true)
      setCacheTime(cached.cachedAt ?? null)
    } else {
      setRows(null)
      setNamespaced(false)
      setError('')
      setIsCached(false)
      setCacheTime(null)
      setCommand('')
      setCopiedListCmd(false)
      fetchResources(kind)
    }
  }

  const fetchResources = useCallback(async (kind = selectedKindRef.current) => {
    setLoading(true)
    setError('')
    setIsCached(false)
    setKindStatus(prev => ({ ...prev, [kind]: 'loading' }))
    try {
      const response = await fetch(`/api/resources?kind=${encodeURIComponent(kind)}`)
      const text = await response.text()
      let data
      try { data = JSON.parse(text) } catch (_) { data = {} }
      const errCmd = data.command ?? ''
      if (!response.ok) {
        const msg = data.error || text.trim() || `Request failed (${response.status})`
        cache.current[kind] = { rows: [], namespaced: false, error: msg, cachedAt: Date.now(), command: errCmd }
        setKindStatus(prev => ({ ...prev, [kind]: 'error' }))
        if (kind === selectedKindRef.current) {
          setError(msg)
          setRows([])
          setCommand(errCmd)
        }
        return
      }
      const newRows = Array.isArray(data.rows) ? data.rows : []
      const newNamespaced = !!data.namespaced
      const newCommand = data.command ?? ''
      cache.current[kind] = { rows: newRows, namespaced: newNamespaced, error: '', cachedAt: Date.now(), command: newCommand }
      setKindStatus(prev => ({ ...prev, [kind]: 'ok' }))
      setKindHealth(prev => ({ ...prev, [kind]: rowsHealth(newRows) }))
      if (kind === selectedKindRef.current) {
        setNamespaced(newNamespaced)
        setRows(newRows)
        setCommand(newCommand)
      }
    } catch (err) {
      const msg = err.message || 'Failed to fetch resources'
      cache.current[kind] = { rows: [], namespaced: false, error: msg, cachedAt: Date.now(), command: '' }
      setKindStatus(prev => ({ ...prev, [kind]: 'error' }))
      if (kind === selectedKindRef.current) {
        setError(msg)
        setRows([])
      }
    } finally {
      if (kind === selectedKindRef.current) setLoading(false)
    }
  }, [])

  // Silent background prefetch — populates cache only, no loading spinner
  const prefetchKind = useCallback(async (kind) => {
    setKindStatus(prev => ({ ...prev, [kind]: 'loading' }))
    try {
      const response = await fetch(`/api/resources?kind=${encodeURIComponent(kind)}`)
      if (!response.ok) {
        setKindStatus(prev => ({ ...prev, [kind]: 'error' }))
        return
      }
      const data = await response.json()
      const newRows = Array.isArray(data.rows) ? data.rows : []
      const newNamespaced = !!data.namespaced
      cache.current[kind] = { rows: newRows, namespaced: newNamespaced, error: '', cachedAt: Date.now(), command: data.command ?? '' }
      setKindStatus(prev => ({ ...prev, [kind]: 'ok' }))
      setKindHealth(prev => ({ ...prev, [kind]: rowsHealth(newRows) }))
      // If user navigated to this kind while it was being prefetched, show now
      if (kind === selectedKindRef.current) {
        setRows(newRows)
        setNamespaced(newNamespaced)
        setCommand(data.command ?? '')
        setError('')
        setIsCached(false)
        setCacheTime(null)
        setLoading(false)
      }
    } catch (_) {
      setKindStatus(prev => ({ ...prev, [kind]: 'error' }))
    }
  }, [])

  // Background prefetch loop — runs after mount, 600ms between each kind
  useEffect(() => {
    prefetchRunning.current = true
    let timeoutId

    const runLoop = async () => {
      for (const kind of allKinds) {
        if (!prefetchRunning.current) break
        // Skip if already cached (user clicked it or loop already did it)
        if (cache.current[kind]) continue
        await prefetchKind(kind)
        // Pause between fetches; wrap in a cancellable promise
        await new Promise(resolve => { timeoutId = setTimeout(resolve, 600) })
      }
    }

    runLoop()
    return () => {
      prefetchRunning.current = false
      clearTimeout(timeoutId)
    }
  }, [prefetchKind])

  // Label for the currently selected kind
  const selectedLabel = resourceGroups
    .flatMap(g => g.items)
    .find(i => i.kind === selectedKind)?.label ?? selectedKind

  return (
    <div className="d-flex vh-100">
      {/* Sidebar */}
      <div
        className="d-flex flex-column flex-shrink-0 p-3 border-end overflow-auto"
        style={{ width: '220px', background: '#0f172a' }}
      >
        <span className="fw-bold text-white mb-3 ms-1">k-info</span>
        <Sidebar selected={selectedKind} onSelect={handleSelect} kindStatus={kindStatus} kindHealth={kindHealth} />
      </div>

      {/* Main */}
      <div className="flex-grow-1 p-4 overflow-auto">
        <div className="d-flex align-items-center gap-3 mb-2">
          <h1 className="h5 mb-0 fw-semibold">{selectedLabel}</h1>
          {refLinks[selectedKind] && (
            <a
              href={refLinks[selectedKind]}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-outline-secondary"
            >
              Ref
            </a>
          )}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => fetchResources()}
            disabled={loading}
          >
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />Refreshing…</>
              : 'Refresh'
            }
          </button>
          {rows !== null && !loading && !error && (
            <span className="d-inline-flex align-items-center gap-2 text-secondary small">
              <span>{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
              {isCached && (
                <span className="d-inline-flex align-items-center gap-1">
                  <span className="badge text-bg-warning" title="Showing cached result — click Refresh to repull">cached</span>
                  <span className="text-secondary" style={{ fontSize: '0.75rem' }} title={fmtTime(cacheTime)}>
                    {timeAgo(cacheTime, now)}
                  </span>
                  <span className="text-secondary" style={{ fontSize: '0.75rem', opacity: 0.6 }}>· {fmtTime(cacheTime)}</span>
                </span>
              )}
            </span>
          )}
        </div>

          {command && !loading && (
            <div className="d-inline-flex align-items-center gap-1 mb-2">
              <code
                style={{ fontSize: '0.78rem', background: '#f8f9fa', borderRadius: '4px', padding: '3px 8px', userSelect: 'text' }}
              >
                {command}
              </code>
              <button
                style={{
                  background: 'transparent',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  color: copiedListCmd ? '#16a34a' : '#475569',
                  padding: '2px 6px',
                  lineHeight: 1.4,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
                title={copiedListCmd ? 'Copied!' : 'Copy command to clipboard'}
                onClick={() => {
                  navigator.clipboard.writeText(command).then(() => {
                    setCopiedListCmd(true)
                    setTimeout(() => setCopiedListCmd(false), 2000)
                  })
                }}
              >
                {copiedListCmd
                  ? <i className="bi bi-check2" />
                  : <i className="bi bi-clipboard" />}
              </button>
            </div>
          )}
          <ResourceTable
          rows={rows}
          namespaced={namespaced}
          loading={loading}
          error={error}
          onRowClick={setModalItem}
        />

        <DetailModal
          item={modalItem}
          kind={selectedKind}
          onClose={() => setModalItem(null)}
        />
      </div>
    </div>
  )
}
