const ERROR_PATTERNS = [
  /\bfailed?\b/i, /\bdegraded\b/i, /\berror\b/i, /\bcrashloop/i,
  /\boomkilled\b/i, /\bimagepullbackoff\b/i, /\berrimage/i,
  /\bterminating\b/i, /\bunknown\b/i, /\bnot\s*ready\b/i,
  /\bunhealthy\b/i, /\bcrash\b/i, /\bevicted\b/i, /\binvalid\b/i,
  /\bout\s*of\s*sync\b/i,
]
const WARN_PATTERNS = [
  /\bpending\b/i, /\bsyncing\b/i, /\bprogressing\b/i, /\bwaiting\b/i,
  /\bcontainercreating\b/i, /\bpodinitializing\b/i, /\binit:/i,
  /\bupdating\b/i, /\bscaling\b/i, /\breconciling\b/i, /\bdeploying\b/i,
  /\bstarting\b/i, /\bnotinstalled\b/i,
]
const SUCCESS_PATTERNS = [
  /\bhealthy\b/i, /\bsynced\b/i, /\bsuccess(ful)?\b/i,
  /\brunning\b/i, /\bscheduled\b/i, /\bpulled\b/i,
  /\bcreated\b/i, /\bstarted\b/i, /\bcompleted\b/i,
]

export function statusSeverity(status) {
  if (!status) return null
  const ratio = status.match(/(\d+)\/(\d+)/)
  if (ratio) {
    const ready = Number(ratio[1])
    const total = Number(ratio[2])
    if (ready === 0 && total === 0) return 'zero'
    if (ready === 0 && total > 0) return 'error'
    if (ready < total) return 'warning'
    return null
  }
  for (const re of ERROR_PATTERNS) if (re.test(status)) return 'error'
  for (const re of WARN_PATTERNS) if (re.test(status)) return 'warning'
  for (const re of SUCCESS_PATTERNS) if (re.test(status)) return 'success'
  return null
}

// Returns the worst severity across an array of rows
export function rowsHealth(rows) {
  if (!Array.isArray(rows)) return null
  let hasWarning = false
  for (const row of rows) {
    const sev = statusSeverity(row.status)
    if (sev === 'error') return 'error'
    if (sev === 'warning') hasWarning = true
  }
  return hasWarning ? 'warning' : null
}
