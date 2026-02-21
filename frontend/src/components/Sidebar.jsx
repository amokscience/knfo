import { resourceGroups } from '../resources'

function StatusDot({ status }) {
  if (status === 'loading') return (
    <span
      className="spinner-border ms-auto flex-shrink-0"
      role="status"
      aria-hidden="true"
      style={{ width: '0.55rem', height: '0.55rem', borderWidth: '0.1em', opacity: 0.5 }}
    />
  )
  if (status === 'error') return (
    <span
      title="Failed to fetch"
      style={{ width: '0.55rem', height: '0.55rem', borderRadius: '50%', background: '#7f1d1d', display: 'inline-block', flexShrink: 0, marginLeft: 'auto', opacity: 0.85 }}
    />
  )
  return null
}

export default function Sidebar({ selected, onSelect, kindStatus = {} }) {
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
                  className={`nav-link text-start w-100 py-1 d-flex align-items-center ${selected === item.kind ? 'active' : 'text-white'}`}
                  onClick={() => onSelect(item.kind)}
                >
                  <span className="me-1">{item.label}</span>
                  <StatusDot status={kindStatus[item.kind]} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
