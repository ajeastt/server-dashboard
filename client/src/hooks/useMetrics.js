import { useState, useEffect, useRef } from 'react'
import { connectMetrics } from '../lib/api'

export function useMetrics() {
  const [metrics, setMetrics] = useState(null)
  const [history, setHistory] = useState({ cpu: [], mem: [], timestamps: [] })
  const historyRef = useRef(history)

  useEffect(() => {
    const unsub = connectMetrics((data) => {
      setMetrics(data)

      const h = historyRef.current
      const maxLen = 60
      const newCpu = [...h.cpu.slice(-maxLen + 1), data.cpu.usage]
      const newMem = [...h.mem.slice(-maxLen + 1), data.memory.percent]
      const newTs = [...h.timestamps.slice(-maxLen + 1), data.timestamp]

      const next = { cpu: newCpu, mem: newMem, timestamps: newTs }
      historyRef.current = next
      setHistory(next)
    })

    return unsub
  }, [])

  return { metrics, history }
}
