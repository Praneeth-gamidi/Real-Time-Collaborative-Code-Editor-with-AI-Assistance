const envBase = import.meta.env.VITE_SERVER_URL
function resolveBase() {
  let base = envBase || 'http://localhost:4000'
  // already has protocol
  if (/^https?:\/\//i.test(base)) return base
  // starts with //host:port -> prefix current protocol
  if (typeof window !== 'undefined' && base.startsWith('//')) return `${window.location.protocol}${base}`
  // starts with :port (e.g. ":4000") -> assume localhost
  if (typeof window !== 'undefined' && base.startsWith(':')) return `${window.location.protocol}//localhost${base}`
  // bare host or host:port -> prefix protocol
  if (!base.includes('://') && typeof window !== 'undefined') return `${window.location.protocol}//${base}`
  return base
}

export async function suggest({ language, code, cursor }) {
  const base = resolveBase()
  const resp = await fetch(base + '/ai/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, code, cursor })
  })
  return resp.json()
}

export async function register({ email, password, username }) {
  const base = resolveBase()
  const resp = await fetch(base + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, username })
  })
  return resp.json()
}

export async function login({ email, password }) {
  const base = resolveBase()
  try {
    const resp = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await resp.json()
    if (!resp.ok) {
      throw new Error(data.error || `HTTP ${resp.status}`)
    }
    return data
  } catch (error) {
    console.error('Login API error:', error)
    return { error: error.message }
  }
}

export async function saveDoc({ token, docId, content }) {
  const base = resolveBase()
  const resp = await fetch(base + '/docs/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ docId, content })
  })
  return resp.json()
}

export async function invite({ token, docId, email }) {
  const base = resolveBase()
  const resp = await fetch(base + '/docs/invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ docId, email })
  })
  return resp.json()
}

export async function sendJoinRequest({ token, docId }) {
  const base = resolveBase()
  const resp = await fetch(base + '/docs/request-join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ docId })
  })
  return resp.json()
}

export async function getPendingRequests({ token, docId }) {
  const base = resolveBase()
  const url = new URL(base + '/docs/pending-requests')
  url.searchParams.set('docId', docId)
  try {
    const resp = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`)
    return data
  } catch (e) {
    return { error: e.message }
  }
}

export async function approveJoinRequest({ token, docId, requesterEmail, approve }) {
  const base = resolveBase()
  try {
    const resp = await fetch(base + '/docs/approve-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ docId, requesterEmail, approve })
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`)
    return data
  } catch (e) {
    return { error: e.message }
  }
}

export async function getAccessStatus({ token, docId }) {
  const base = resolveBase()
  const url = new URL(base + '/docs/access-status')
  url.searchParams.set('docId', docId)
  try {
    const resp = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`)
    return data
  } catch (e) {
    return { error: e.message }
  }
}

export async function getHistory({ token, docId }) {
  const base = resolveBase()
  const url = new URL(base + '/docs/history')
  url.searchParams.set('docId', docId)
  const resp = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return resp.json()
}
