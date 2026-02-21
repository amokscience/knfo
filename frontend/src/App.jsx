import { useState } from 'react'

export default function App() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchNamespaces = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/namespaces')
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Request failed')
      }
      const data = await response.json()
      setRows(Array.isArray(data.rows) ? data.rows : [])
    } catch (err) {
      setError(err.message || 'Failed to fetch namespaces')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-xl-10">

          <div className="d-flex align-items-center gap-3 mb-4">
            <h1 className="h4 mb-0 fw-semibold">Kubernetes Namespaces</h1>
            <button
              className="btn btn-primary"
              onClick={fetchNamespaces}
              disabled={loading}
            >
              {loading
                ? <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />Running...</>
                : 'Run kubectl get namespaces -A'
              }
            </button>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <div className="table-responsive">
            <table className="table table-striped table-hover table-bordered align-middle mb-0">
              <thead className="table-dark">
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Status</th>
                  <th scope="col">Age</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center text-muted py-4">
                      No data yet — click the button to run the command.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.name}>
                      <td><code>{row.name}</code></td>
                      <td>
                        <span className={`badge ${row.status === 'Active' ? 'bg-success' : 'bg-secondary'}`}>
                          {row.status || '-'}
                        </span>
                      </td>
                      <td>{row.age || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  )
}
