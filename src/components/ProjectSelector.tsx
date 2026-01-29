/**
 * ProjectSelector - Startup dialog for opening/creating projects
 * 
 * Shows on startup with options to:
 * - Open recent projects
 * - Create new project
 * - Open existing folder
 * - Quick start with default tileset
 */

import { useCallback } from 'react';
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
} from 'lucide-react';
import { useUIStore, useProjectStore } from '@/stores';
import { toast } from 'sonner';

export function ProjectSelector() {
    const {
        showProjectSelector,
        recentProjects,
        closeProjectSelector,
        openNewProjectWizard,
        removeRecentProject,
    } = useUIStore();

    const { loadProject, loadSampleProject } = useProjectStore();

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

    const handleRemoveRecent = useCallback((e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        removeRecentProject(path);
    }, [removeRecentProject]);

    return (
        <Dialog open={showProjectSelector} onOpenChange={(open) => !open && closeProjectSelector()}>
            <DialogContent className="sm:max-w-[500px] bg-[#1a1a2e] border-[#2a2a4a] text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <MapIcon className="h-6 w-6 text-[#f97316]" />
                        PrairieBob
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        AI-assisted tile editor for pixel art games
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            className="h-20 flex-col gap-2 bg-[#12121f] border-[#2a2a4a] hover:bg-[#2a2a4a] hover:border-[#f97316]"
                            onClick={handleNewProject}
                        >
                            <Plus className="h-6 w-6 text-[#f97316]" />
                            <span>New Project</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="h-20 flex-col gap-2 bg-[#12121f] border-[#2a2a4a] hover:bg-[#2a2a4a] hover:border-[#f97316]"
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

                    <Separator className="bg-[#2a2a4a]" />

                    {/* Recent Projects */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Recent Projects
                        </h3>
                        {recentProjects.length === 0 ? (
                            <p className="text-gray-500 text-sm italic py-4 text-center">
                                No recent projects
                            </p>
                        ) : (
                            <ScrollArea className="h-[180px]">
                                <div className="space-y-1">
                                    {recentProjects.map((project) => (
                                        <div
                                            key={project.path}
                                            className="flex items-center justify-between p-2 rounded-md bg-[#12121f] hover:bg-[#2a2a4a] cursor-pointer group transition-colors"
                                            onClick={() => handleOpenRecent(project.path)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{project.name}</p>
                                                <p className="text-xs text-gray-500 truncate">{project.path}</p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0 text-gray-400 hover:text-red-400"
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
