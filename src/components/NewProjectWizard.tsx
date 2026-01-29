/**
 * NewProjectWizard - Create new project dialog
 * 
 * Basic mode: project name + folder picker
 * Advanced mode: tile size, map dimensions, layer presets
 */

import { useState, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select';
import { Separator } from './ui/separator';
import {
    ChevronDown,
    ChevronRight,
    FolderOpen,
    Sparkles,
} from 'lucide-react';
import { useUIStore, useProjectStore } from '@/stores';
import { toast } from 'sonner';

interface ProjectSettings {
    name: string;
    path: string;
    tileSize: number;
    mapWidth: number;
    mapHeight: number;
    layerPreset: 'standard' | 'minimal' | 'platformer';
}

const LAYER_PRESETS = {
    standard: ['Floor', 'Walls', 'Trim', 'Overlays', 'Collision', 'Entities'],
    minimal: ['Background', 'Main', 'Foreground', 'Entities'],
    platformer: ['Background', 'Platforms', 'Decorations', 'Hazards', 'Entities'],
};

export function NewProjectWizard() {
    const { showNewProjectWizard, closeNewProjectWizard } = useUIStore();
    const { createNewProject } = useProjectStore();

    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [settings, setSettings] = useState<ProjectSettings>({
        name: 'My Project',
        path: '',
        tileSize: 32,
        mapWidth: 20,
        mapHeight: 15,
        layerPreset: 'standard',
    });

    const handleSelectFolder = useCallback(async () => {
        if (!window.electron) {
            toast.error('Requires Electron environment');
            return;
        }

        const result = await window.electron.dialog.openDirectory();
        if (!result.canceled && result.filePath) {
            setSettings(prev => ({ ...prev, path: result.filePath! }));
        }
    }, []);

    const handleCreate = useCallback(async () => {
        if (!settings.name.trim()) {
            toast.error('Please enter a project name');
            return;
        }
        if (!settings.path) {
            toast.error('Please select a project folder');
            return;
        }

        setIsCreating(true);
        try {
            await createNewProject({
                name: settings.name.trim(),
                path: settings.path,
                tileSize: settings.tileSize,
                mapWidth: settings.mapWidth,
                mapHeight: settings.mapHeight,
                layers: LAYER_PRESETS[settings.layerPreset],
            });
            closeNewProjectWizard();
            toast.success(`Created project: ${settings.name}`);
        } catch (error) {
            toast.error(`Failed to create project: ${error}`);
        } finally {
            setIsCreating(false);
        }
    }, [settings, createNewProject, closeNewProjectWizard]);

    return (
        <Dialog open={showNewProjectWizard} onOpenChange={(open) => !open && closeNewProjectWizard()}>
            <DialogContent className="sm:max-w-[480px] bg-[#1a1a2e] border-[#2a2a4a] text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-[#f97316]" />
                        New Project
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Create a new tile map project
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Project Name */}
                    <div className="grid gap-2">
                        <Label htmlFor="name">Project Name</Label>
                        <Input
                            id="name"
                            value={settings.name}
                            onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="My Awesome Game"
                            className="bg-[#12121f] border-[#2a2a4a] text-white"
                        />
                    </div>

                    {/* Project Folder */}
                    <div className="grid gap-2">
                        <Label>Project Folder</Label>
                        <div className="flex gap-2">
                            <Input
                                value={settings.path}
                                readOnly
                                placeholder="Select a folder..."
                                className="bg-[#12121f] border-[#2a2a4a] text-white flex-1"
                            />
                            <Button
                                variant="outline"
                                onClick={handleSelectFolder}
                                className="bg-[#12121f] border-[#2a2a4a] hover:bg-[#2a2a4a]"
                            >
                                <FolderOpen className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                            A project.json and folder structure will be created here
                        </p>
                    </div>

                    <Separator className="bg-[#2a2a4a]" />

                    {/* Advanced Settings Toggle */}
                    <Button
                        variant="ghost"
                        className="justify-start px-0 hover:bg-transparent text-gray-400 hover:text-white"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        {showAdvanced ? (
                            <ChevronDown className="h-4 w-4 mr-2" />
                        ) : (
                            <ChevronRight className="h-4 w-4 mr-2" />
                        )}
                        Advanced Settings
                    </Button>

                    {/* Advanced Settings */}
                    {showAdvanced && (
                        <div className="grid gap-4 pl-4 border-l-2 border-[#2a2a4a]">
                            {/* Tile Size */}
                            <div className="grid gap-2">
                                <Label>Tile Size</Label>
                                <Select
                                    value={String(settings.tileSize)}
                                    onValueChange={(v) => setSettings(prev => ({ ...prev, tileSize: Number(v) }))}
                                >
                                    <SelectTrigger className="bg-[#12121f] border-[#2a2a4a]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1a1a2e] border-[#2a2a4a]">
                                        <SelectItem value="16">16×16 pixels</SelectItem>
                                        <SelectItem value="32">32×32 pixels</SelectItem>
                                        <SelectItem value="48">48×48 pixels</SelectItem>
                                        <SelectItem value="64">64×64 pixels</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Map Dimensions */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-2">
                                    <Label>Map Width (tiles)</Label>
                                    <Input
                                        type="number"
                                        min={5}
                                        max={200}
                                        value={settings.mapWidth}
                                        onChange={(e) => setSettings(prev => ({ ...prev, mapWidth: Number(e.target.value) || 20 }))}
                                        className="bg-[#12121f] border-[#2a2a4a] text-white"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Map Height (tiles)</Label>
                                    <Input
                                        type="number"
                                        min={5}
                                        max={200}
                                        value={settings.mapHeight}
                                        onChange={(e) => setSettings(prev => ({ ...prev, mapHeight: Number(e.target.value) || 15 }))}
                                        className="bg-[#12121f] border-[#2a2a4a] text-white"
                                    />
                                </div>
                            </div>

                            {/* Layer Preset */}
                            <div className="grid gap-2">
                                <Label>Layer Preset</Label>
                                <Select
                                    value={settings.layerPreset}
                                    onValueChange={(v) => setSettings(prev => ({ ...prev, layerPreset: v as ProjectSettings['layerPreset'] }))}
                                >
                                    <SelectTrigger className="bg-[#12121f] border-[#2a2a4a]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#1a1a2e] border-[#2a2a4a]">
                                        <SelectItem value="standard">Standard RPG (6 layers)</SelectItem>
                                        <SelectItem value="minimal">Minimal (4 layers)</SelectItem>
                                        <SelectItem value="platformer">Platformer (5 layers)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500">
                                    {LAYER_PRESETS[settings.layerPreset].join(' → ')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={closeNewProjectWizard}
                        className="bg-[#12121f] border-[#2a2a4a] hover:bg-[#2a2a4a]"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={isCreating || !settings.name.trim() || !settings.path}
                        className="bg-[#f97316] hover:bg-[#ea580c]"
                    >
                        {isCreating ? 'Creating...' : 'Create Project'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
