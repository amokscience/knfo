import { useState, useRef, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ResourceTable from './components/ResourceTable'
import DetailModal from './components/DetailModal'
import { resourceGroups } from './resources'

const firstKind = resourceGroups[0].items[0].kind
// All kinds in sidebar display order
const allKinds = resourceGroups.flatMap(g => g.items.map(i => i.kind))

export default function App() {
  const [selectedKind, setSelectedKind] = useState(firstKind)
  const [rows, setRows] = useState(null)       // null = not yet fetched
  const [namespaced, setNamespaced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCached, setIsCached] = useState(false)
  const [modalItem, setModalItem] = useState(null)

  // Cache: { [kind]: { rows, namespaced, error } }
  const cache = useRef({})
  // Mirror of selectedKind readable inside async callbacks without stale closure
  const selectedKindRef = useRef(selectedKind)
  // Set to false to stop the background prefetch loop
  const prefetchRunning = useRef(true)

  const handleSelect = (kind) => {
    selectedKindRef.current = kind
    setSelectedKind(kind)
    if (cache.current[kind]) {
      const cached = cache.current[kind]
      setRows(cached.rows)
      setNamespaced(cached.namespaced)
      setError(cached.error)
      setIsCached(true)
    } else {
      setRows(null)
      setNamespaced(false)
      setError('')
      setIsCached(false)
      fetchResources(kind)
    }
  }

  const fetchResources = useCallback(async (kind = selectedKindRef.current) => {
    setLoading(true)
    setError('')
    setIsCached(false)
    try {
      const response = await fetch(`/api/resources?kind=${encodeURIComponent(kind)}`)
      if (!response.ok) {
        const text = await response.text()
        let msg
        try { msg = JSON.parse(text)?.error } catch (_) { msg = text.trim() }
        throw new Error(msg || `Request failed (${response.status})`)
      }
      const data = await response.json()
      const newRows = Array.isArray(data.rows) ? data.rows : []
      const newNamespaced = !!data.namespaced
      cache.current[kind] = { rows: newRows, namespaced: newNamespaced, error: '' }
      // Only update UI if this kind is still selected
      if (kind === selectedKindRef.current) {
        setNamespaced(newNamespaced)
        setRows(newRows)
      }
    } catch (err) {
      const msg = err.message || 'Failed to fetch resources'
      cache.current[kind] = { rows: [], namespaced: false, error: msg }
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
    try {
      const response = await fetch(`/api/resources?kind=${encodeURIComponent(kind)}`)
      if (!response.ok) return
      const data = await response.json()
      const newRows = Array.isArray(data.rows) ? data.rows : []
      const newNamespaced = !!data.namespaced
      cache.current[kind] = { rows: newRows, namespaced: newNamespaced, error: '' }
      // If user navigated to this kind while it was being prefetched, show now
      if (kind === selectedKindRef.current) {
        setRows(newRows)
        setNamespaced(newNamespaced)
        setError('')
        setIsCached(false)
        setLoading(false)
      }
    } catch (_) { /* silent */ }
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
        <span className="fw-bold text-white mb-3 ms-1">knfo</span>
        <Sidebar selected={selectedKind} onSelect={handleSelect} />
      </div>

      {/* Main */}
      <div className="flex-grow-1 p-4 overflow-auto">
        <div className="d-flex align-items-center gap-3 mb-2">
          <h1 className="h5 mb-0 fw-semibold">{selectedLabel}</h1>
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
            <span className="text-secondary small">
              {rows.length} item{rows.length !== 1 ? 's' : ''}
              {isCached && (
                <span className="badge text-bg-warning ms-2" title="Showing cached result — click Refresh to repull">cached</span>
              )}
            </span>
          )}
        </div>

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
