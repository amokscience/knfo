import { resourceGroups } from '../resources'

function StatusDot({ status }) {
  if (status === 'loading') return (
    <span
      className="spinner-border flex-shrink-0"
      role="status"
      aria-hidden="true"
      style={{ width: '0.55rem', height: '0.55rem', borderWidth: '0.1em', opacity: 0.5 }}
    />
  )
  if (status === 'error') return (
    <span
      title="Failed to fetch"
      style={{ width: '0.55rem', height: '0.55rem', borderRadius: '50%', background: '#7f1d1d', display: 'inline-block', flexShrink: 0, opacity: 0.85 }}
    />
  )
  // Placeholder keeps layout stable
  return <span style={{ width: '0.55rem', height: '0.55rem', display: 'inline-block', flexShrink: 0 }} />
}

function HealthDot({ health }) {
  if (health === 'error') return (
    <span
      title="One or more resources in error state"
      style={{ width: '0.45rem', height: '0.45rem', borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }}
    />
  )
  if (health === 'warning') return (
    <span
      title="One or more resources in warning state"
      style={{ width: '0.45rem', height: '0.45rem', borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }}
    />
  )
  return <span style={{ width: '0.45rem', height: '0.45rem', display: 'inline-block', flexShrink: 0 }} />
}

export default function Sidebar({ selected, onSelect, kindStatus = {}, kindHealth = {} }) {
  return (
    <nav className="d-flex flex-column gap-3">
      {resourceGroups.map((group) => (
        <div key={group.label}>
          <div className="text-uppercase fw-semibold small text-white-50 mb-1 px-2">
            {group.label}
          </div>
          <ul className="nav nav-pills flex-column">
            {group.items.map((item) => (
              <li key={item.kind} className="nav-item">
                <button
                  className={`nav-link text-start w-100 py-1 d-flex align-items-center gap-2 ${selected === item.kind ? 'active' : 'text-white'}`}
                  onClick={() => onSelect(item.kind)}
                >
                  <StatusDot status={kindStatus[item.kind]} />
                  <HealthDot health={kindHealth[item.kind]} />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
