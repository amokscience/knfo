import { useState, useRef } from 'react'
import Sidebar from './components/Sidebar'
import ResourceTable from './components/ResourceTable'
import { resourceGroups } from './resources'

const firstKind = resourceGroups[0].items[0].kind

export default function App() {
  const [selectedKind, setSelectedKind] = useState(firstKind)
  const [rows, setRows] = useState(null)       // null = not yet fetched
  const [namespaced, setNamespaced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCached, setIsCached] = useState(false)

  // Cache: { [kind]: { rows, namespaced, error } }
  const cache = useRef({})

  // Label for the currently selected kind
  const selectedLabel = resourceGroups
    .flatMap(g => g.items)
    .find(i => i.kind === selectedKind)?.label ?? selectedKind

  const handleSelect = (kind) => {
    setSelectedKind(kind)
    // Restore from cache immediately if available, otherwise reset
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
    }
  }

  const fetchResources = async (kind = selectedKind) => {
    setLoading(true)
    setError('')
    setIsCached(false)
    try {
      const response = await fetch(`/api/resources?kind=${encodeURIComponent(kind)}`)
      if (!response.ok) {
        // Server returns plain text for 4xx and JSON for 5xx — handle both
        const text = await response.text()
        let msg
        try { msg = JSON.parse(text)?.error } catch (_) { msg = text.trim() }
        throw new Error(msg || `Request failed (${response.status})`)
      }
      const data = await response.json()
      const newRows = Array.isArray(data.rows) ? data.rows : []
      const newNamespaced = !!data.namespaced
      // Overwrite cache for this kind
      cache.current[kind] = { rows: newRows, namespaced: newNamespaced, error: '' }
      setNamespaced(newNamespaced)
      setRows(newRows)
    } catch (err) {
      const msg = err.message || 'Failed to fetch resources'
      cache.current[kind] = { rows: [], namespaced: false, error: msg }
      setError(msg)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

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
              ? <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />Fetching…</>
              : 'Fetch'
            }
          </button>
          {rows !== null && !loading && !error && (
            <span className="text-secondary small">
              {rows.length} item{rows.length !== 1 ? 's' : ''}
              {isCached && (
                <span className="badge text-bg-warning ms-2" title="Showing cached result — click Fetch to refresh">cached</span>
              )}
            </span>
          )}
        </div>

        <ResourceTable
          rows={rows}
          namespaced={namespaced}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  )
}
