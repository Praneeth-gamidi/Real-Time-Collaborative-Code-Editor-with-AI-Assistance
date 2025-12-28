import React from 'react'

export default function Landing({ onAuth }) {
  return (
    <div className="landing-page">
      <div className="landing-content">
        <h1 className="landing-title">Real-Time Collaborative Code Editor</h1>
        <p className="landing-subtitle">
          Code together, in real-time, with AI assistance. Share documents, see live cursors,
          and get instant suggestions powered by modern language models.
        </p>
        <div className="landing-actions">
          <button className="btn btn-primary btn-large" onClick={() => onAuth('login')}>Sign In</button>
          <button className="btn btn-outline btn-large" onClick={() => onAuth('register')}>Create Account</button>
        </div>
        <ul className="landing-features">
          <li>Live collaborative editing</li>
          <li>Syntax highlighting for many languages</li>
          <li>AI-powered code suggestions</li>
          <li>Document history and versioning</li>
          <li>Real-time cursors and user presence</li>
        </ul>
      </div>
    </div>
  )
}
