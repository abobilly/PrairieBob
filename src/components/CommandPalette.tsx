import { Fragment, useEffect, useMemo, useState } from "react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Dialog, DialogContent } from "@/components/ui/dialog"

export interface Command {
  id: string
  label: string
  shortcut?: string
  action: () => void
  category?: string
}

const COMMANDS: Command[] = [
  {
    id: "new-level",
    label: "New Level",
    shortcut: "Ctrl+N",
    category: "File",
    action: () => {
      console.log("New Level")
    },
  },
  {
    id: "save",
    label: "Save",
    shortcut: "Ctrl+S",
    category: "File",
    action: () => {
      console.log("Save")
    },
  },
  {
    id: "export",
    label: "Export",
    shortcut: "Ctrl+E",
    category: "File",
    action: () => {
      console.log("Export")
    },
  },
]

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const matchesQuery = (command: Command, searchParts: string[]) => {
  if (searchParts.length === 0) {
    return true
  }

  const keywords = normalize(
    [command.label, command.category, command.shortcut, command.id]
      .filter(Boolean)
      .join(" ")
  )

  return searchParts.every((part) => keywords.includes(part))
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (!open) {
      setQuery("")
    }
  }, [open])

  const filteredCommands = useMemo(() => {
    const normalizedQuery = normalize(query)
    const parts = normalizedQuery ? normalizedQuery.split(" ") : []

    return COMMANDS.filter((command) => matchesQuery(command, parts))
  }, [query])

  const groupedCommands = useMemo(() => {
    const groups = new Map<string, Command[]>()

    for (const command of filteredCommands) {
      const category = command.category ?? "General"
      const group = groups.get(category)

      if (group) {
        group.push(command)
      } else {
        groups.set(category, [command])
      }
    }

    return Array.from(groups.entries())
  }, [filteredCommands])

  const handleSelect = (command: Command) => {
    setOpen(false)
    command.action()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a command or search..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No commands found.</CommandEmpty>
            {groupedCommands.map(([category, commands], groupIndex) => (
              <Fragment key={category}>
                <CommandGroup heading={category}>
                  {commands.map((command) => (
                    <CommandItem
                      key={command.id}
                      value={command.label}
                      onSelect={() => handleSelect(command)}
                    >
                      <span>{command.label}</span>
                      {command.shortcut ? (
                        <CommandShortcut>{command.shortcut}</CommandShortcut>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {groupIndex < groupedCommands.length - 1 ? (
                  <CommandSeparator />
                ) : null}
              </Fragment>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
