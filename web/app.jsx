const { useState } = React;

function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchNamespaces = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch('/api/namespaces');
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Request failed');
      }

      const data = await response.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch namespaces');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Kubernetes Namespaces</h1>
      <div className="controls">
        <button onClick={fetchNamespaces} disabled={loading}>
          {loading ? 'Running kubectl...' : 'Run kubectl get namespaces -A'}
        </button>
        <span className="muted">Results are shown below.</span>
      </div>

      {error && <div className="error">{error}</div>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan="3" className="muted">No namespace data yet. Click the button to run the command.</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.status || '-'}</td>
              <td>{row.age || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
