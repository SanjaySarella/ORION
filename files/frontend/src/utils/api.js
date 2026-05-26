const BASE = '/api'

export async function analyzeCompany(query) {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Analysis failed (${res.status})`)
  }
  return res.json()
}

export async function searchCompanies(q) {
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

export async function sendChat(ticker, role, message, history = []) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_ticker: ticker, role, message, history }),
  })
  if (!res.ok) throw new Error('Chat failed')
  return res.json()
}

export function getFlagColor(flag) {
  if (flag === 'critical') return 'var(--red)'
  if (flag === 'watch')    return 'var(--amber)'
  return 'var(--green-mid)'
}

export function getScoreColor(score) {
  if (score >= 75) return 'var(--red)'
  if (score >= 50) return 'var(--amber)'
  if (score >= 25) return '#D97706'
  return 'var(--green-mid)'
}