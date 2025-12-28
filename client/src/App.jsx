import React, { useEffect, useMemo, useRef, useState } from 'react'
import Editor from './components/Editor.jsx'
import { socket } from './services/socket.js'
import { suggest, saveDoc, getHistory, sendJoinRequest, getPendingRequests, approveJoinRequest } from './services/api.js'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import Toast from './components/Toast.jsx'
import Register from './pages/Register.jsx'
import Login from './pages/Login.jsx'
import Landing from './pages/Landing.jsx'
import Rooms from './pages/Rooms.jsx'

function decodeJWT(token) {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload))
    return decoded
  } catch {
    return {}
  }
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('App ErrorBoundary caught:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#ef4444', background: '#0b0f14', minHeight: '100vh' }}>
          <h2>Something went wrong.</h2>
          <pre>{this.state.error?.toString()}</pre>
          <button onClick={() => window.location.reload()} className="btn btn-primary">Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  console.log('App render start')
  const [authView, setAuthView] = useState('login')
  const [token, setToken] = useState(() => {
    const storedToken = localStorage.getItem('token')
    console.log('Initial token from localStorage:', storedToken)
    return storedToken || ''
  })
  const [user, setUser] = useState(() => {
    const storedToken = localStorage.getItem('token')
    return storedToken ? decodeJWT(storedToken) : {}
  })
  const [showRooms, setShowRooms] = useState(() => {
    return !!localStorage.getItem('token')
  })
  const [docId, setDocId] = useState('demo');
  const [username, setUsername] = useState(() => 'user-' + Math.floor(Math.random()*1000));
  const [users, setUsers] = useState([]);
  const [version, setVersion] = useState(0);
  const [content, setContent] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [completionText, setCompletionText] = useState('');
  const [language, setLanguage] = useState('javascript');
  const editorRef = useRef(null);
  const [yDoc, setYDoc] = useState(null)
  const [yProvider, setYProvider] = useState(null)
  const [toasts, setToasts] = useState([])
  const [ownerRequests, setOwnerRequests] = useState([])
  const [showOwnerRequests, setShowOwnerRequests] = useState(false)

  const pushToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, type, duration }])
  }
  const removeToast = (id) => setToasts((t) => t.filter(x => x.id !== id))

  const handleAuth = (result) => {
    console.log('handleAuth called with:', result)
    if (result === 'register' || result === 'login') {
      setAuthView(result)
    } else if (typeof result === 'string') {
      console.log('Setting token, switching to rooms')
      localStorage.setItem('token', result)
      setToken(result)
      const decoded = decodeJWT(result)
      console.log('Decoded token:', decoded)
      setUser(decoded)
      setShowRooms(true) // Show rooms page after login
    }
  }

  const handleJoinRoom = (roomId) => {
    const nextDocId = (roomId || 'demo').trim() || 'demo'
    try { yProvider?.destroy?.() } catch {}
    try { yDoc?.destroy?.() } catch {}
    setYProvider(null)
    setYDoc(null)
    setUsers([])
    setVersion(0)
    setContent('')
    setSuggestions('')
    setCompletionText('')
    setDocId(nextDocId)
    setShowRooms(false)
  }

  console.log('App render: token=', token, 'authView=', authView)

  const languageDocId = useMemo(() => {
    const base = (docId || 'demo').trim() || 'demo'
    const lang = (language || 'javascript').trim() || 'javascript'
    return `${base}::${lang}`
  }, [docId, language])

  const inEditor = !!token && !showRooms

  useEffect(() => {
    if (!inEditor) return
    const cleanDocId = (docId || 'demo').trim()
    let canceled = false

    const load = async () => {
      const resp = await getPendingRequests({ token, docId: cleanDocId })
      if (canceled) return
      if (resp?.pendingRequests) {
        setOwnerRequests(resp.pendingRequests)
      }
    }

    load()
    const interval = setInterval(load, 3000)
    return () => {
      canceled = true
      clearInterval(interval)
    }
  }, [inEditor, token, docId])

  useEffect(() => {
    if (!inEditor) return
    const cleanRoomId = (docId || 'demo').trim()
    const cleanDocId = languageDocId
    // Use logged-in username if available, otherwise fallback
    const cleanUsername = (user.username || username || '').trim() || 'user-' + Math.floor(Math.random()*1000)

    if (!socket.connected) socket.connect();

    const onConnect = () => {
      socket.emit('join', { docId: cleanDocId, userId: socket.id, username: cleanUsername, token, roomId: cleanRoomId, language });
    }
    socket.on('connect', onConnect)
    if (socket.connected) onConnect()

    socket.on('init', ({ content, version, users }) => {
      setContent(content);
      setVersion(version);
      setUsers(users);
      // Setup Yjs binding for this docId
      try {
        // Cleanup previous
        yProvider?.destroy?.();
        yDoc?.destroy?.();
      } catch {}
      const doc = new Y.Doc()
      const base = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'
      const wsBase = base.replace('http://', 'ws://').replace('https://', 'wss://')
      const provider = new WebsocketProvider(wsBase, 'yjs/' + cleanDocId, doc)
      setYDoc(doc)
      setYProvider(provider)
    });
    socket.on('user-join', (u) => setUsers((prev) => [...prev, u]));
    socket.on('user-leave', (u) => setUsers((prev) => prev.filter(p => p.userId !== u.userId)));
    socket.on('cursor', (data) => {
      // Could render remote cursors; for brevity we skip visual layer here
      console.debug('Remote cursor', data);
    });
    // Removed auto-editing 'op' listener to prevent unwanted changes
    socket.on('resync', ({ content, version }) => {
      setContent(content);
      setVersion(version);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      try { yProvider?.destroy?.(); } catch {}
      try { yDoc?.destroy?.(); } catch {}
    }
  }, [docId, languageDocId, language, user, token, inEditor]);

  const sendDelta = (delta) => {
    // No-op when Yjs active; Editor stops emitting in that case.
    if (yDoc && yProvider) return
    const cleanDocId = languageDocId
    socket.emit('op', { docId: cleanDocId, version, delta, source: socket.id });
  }

  const askAI = async () => {
    const code = editorRef.current?.getValue?.() ?? content;
    const cursor = editorRef.current?.getPosition?.()?.column ?? 0;
    const resp = await suggest({ code, cursor, language });
    setSuggestions(resp?.choices?.[0]?.text || JSON.stringify(resp));
    const text = resp?.choices?.[0]?.text || ''
    // take first fenced code block or fallback
    const match = text.match(/```[a-zA-Z]*\n([\s\S]*?)```/)
    setCompletionText(match ? match[1].trim() : text.slice(0, 200))
  }

  // Autosave on idle (3s) and every 30s if token is present
  useEffect(() => {
    if (!inEditor) return
    const handler = setTimeout(async () => {
      const text = editorRef.current?.getValue?.() ?? content
      await saveDoc({ token, docId: languageDocId, content: text })
    }, 3000)
    return () => clearTimeout(handler)
  }, [content, token, docId, languageDocId, inEditor])

  useEffect(() => {
    if (!inEditor) return
    const interval = setInterval(async () => {
      const text = editorRef.current?.getValue?.() ?? content
      await saveDoc({ token, docId: languageDocId, content: text })
    }, 30000)
    return () => clearInterval(interval)
  }, [token, docId, languageDocId, content, inEditor])

  console.log('View state:', { token: !!token, showRooms, inEditor, authView })

  if (!token) {
    console.log('No token, showing auth page')
    return (
      <ErrorBoundary>
        {authView === 'register' ? (
          <Register onAuth={handleAuth} />
        ) : authView === 'login' ? (
          <Login onAuth={handleAuth} />
        ) : (
          <Landing onAuth={handleAuth} />
        )}
      </ErrorBoundary>
    )
  }

  if (showRooms) {
    return (
      <ErrorBoundary>
        <Rooms user={user} token={token} onJoinRoom={handleJoinRoom} />
      </ErrorBoundary>
    )
  }

  console.log('Token present, rendering editor')

  return (
    <ErrorBoundary>
      <div className="app">
        <header className="app-header">
          <section className="header-section">
            <div className="stack-row">
              <input placeholder="docId" value={docId} onChange={(e)=>setDocId(e.target.value)} />
              <input placeholder="username" value={user.username || username} onChange={(e)=>setUsername(e.target.value)} readOnly={!!user.username} />
              <select value={language} onChange={(e)=>setLanguage(e.target.value)}>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="c">C</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
                <option value="go">Go</option>
              </select>
              <button className="btn btn-primary" onClick={async()=>{
                const cleanDocId = (docId || 'demo').trim()
                const cleanUsername = (user.username || username || '').trim() || 'user-' + Math.floor(Math.random()*1000)
                try {
                  // Send join request first
                  const resp = await sendJoinRequest({ token, docId: cleanDocId })
                  if (resp?.ok) {
                    pushToast('Join request accepted', 'success')
                  } else if (resp?.error) {
                    pushToast(resp.error, 'error')
                    return
                  }
                } catch (e) {
                  console.error('Join request failed:', e)
                  // Continue anyway for demo docs or if MongoDB is down
                }
                // Connect to the room
                if (!socket.connected) {
                  socket.connect()
                  socket.once('connect', () => socket.emit('join', { docId: `${cleanDocId}::${language}`, userId: socket.id, username: cleanUsername, token, roomId: cleanDocId, language }))
                } else {
                  socket.emit('join', { docId: `${cleanDocId}::${language}`, userId: socket.id, username: cleanUsername, token, roomId: cleanDocId, language })
                }
              }}>Join</button>
            </div>
          </section>
          <section className="header-section header-center">
            <div className="muted">Users: {users.map(u=>u.username).join(', ')}</div>
            <div className="muted">Version: {version}</div>
          </section>
          <section className="header-section header-end">
          <div className="user-info">Welcome, {user.username || 'User'}</div>
          <div className="stack-row">
            <div className="requests-wrap">
              <button
                className="btn btn-outline requests-btn"
                onClick={() => setShowOwnerRequests((v) => !v)}
                title="Join requests"
              >
                Requests
                {ownerRequests?.length ? <span className="badge">{ownerRequests.length}</span> : null}
              </button>
              {showOwnerRequests && ownerRequests?.length ? (
                <div className="requests-popover">
                  <div className="requests-title">Pending Join Requests</div>
                  {ownerRequests.map((r) => (
                    <div key={r.email} className="requests-item">
                      <div className="requests-meta">
                        <div className="requests-name">{r.username}</div>
                        <div className="requests-email">{r.email}</div>
                      </div>
                      <div className="requests-actions">
                        <button className="btn btn-primary" onClick={async () => {
                          const resp = await approveJoinRequest({ token, docId: (docId || 'demo').trim(), requesterEmail: r.email, approve: true })
                          if (resp?.ok) pushToast('Approved', 'success')
                          else pushToast(resp?.error || 'Approve failed', 'error')
                          const refreshed = await getPendingRequests({ token, docId: (docId || 'demo').trim() })
                          if (refreshed?.pendingRequests) setOwnerRequests(refreshed.pendingRequests)
                        }}>Approve</button>
                        <button className="btn btn-outline" onClick={async () => {
                          const resp = await approveJoinRequest({ token, docId: (docId || 'demo').trim(), requesterEmail: r.email, approve: false })
                          if (resp?.ok) pushToast('Declined', 'info')
                          else pushToast(resp?.error || 'Decline failed', 'error')
                          const refreshed = await getPendingRequests({ token, docId: (docId || 'demo').trim() })
                          if (refreshed?.pendingRequests) setOwnerRequests(refreshed.pendingRequests)
                        }}>Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <button className="btn btn-outline" onClick={() => setShowRooms(true)}>Rooms</button>
            <button className="btn btn-outline" onClick={async()=>{
              const text = editorRef.current?.getValue?.() ?? content
              const resp = await saveDoc({ token, docId: languageDocId, content: text })
              if (resp?.ok) pushToast('Saved successfully', 'success')
              else pushToast(resp?.error || 'Save failed', 'error')
            }}>Save</button>
            <button className="btn btn-outline" onClick={async()=>{
              const resp = await getHistory({ token, docId: languageDocId })
              if (resp?.history) pushToast(`Versions: ${resp.history.length}`, 'info')
              else pushToast(resp?.error || 'No history', 'error')
            }}>History</button>
            <button className="btn btn-outline" onClick={() => {
              localStorage.removeItem('token')
              setToken('')
              setUser({})
              setShowRooms(false)
              socket.disconnect()
            }}>Logout</button>
          </div>
        </section>
        </header>
        <main>
          <div className="editor">
            <Editor
              key={languageDocId}
              value={content}
              language={language}
              completionText={completionText}
              yDoc={yDoc}
              yProvider={yProvider}
              onChange={(delta)=> sendDelta(delta)}
              onCursor={(payload)=> socket.emit('cursor', payload)}
              onMount={(editor)=> editorRef.current = editor}
            />
          </div>
          <aside className="panel">
            <div className="stack">
              <button className="btn btn-primary" onClick={askAI}>Ask AI</button>
            </div>
            <pre>{suggestions}</pre>
          </aside>
        </main>
        <div className="toasts">
          {toasts.map(t => (
            <Toast key={t.id} id={t.id} message={t.message} type={t.type} duration={t.duration} onClose={removeToast} />
          ))}
        </div>
      </div>
    </ErrorBoundary>
  )
}
