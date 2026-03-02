// Dark colors with sufficient contrast for white text (WCAG AA)
const NS_COLORS = [
  '#1565c0', // blue 800
  '#6a1b9a', // purple 800
  '#00695c', // teal 800
  '#c62828', // red 800
  '#e65100', // orange 900
  '#2e7d32', // green 800
  '#283593', // indigo 800
  '#4527a0', // deep-purple 800
  '#00838f', // cyan 800
  '#558b2f', // light-green 800
  '#f9a825', // amber 800  (dark enough bg, white still reads)
  '#6d4c41', // brown 600
  '#37474f', // blue-grey 700
  '#ad1457', // pink 800
  '#0277bd', // light-blue 800
]

// Simple djb2 hash so the same namespace always gets the same color
function nsColor(name) {
  if (!name) return NS_COLORS[0]
  let hash = 5381
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33) ^ name.charCodeAt(i)
  }
  return NS_COLORS[Math.abs(hash) % NS_COLORS.length]
}

import { statusSeverity } from '../utils/statusSeverity'

export default function ResourceTable({ rows, namespaced, loading, error, onRowClick, topMode = false, syncHistoryMode = false }) {
  if (loading) {
    return (
      <div className="d-flex align-items-center gap-2 text-secondary py-5 justify-content-center">
        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        Running kubectl…
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-danger d-flex align-items-start gap-2 mt-3" role="alert">
        <i className="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1" />
        <div>
          <strong>Error</strong><br />
          {error}
        </div>
      </div>
    )
  }

  if (rows === null) {
    return (
      <p className="text-secondary mt-4">
        Select a resource on the left to load it.
      </p>
    )
  }

  if (rows.length === 0) {
    return <p className="text-secondary mt-4">No resources found.</p>
  }

  return (
    <div className="table-responsive mt-3">
      <table className="table table-sm table-striped table-hover table-bordered align-middle mb-0">
        <thead className="table-dark">
          <tr>
            <th>Name</th>
            {namespaced && <th>Namespace</th>}
            {topMode ? (
              <>
                <th>CPU</th>
                <th>Memory</th>
              </>
            ) : syncHistoryMode ? (
              <>
                <th>Revision</th>
                <th>Duration</th>
                <th>Deployed</th>
              </>
            ) : (
              <>
                <th>Status</th>
                <th>Age</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const sev = statusSeverity(row.status)
            const rowClass = sev === 'error' ? 'table-danger' : sev === 'warning' ? 'table-warning' : sev === 'success' ? 'table-success' : ''
            const zeroTd = sev === 'zero' ? { backgroundColor: '#7e8085', color: '#f1f5f9' } : undefined
            return (
            <tr
              key={`${row.name}-${row.namespace}-${idx}`}
              className={rowClass}
            >
              <td style={zeroTd}>
                <code
                  className="text-body"
                  onClick={() => onRowClick?.(row)}
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  title={onRowClick ? 'Click to view details' : undefined}
                >{row.name}</code>
              </td>
              {namespaced && (
                <td style={zeroTd}>
                  <span
                    className="badge"
                    style={{ backgroundColor: nsColor(row.namespace), color: '#fff' }}
                  >
                    {row.namespace}
                  </span>
                </td>
              )}
              {topMode ? (
                <>
                  <td className="text-nowrap"><code>{row.cpu}</code></td>
                  <td className="text-nowrap"><code>{row.memory}</code></td>
                </>
              ) : syncHistoryMode ? (
                <>
                  <td className="text-nowrap"><code>{row.revision}</code></td>
                  <td className="text-nowrap text-secondary">{row.duration}</td>
                  <td className="text-nowrap">{row.age}</td>
                </>
              ) : (
                <>
                  <td style={zeroTd}>
                    {sev === 'error' && <i className="bi bi-exclamation-circle-fill text-danger me-1" />}
                    {sev === 'warning' && <i className="bi bi-exclamation-triangle-fill text-warning me-1" />}
                    {sev === 'success' && <i className="bi bi-check-circle-fill text-success me-1" />}
                    {row.status || <span className="text-secondary">—</span>}
                  </td>
                  <td className="text-nowrap" style={zeroTd}>{row.age}</td>
                </>
              )}
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
