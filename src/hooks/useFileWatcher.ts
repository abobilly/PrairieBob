import { useEffect, useRef } from 'react'

export interface FileWatcherChange {
  path: string
  eventType: 'change' | 'rename'
}

interface UseFileWatcherOptions {
  rootPath: string | null
  onFilesChanged: (changes: FileWatcherChange[]) => void
  debounceMs?: number
  enabled?: boolean
}

export function useFileWatcher({
  rootPath,
  onFilesChanged,
  debounceMs = 300,
  enabled = true,
}: UseFileWatcherOptions) {
  const onFilesChangedRef = useRef(onFilesChanged)

  useEffect(() => {
    onFilesChangedRef.current = onFilesChanged
  }, [onFilesChanged])

  useEffect(() => {
    if (!enabled || !rootPath || !window.electron) return
    const electron = window.electron

    const pendingChanges = new Map<string, FileWatcherChange>()
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const flush = () => {
      debounceTimer = null
      if (pendingChanges.size === 0) return
      const changes = Array.from(pendingChanges.values())
      pendingChanges.clear()
      onFilesChangedRef.current(changes)
    }

    const unsubscribe = electron.onProjectFileChanged((change) => {
      pendingChanges.set(change.path.toLowerCase(), change)
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(flush, debounceMs)
    })

    void electron.watcher.start(rootPath)

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      unsubscribe()
      void electron.watcher.stop()
    }
  }, [enabled, rootPath, debounceMs])
}
