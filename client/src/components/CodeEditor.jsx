import { useRef, useEffect } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { yaml } from '@codemirror/lang-yaml'
import { oneDark } from '@codemirror/theme-one-dark'

export default function CodeEditor({ value, onChange, lang, placeholder, minHeight = '300px' }) {
  const ref = useRef(null)
  const viewRef = useRef(null)

  useEffect(() => {
    if (!ref.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString())
      }
    })

    const extensions = [
      basicSetup,
      oneDark,
      updateListener,
      EditorView.theme({
        '&': { fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)', fontSize: '13px' },
        '.cm-scroller': { minHeight },
        '.cm-editor': { borderRadius: '0.5rem', border: '1px solid rgba(30, 30, 44, 0.6)' },
        '.cm-focused': { outline: 'none', border: '1px solid rgba(6, 182, 212, 0.4)' },
        '.cm-gutters': { borderRight: '1px solid rgba(30, 30, 44, 0.4)' },
      }),
    ]

    if (lang === 'yaml') {
      extensions.push(yaml())
    }

    const state = EditorState.create({
      doc: value || '',
      extensions,
    })

    viewRef.current = new EditorView({ state, parent: ref.current })

    return () => viewRef.current.destroy()
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (value !== undefined && value !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value || '' },
      })
    }
  }, [value])

  return <div ref={ref} className="rounded-lg overflow-hidden" />
}
