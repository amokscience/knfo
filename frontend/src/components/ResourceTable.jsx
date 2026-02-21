export default function ResourceTable({ rows, namespaced, loading, error }) {
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
        Select a resource on the left and click <strong>Fetch</strong>.
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
            <th>Status</th>
            <th>Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.name}-${row.namespace}-${idx}`}>
              <td><code className="text-body">{row.name}</code></td>
              {namespaced && <td><span className="badge text-bg-secondary">{row.namespace}</span></td>}
              <td>{row.status || <span className="text-secondary">—</span>}</td>
              <td className="text-nowrap">{row.age}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
