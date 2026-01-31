/**
 * LDtk Tool Registry
 * Ported from LDtk/src/electron.renderer/Tool.hx (tool IDs)
 */

export interface ToolDefinition {
    id: string
    name: string
    icon: string
    shortcut?: string
    category: 'layer' | 'navigation' | 'selection'
}

export class ToolRegistry {
    private tools = new Map<string, ToolDefinition>()

    register(tool: ToolDefinition): void {
        this.tools.set(tool.id, tool)
    }

    getTool(id: string): ToolDefinition | undefined {
        return this.tools.get(id)
    }

    getToolsByCategory(category: ToolDefinition['category']): ToolDefinition[] {
        return Array.from(this.tools.values()).filter((tool) => tool.category === category)
    }

    getAllTools(): ToolDefinition[] {
        return Array.from(this.tools.values())
    }
}

export const toolRegistry = new ToolRegistry()

toolRegistry.register({
    id: 'tile',
    name: 'Tile',
    icon: 'tile',
    shortcut: 'T',
    category: 'layer',
})

toolRegistry.register({
    id: 'entity',
    name: 'Entity',
    icon: 'entity',
    shortcut: 'E',
    category: 'layer',
})

toolRegistry.register({
    id: 'intgrid',
    name: 'IntGrid',
    icon: 'intgrid',
    shortcut: 'I',
    category: 'layer',
})

toolRegistry.register({
    id: 'pan',
    name: 'Pan',
    icon: 'pan',
    shortcut: 'Space',
    category: 'navigation',
})

toolRegistry.register({
    id: 'select',
    name: 'Select',
    icon: 'select',
    shortcut: 'S',
    category: 'selection',
})
