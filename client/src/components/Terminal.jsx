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
        background: '#0b0b10',
        foreground: '#e4e4ed',
        cursor: '#06b6d4',
        selectionBackground: 'rgba(6, 182, 212, 0.25)',
        black: '#1e1e2c',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#06b6d4',
        magenta: '#a855f7',
        cyan: '#22d3ee',
        white: '#e4e4ed',
        brightBlack: '#5a5a6a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#22d3ee',
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

    ws.on('terminal-output', (msg) => term.write(atob(msg.data)))
    ws.on('terminal-end', () => term.write('\r\n\x1b[31m[process exited]\x1b[0m\r\n'))
    ws.on('terminal-error', (msg) => term.write(`\r\n\x1b[31m[error: ${msg.error}]\x1b[0m\r\n`))

    term.onData((data) => ws.send({ type: 'terminal-input', data }))
    term.onResize(({ cols, rows }) => ws.send({ type: 'terminal-resize', cols, rows }))

    ws.send({ type: 'terminal', container: containerId, cols: term.cols, rows: term.rows })

    const ro = new ResizeObserver(() => { try { fitAddon.fit() } catch {} })
    ro.observe(termRef.current)

    return () => { ws.send({ type: 'terminal-stop' }); ws.close(); term.dispose(); ro.disconnect() }
  }, [containerId])

  return <div ref={termRef} className="rounded-lg border border-base-700/50 overflow-hidden" style={{ height: '480px' }} />
}
