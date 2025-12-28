import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor'
import { MonacoBinding } from 'y-monaco'
import * as Y from 'yjs'

export default function Editor({ value, onChange, onMount, onCursor, language = 'javascript', completionText = '', yDoc = null, yProvider = null, yField = 'monaco' }) {
  const divRef = useRef(null)
  const editorRef = useRef(null)
  const applyingRemote = useRef(false)
  const completionRef = useRef(completionText)
  const yBindingRef = useRef(null)

  useEffect(() => {
    editorRef.current = monaco.editor.create(divRef.current, {
      value,
      language,
      automaticLayout: true,
      theme: 'vs-dark',
      fontSize: 14,
      minimap: { enabled: false },
    })

    onMount?.(editorRef.current)

    const disposes = []

    // Inline AI completion provider
    const provider = monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: () => {
        const text = (completionRef.current || '').trim()
        if (!text) return { suggestions: [] }
        return {
          suggestions: [
            {
              label: 'AI Suggestion',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: text,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range: editorRef.current.getSelection(),
            },
          ],
        }
      },
      triggerCharacters: ['.', '(', ',', ' ', '\n'],
    })
    disposes.push(provider)

    // If Yjs is active, we do not emit manual deltas
    if (!yDoc || !yProvider) {
      disposes.push(editorRef.current.onDidChangeModelContent((e) => {
        if (applyingRemote.current) return
        const edits = e.changes?.[0]
        if (!edits) return
        const start = edits.rangeOffset
        const end = edits.rangeOffset + edits.rangeLength
        const delta = { type: 'replace', range: [start, end], text: edits.text }
        onChange?.(delta)
      }))
    }

    disposes.push(editorRef.current.onDidChangeCursorPosition((e)=>{
      const pos = e.position
      const selection = editorRef.current.getSelection()
      const payload = { position: pos, selection }
      onCursor?.(payload)
    }))

    return () => {
      disposes.forEach(d=>d.dispose())
      editorRef.current?.dispose()
    }
  }, [])

  // Setup/teardown Yjs binding when yDoc/yProvider change
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (yBindingRef.current) {
      yBindingRef.current.destroy()
      yBindingRef.current = null
    }
    if (yDoc && yProvider) {
      const model = editor.getModel()
      const yText = yDoc.getText(yField)
      yBindingRef.current = new MonacoBinding(yText, model, new Set([editor]), yProvider.awareness)
    }
    return () => {
      if (yBindingRef.current) {
        yBindingRef.current.destroy()
        yBindingRef.current = null
      }
    }
  }, [yDoc, yProvider, yField])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const model = editor.getModel()
    const current = model.getValue()
    if (current === value) return

    // apply remote update
    applyingRemote.current = true
    const fullRange = model.getFullModelRange()
    editor.executeEdits('remote', [{ range: fullRange, text: value }])
    applyingRemote.current = false
  }, [value])

  // Update model language when prop changes
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const model = editor.getModel()
    if (model) monaco.editor.setModelLanguage(model, language)
  }, [language])

  // Keep latest completion text
  useEffect(() => {
    completionRef.current = completionText
  }, [completionText])

  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />
}
