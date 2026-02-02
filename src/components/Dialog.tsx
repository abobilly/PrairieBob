import { useCallback, useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/Modal'

export interface DialogProps {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'default' | 'destructive'
}

interface DialogRequest {
  id: string
  options: DialogProps
  resolve: (value: boolean) => void
}

interface DialogState {
  active: DialogRequest | null
  enqueue: (options: DialogProps) => Promise<boolean>
  resolveActive: (result: boolean) => void
  clearActive: () => void
}

let dialogCounter = 0

const useDialogStore = create<DialogState>((set, get) => ({
  active: null,
  enqueue: (options) => new Promise<boolean>((resolve) => {
    const request: DialogRequest = {
      id: `${Date.now()}-${dialogCounter++}`,
      options,
      resolve,
    }
    set({ active: request })
  }),
  resolveActive: (result) => {
    const active = get().active
    if (!active) return
    active.resolve(result)
    if (result) {
      active.options.onConfirm()
    } else {
      active.options.onCancel()
    }
    set({ active: null })
  },
  clearActive: () => set({ active: null }),
}))

export function useDialog() {
  const enqueue = useDialogStore((s) => s.enqueue)
  return useMemo(() => ({
    confirm: (options: DialogProps) => enqueue(options),
  }), [enqueue])
}

export function DialogContainer() {
  const active = useDialogStore((s) => s.active)
  const resolveActive = useDialogStore((s) => s.resolveActive)
  const clearActive = useDialogStore((s) => s.clearActive)

  const handleClose = useCallback(() => {
    if (!active) return
    resolveActive(false)
  }, [active, resolveActive])

  useEffect(() => {
    return () => clearActive()
  }, [clearActive])

  if (!active) return null

  const {
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
  } = active.options

  return (
    <Modal isOpen={true} onClose={handleClose} title={title} size="sm">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => resolveActive(false)}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={() => resolveActive(true)}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
