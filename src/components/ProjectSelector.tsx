/**
 * ProjectSelector - Startup dialog for opening/creating projects
 * 
 * Shows on startup with options to:
 * - Open recent projects
 * - Create new project
 * - Open existing folder
 * - Quick start with default tileset
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
    FolderOpen,
    Plus,
    Zap,
    Clock,
    Trash2,
    MapIcon,
    Link,
    Loader2,
} from 'lucide-react';
import { useUIStore, useProjectStore } from '@/stores';
import { detectKimbarRoot } from '@/lib/kimbar/registry';
import { toast } from 'sonner';

export function ProjectSelector() {
    const {
        showProjectSelector,
        recentProjects,
        theme,
        closeProjectSelector,
        openNewProjectWizard,
        removeRecentProject,
    } = useUIStore();

    const { loadProject, loadSampleProject } = useProjectStore();
    const [kimbarPath, setKimbarPath] = useState<string | null>(null);
    const [kimbarSearching, setKimbarSearching] = useState(false);
    const resolvedTheme = useMemo<'dark' | 'light'>(() => {
        if (theme === 'light' || theme === 'dark') return theme;
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        return 'dark';
    }, [theme]);
    const isLight = resolvedTheme === 'light';

    useEffect(() => {
        let active = true;
        const discoverKimbar = async () => {
            if (!showProjectSelector || !window.electron?.app?.getPaths) return;
            setKimbarSearching(true);
            try {
                const paths = await window.electron.app.getPaths();
                const candidates = [paths.appPath, paths.resourcesPath];
                for (const basePath of candidates) {
                    const detected = await detectKimbarRoot(basePath);
                    if (detected) {
                        if (active) setKimbarPath(detected);
                        return;
                    }
                }
                if (active) setKimbarPath(null);
            } catch {
                if (active) setKimbarPath(null);
            } finally {
                if (active) setKimbarSearching(false);
            }
        };

        void discoverKimbar();
        return () => {
            active = false;
        };
    }, [showProjectSelector]);

    const handleOpenFolder = useCallback(async () => {
        if (!window.electron) {
            toast.error('Requires Electron environment');
            return;
        }

        const result = await window.electron.dialog.openDirectory();
        if (!result.canceled && result.filePath) {
            closeProjectSelector();
            await loadProject(result.filePath);
        }
    }, [closeProjectSelector, loadProject]);

    const handleOpenRecent = useCallback(async (path: string) => {
        closeProjectSelector();
        await loadProject(path);
    }, [closeProjectSelector, loadProject]);

    const handleNewProject = useCallback(() => {
        closeProjectSelector();
        openNewProjectWizard();
    }, [closeProjectSelector, openNewProjectWizard]);

    const handleQuickStart = useCallback(async () => {
        closeProjectSelector();
        await loadSampleProject();
        toast.success('Loaded sample project - ready to edit!');
    }, [closeProjectSelector, loadSampleProject]);

    const handleOpenKimbar = useCallback(async () => {
        if (!kimbarPath) return;
        closeProjectSelector();
        await loadProject(kimbarPath);
    }, [closeProjectSelector, kimbarPath, loadProject]);

    const handleLocateKimbar = useCallback(async () => {
        if (!window.electron) {
            toast.error('Requires Electron environment');
            return;
        }

        const result = await window.electron.dialog.openDirectory();
        if (!result.canceled && result.filePath) {
            closeProjectSelector();
            await loadProject(result.filePath);
        }
    }, [closeProjectSelector, loadProject]);

    const handleRemoveRecent = useCallback((e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        removeRecentProject(path);
    }, [removeRecentProject]);

    return (
        <Dialog open={showProjectSelector} onOpenChange={(open) => !open && closeProjectSelector()}>
            <DialogContent className={`sm:max-w-[520px] ${isLight ? 'bg-[#f4f8ff] border-[#b8c7df] text-[#10203b]' : 'bg-[#1a1a2e] border-[#2a2a4a] text-white'}`}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <MapIcon className="h-6 w-6 text-[#f97316]" />
                        SpudTile
                    </DialogTitle>
                    <DialogDescription className={isLight ? 'text-[#425a80]' : 'text-gray-400'}>
                        AI-assisted tile editor for pixel art games
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            className={`h-20 flex-col gap-2 ${isLight ? 'bg-[#ffffff] border-[#b8c7df] hover:bg-[#e9f1ff] hover:border-[#f97316]' : 'bg-[#12121f] border-[#2a2a4a] hover:bg-[#2a2a4a] hover:border-[#f97316]'}`}
                            onClick={handleNewProject}
                        >
                            <Plus className="h-6 w-6 text-[#f97316]" />
                            <span>New Project</span>
                        </Button>
                        <Button
                            variant="outline"
                            className={`h-20 flex-col gap-2 ${isLight ? 'bg-[#ffffff] border-[#b8c7df] hover:bg-[#e9f1ff] hover:border-[#f97316]' : 'bg-[#12121f] border-[#2a2a4a] hover:bg-[#2a2a4a] hover:border-[#f97316]'}`}
                            onClick={handleOpenFolder}
                        >
                            <FolderOpen className="h-6 w-6 text-[#f97316]" />
                            <span>Open Folder</span>
                        </Button>
                    </div>

                    <Button
                        className="w-full h-12 bg-[#f97316] hover:bg-[#ea580c] text-white font-medium"
                        onClick={handleQuickStart}
                    >
                        <Zap className="h-5 w-5 mr-2" />
                        Quick Start with Sample Project
                    </Button>

                    <Button
                        variant="outline"
                        className={`w-full h-12 justify-start gap-2 ${isLight ? 'bg-[#ffffff] border-[#b8c7df] hover:bg-[#e9f1ff] hover:border-[#0ea5e9]' : 'bg-[#12121f] border-[#2a2a4a] hover:bg-[#2a2a4a] hover:border-[#0ea5e9]'}`}
                        onClick={handleLocateKimbar}
                    >
                        <Link className="h-5 w-5 text-[#0ea5e9]" />
                        <span>Locate Kimbar Project Folder</span>
                    </Button>

                    {kimbarPath && (
                        <Button
                            variant="outline"
                            className={`w-full h-12 justify-start gap-2 ${isLight ? 'bg-[#ffffff] border-[#b8c7df] hover:bg-[#e9f1ff] hover:border-[#22c55e]' : 'bg-[#12121f] border-[#2a2a4a] hover:bg-[#2a2a4a] hover:border-[#22c55e]'}`}
                            onClick={handleOpenKimbar}
                            title={kimbarPath}
                        >
                            <Link className="h-5 w-5 text-[#22c55e]" />
                            <span className="flex-1 text-left">Open Kimbar Linked Project</span>
                            <span className={`text-xs truncate max-w-[170px] ${isLight ? 'text-[#55698d]' : 'text-gray-500'}`}>{kimbarPath}</span>
                        </Button>
                    )}

                    {kimbarSearching && (
                        <div className={`flex items-center gap-2 text-xs ${isLight ? 'text-[#5a7297]' : 'text-gray-500'}`}>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Searching for Kimbar linked project...
                        </div>
                    )}

                    {!kimbarSearching && !kimbarPath && (
                        <div className={`text-xs ${isLight ? 'text-[#637da2]' : 'text-gray-500'}`}>
                            Auto-detect did not find Kimbar. Use "Locate Kimbar Project Folder".
                        </div>
                    )}

                    <Separator className={isLight ? 'bg-[#c9d5ea]' : 'bg-[#2a2a4a]'} />

                    {/* Recent Projects */}
                    <div>
                        <h3 className={`text-sm font-medium mb-2 flex items-center gap-2 ${isLight ? 'text-[#4f6488]' : 'text-gray-400'}`}>
                            <Clock className="h-4 w-4" />
                            Recent Projects
                        </h3>
                        {recentProjects.length === 0 ? (
                            <p className={`text-sm italic py-4 text-center ${isLight ? 'text-[#7085aa]' : 'text-gray-500'}`}>
                                No recent projects
                            </p>
                        ) : (
                            <ScrollArea className="h-[180px]">
                                <div className="space-y-1">
                                    {recentProjects.map((project) => (
                                        <div
                                            key={project.path}
                                            className={`flex items-center justify-between p-2 rounded-md cursor-pointer group transition-colors ${isLight ? 'bg-[#ffffff] hover:bg-[#e9f1ff]' : 'bg-[#12121f] hover:bg-[#2a2a4a]'}`}
                                            onClick={() => handleOpenRecent(project.path)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{project.name}</p>
                                                <p className={`text-xs truncate ${isLight ? 'text-[#64799d]' : 'text-gray-500'}`}>{project.path}</p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={`opacity-0 group-hover:opacity-100 h-8 w-8 p-0 ${isLight ? 'text-[#5f759b] hover:text-red-500' : 'text-gray-400 hover:text-red-400'}`}
                                                onClick={(e) => handleRemoveRecent(e, project.path)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
