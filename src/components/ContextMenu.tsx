import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

export interface ContextMenuItem {
  label: string
  icon?: ReactNode
  action?: () => void
  disabled?: boolean
  separator?: boolean
}

export interface ContextMenuProps {
  items: ContextMenuItem[]
  x: number
  y: number
  onClose: () => void
}

const isSelectableItem = (item: ContextMenuItem) => !item.separator && !item.disabled

const getNextIndex = (
  items: ContextMenuItem[],
  startIndex: number,
  direction: 1 | -1
) => {
  if (!items.length) return -1
  let index = startIndex
  for (let i = 0; i < items.length; i += 1) {
    index = (index + direction + items.length) % items.length
    if (isSelectableItem(items[index])) {
      return index
    }
  }
  return -1
}

export function ContextMenu({ items, x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(() => getNextIndex(items, -1, 1))

  useEffect(() => {
    setActiveIndex(getNextIndex(items, -1, 1))
  }, [items])

  useEffect(() => {
    menuRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleOutsidePointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleOutsideContextMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleOutsidePointer)
    document.addEventListener('contextmenu', handleOutsideContextMenu)
    return () => {
      document.removeEventListener('mousedown', handleOutsidePointer)
      document.removeEventListener('contextmenu', handleOutsideContextMenu)
    }
  }, [onClose])

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => getNextIndex(items, prev, 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => getNextIndex(items, prev, -1))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const activeItem = items[activeIndex]
      if (activeItem && isSelectableItem(activeItem)) {
        activeItem.action?.()
        onClose()
      }
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }, [activeIndex, items, onClose])

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      className="bg-popover text-popover-foreground fixed z-50 min-w-[12rem] rounded-md border p-1 shadow-md outline-none"
      style={{ left: x, top: y }}
      onKeyDown={handleKeyDown}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return (
            <div
              key={`separator-${index}`}
              role="separator"
              className="bg-border pointer-events-none -mx-1 my-1 h-px"
            />
          )
        }

        const isActive = index === activeIndex

        return (
          <button
            key={`${item.label}-${index}`}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (!isSelectableItem(item)) return
              item.action?.()
              onClose()
            }}
            onMouseEnter={() => {
              if (isSelectableItem(item)) {
                setActiveIndex(index)
              }
            }}
            className={cn(
              "flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none",
              "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
              "disabled:pointer-events-none disabled:opacity-50",
              isActive && "bg-accent text-accent-foreground"
            )}
          >
            {item.icon ? (
              <span className="flex size-4 items-center justify-center text-muted-foreground [&_svg]:size-4">
                {item.icon}
              </span>
            ) : null}
            <span className="flex-1">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
