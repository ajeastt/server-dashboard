import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { createWS } from '../lib/api'

export default function Terminal({ containerId }) {
  const termRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => {
    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
      theme: {
        background: '#020617',
        foreground: '#e2e8f0',
        cursor: '#6366f1',
        selectionBackground: '#334155',
        black: '#0f172a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#6366f1',
        magenta: '#a855f7',
        cyan: '#22d3ee',
        white: '#e2e8f0',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#818cf8',
        brightMagenta: '#c084fc',
        brightCyan: '#67e8f9',
        brightWhite: '#f8fafc',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termRef.current)

    requestAnimationFrame(() => fitAddon.fit())

    const ws = createWS()
    wsRef.current = ws

    ws.on('terminal-output', (msg) => {
      term.write(atob(msg.data))
    })
    ws.on('terminal-end', () => {
      term.write('\r\n\x1b[31m[process exited]\x1b[0m\r\n')
    })
    ws.on('terminal-error', (msg) => {
      term.write(`\r\n\x1b[31m[error: ${msg.error}]\x1b[0m\r\n`)
    })

    term.onData((data) => {
      ws.send({ type: 'terminal-input', data })
    })

    term.onResize(({ cols, rows }) => {
      ws.send({ type: 'terminal-resize', cols, rows })
    })

    const dims = { cols: term.cols, rows: term.rows }
    ws.send({ type: 'terminal', container: containerId, ...dims })

    const resizeObserver = new ResizeObserver(() => {
      try { fitAddon.fit() } catch {}
    })
    resizeObserver.observe(termRef.current)

    return () => {
      ws.send({ type: 'terminal-stop' })
      ws.close()
      term.dispose()
      resizeObserver.disconnect()
    }
  }, [containerId])

  return (
    <div
      ref={termRef}
      className="rounded-xl border border-surface-800 overflow-hidden"
      style={{ height: '480px' }}
    />
  )
}
