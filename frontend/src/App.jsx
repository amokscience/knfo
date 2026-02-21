import { useState } from 'react'
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

  // Label for the currently selected kind
  const selectedLabel = resourceGroups
    .flatMap(g => g.items)
    .find(i => i.kind === selectedKind)?.label ?? selectedKind

  const handleSelect = (kind) => {
    setSelectedKind(kind)
    setRows(null)
    setError('')
  }

  const fetchResources = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/resources?kind=${encodeURIComponent(selectedKind)}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Request failed')
      }
      setNamespaced(!!data.namespaced)
      setRows(Array.isArray(data.rows) ? data.rows : [])
    } catch (err) {
      setError(err.message || 'Failed to fetch resources')
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
            onClick={fetchResources}
            disabled={loading}
          >
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />Fetching…</>
              : 'Fetch'
            }
          </button>
          {rows !== null && !loading && !error && (
            <span className="text-secondary small">{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
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
