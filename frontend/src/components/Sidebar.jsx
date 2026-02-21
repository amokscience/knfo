import { resourceGroups } from '../resources'

export default function Sidebar({ selected, onSelect }) {
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
                  className={`nav-link text-start w-100 py-1 ${selected === item.kind ? 'active' : 'text-white'}`}
                  onClick={() => onSelect(item.kind)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
