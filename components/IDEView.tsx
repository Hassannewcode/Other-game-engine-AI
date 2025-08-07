
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import CodeIcon from './icons/CodeIcon';
import PlayIcon from './icons/PlayIcon';
import AIIcon from './icons/AIIcon';
import GamePreview from './GamePreview';
import ChatPanel from './ChatPanel';
import { Workspace, FileEntry, LogEntry } from '../types';
import RefreshIcon from './icons/RefreshIcon';
import FullscreenIcon from './icons/FullscreenIcon';
import DownloadIcon from './icons/DownloadIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import PencilIcon from './icons/PencilIcon';
import ArrowLeftIcon from './icons/ArrowLeftIcon';
import FileExplorer from './FileExplorer';
import PanelLeftIcon from './icons/PanelLeftIcon';
import Console from './Console';


declare global {
    interface Window {
        hljs: any;
    }
}

interface IDEViewProps {
    activeWorkspace: Workspace;
    isLoading: boolean;
    onGenerate: (prompt: string) => void;
    onPositiveFeedback: (messageId: string) => void;
    onRetry: (prompt: string) => void;
    onRenameWorkspace: (newName: string) => void;
    onDeleteWorkspace: () => void;
    onReturnToLauncher: () => void;
    onUpdateFileContent: (path: string, content: string) => void;
}

const bundleForPreview = (files: FileEntry[]): string => {
    const indexHtmlFile = files.find(f => f.path === 'index.html');
    if (!indexHtmlFile) return '<h1>Error: index.html not found.</h1>';

    let htmlContent = indexHtmlFile.content;

    const scriptRegex = /<script\s+(.*?)\s*src=["'](.*?)["'](.*?)>\s*<\/script>/gi;
    htmlContent = htmlContent.replace(scriptRegex, (match, pre, src, post) => {
        const file = files.find(f => f.path === src || `./${f.path}` === src);
        if (file) {
            return `<script ${pre} ${post}>\n// Original src: ${src}\n${file.content}\n</script>`;
        }
        return match; // Keep original if file not found
    });

    const cssRegex = /<link\s+.*?href=["'](.*?)["'].*?>/gi;
    htmlContent = htmlContent.replace(cssRegex, (match, href) => {
        if (!href.endsWith('.css')) return match;
        const file = files.find(f => f.path === href || `./${f.path}` === href);
        if (file) {
            return `<style>\n/* Original href: ${href} */\n${file.content}\n</style>`;
        }
        return match;
    });

    return htmlContent;
};


const IDEView: React.FC<IDEViewProps> = ({ activeWorkspace, isLoading, onGenerate, onPositiveFeedback, onRetry, onRenameWorkspace, onDeleteWorkspace, onReturnToLauncher, onUpdateFileContent }) => {
    const [isChatVisible, setChatVisible] = useState(true);
    const [isExplorerVisible, setExplorerVisible] = useState(true);
    const [isPreviewVisible, setPreviewVisible] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const codeBlockRef = useRef<HTMLElement>(null);
    const [activePath, setActivePath] = useState('game.js');
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const [isEditingName, setIsEditingName] = useState(false);
    const [workspaceName, setWorkspaceName] = useState(activeWorkspace.name);
    const nameInputRef = useRef<HTMLInputElement>(null);
    
    const activeFile = useMemo(() => {
        const file = activeWorkspace.files.find(f => f.path === activePath);
        // Fallback to index.html or first file if active file is not found
        return file || activeWorkspace.files.find(f => f.path === 'index.html') || activeWorkspace.files[0];
    }, [activePath, activeWorkspace.files]);

    useEffect(() => {
        // Ensure activePath is valid, reset if not
        if (!activeWorkspace.files.some(f => f.path === activePath)) {
            setActivePath(activeWorkspace.files.find(f => f.path === 'game.js')?.path || 'index.html');
        }
    }, [activeWorkspace.files, activePath]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'console' && event.data?.payload) {
                const { type, message } = event.data.payload;
                if (typeof type === 'string' && typeof message === 'string') {
                    setLogs(prevLogs => [...prevLogs.slice(-200), { type, message }]);
                }
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    const handleClearConsole = useCallback(() => {
        setLogs([]);
    }, []);


    useEffect(() => {
        if (codeBlockRef.current && window.hljs) {
            // Set language class for syntax highlighting
            const extension = activeFile?.path.split('.').pop() || 'html';
            const lang = { js: 'javascript', css: 'css', html: 'html', json: 'json', md: 'markdown' }[extension] || 'plaintext';
            codeBlockRef.current.className = `language-${lang}`;
            codeBlockRef.current.textContent = activeFile?.content || '';
            window.hljs.highlightElement(codeBlockRef.current);
        }
    }, [activeFile]);
    
    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setWorkspaceName(e.target.value);
    }
    
    const handleNameBlur = () => {
        setIsEditingName(false);
        if (workspaceName.trim() && workspaceName !== activeWorkspace.name) {
            onRenameWorkspace(workspaceName);
        } else {
            setWorkspaceName(activeWorkspace.name);
        }
    }
    
    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') {
            setWorkspaceName(activeWorkspace.name);
            setIsEditingName(false);
        }
    }

    const handleRefresh = () => {
        setLogs([]);
        setRefreshKey(prevKey => prevKey + 1);
    }

    const handleToggleFullscreen = useCallback(() => {
        if (!previewContainerRef.current) return;
        if (!document.fullscreenElement) {
            previewContainerRef.current.requestFullscreen().catch(err => console.error(`Fullscreen error: ${err.message}`));
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }, []);

    const handleDownload = async () => {
        const zip = new JSZip();
        activeWorkspace.files.forEach(file => {
            zip.file(file.path, file.content);
        });

        const packageJson = {
            name: activeWorkspace.name.toLowerCase().replace(/\s+/g, '-'),
            version: "1.0.0",
            description: `A ${activeWorkspace.type} game generated by VibeCode-X AI.`,
            scripts: { "start": "serve ." },
            devDependencies: { "serve": "^14.2.1" }
        };
        zip.file("package.json", JSON.stringify(packageJson, null, 2));
        
        const readmeContent = `# ${activeWorkspace.name}\n\nThis project was generated using VibeCode-X AI.\n\n## Local Development\n\n1. Ensure Node.js and npm are installed.\n2. Install dependencies: \`npm install\`\n3. Start the server: \`npm start\`\n`;
        zip.file("README.md", readmeContent);

        const blob = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${activeWorkspace.name.toLowerCase().replace(/\s+/g, '-')}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    return (
        <div className="relative flex h-screen w-screen bg-black text-gray-300 font-sans">
             <div className={`bg-[#121212] flex flex-col flex-shrink-0 border-r border-gray-800/70 transition-all duration-300 ease-in-out ${isChatVisible ? 'w-[380px]' : 'w-0'}`}>
                {isChatVisible && <ChatPanel history={activeWorkspace.chatHistory} onSend={onGenerate} isLoading={isLoading} onDeleteWorkspace={onDeleteWorkspace} onPositiveFeedback={onPositiveFeedback} onRetry={onRetry} />}
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex-shrink-0 bg-[#121212] border-b border-gray-800/70 flex justify-between items-center px-2 h-11">
                     <div className="flex items-center gap-1">
                        <button onClick={onReturnToLauncher} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label="Back to Launcher"><ArrowLeftIcon className="w-5 h-5" /></button>
                        <button onClick={() => setChatVisible(!isChatVisible)} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label={isChatVisible ? 'Hide Chat' : 'Show Chat'}><AIIcon className={`w-5 h-5 transition-colors ${isChatVisible ? 'text-blue-500' : 'text-gray-400'}`} /></button>
                        <button onClick={() => setExplorerVisible(!isExplorerVisible)} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label={isExplorerVisible ? 'Hide File Explorer' : 'Show File Explorer'}><PanelLeftIcon className={`w-5 h-5 transition-colors ${isExplorerVisible ? 'text-blue-500' : 'text-gray-400'}`} /></button>
                        <div className="h-5 w-px bg-gray-800 mx-1"></div>
                        <div className="flex items-center gap-3">
                             {isEditingName ? (
                                <input ref={nameInputRef} type="text" value={workspaceName} onChange={handleNameChange} onBlur={handleNameBlur} onKeyDown={handleNameKeyDown} className="bg-black border border-blue-500 rounded-md px-2 py-0.5 text-sm font-medium text-gray-200 outline-none w-48"/>
                            ) : (
                                <div onDoubleClick={() => setIsEditingName(true)} className="group flex items-center gap-2 px-2 py-1.5 text-sm font-medium bg-black rounded-md border border-transparent hover:border-gray-700/80 cursor-pointer" title="Double-click to rename">
                                    <span className="text-gray-300">{activeWorkspace.name}</span>
                                    <PencilIcon className="w-3 h-3 text-gray-600 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            )}
                            <span className="text-xs font-semibold uppercase text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full">{activeWorkspace.type}</span>
                        </div>
                     </div>
                    <div className="flex items-center gap-1">
                        <button onClick={handleDownload} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label="Download Project"><DownloadIcon className="w-5 h-5" /></button>
                         <button onClick={handleRefresh} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label="Refresh Preview"><RefreshIcon className="w-5 h-5" /></button>
                        <button onClick={handleToggleFullscreen} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label="Toggle Fullscreen"><FullscreenIcon className="w-5 h-5" /></button>
                         <button onClick={() => setPreviewVisible(!isPreviewVisible)} className="p-1.5 text-gray-400 rounded-md hover:text-white hover:bg-white/10" aria-label={isPreviewVisible ? 'Hide Preview' : 'Show Preview'}><PlayIcon className={`w-5 h-5 transition-colors ${isPreviewVisible ? 'text-blue-500' : 'text-gray-400'}`} /></button>
                    </div>
                </header>

                <main className="flex-1 bg-black flex flex-row overflow-hidden">
                    <div className={`bg-[#0d0d0d] flex flex-col flex-shrink-0 border-r border-gray-800/70 transition-all duration-300 ease-in-out ${isExplorerVisible ? 'w-60' : 'w-0'}`}>
                       {isExplorerVisible && <FileExplorer files={activeWorkspace.files} activePath={activeFile?.path || ''} onSelect={setActivePath} />}
                    </div>
                    
                    <div className={`flex-1 h-full font-mono text-sm bg-black overflow-hidden transition-all duration-300 ease-in-out ${isPreviewVisible ? 'w-1/2' : 'w-full'}`}>
                         <div className="p-4 h-full overflow-auto">
                            <pre className="h-full w-full"><code ref={codeBlockRef} className="language-html"></code></pre>
                        </div>
                    </div>

                    <div ref={previewContainerRef} className={`relative flex flex-col h-full bg-black transition-all duration-300 ease-in-out ${isPreviewVisible ? 'flex-1' : 'w-0'}`}>
                        {isPreviewVisible && (
                           <>
                               <div className="h-1/2 relative bg-black">
                                   <GamePreview key={refreshKey} htmlContent={bundleForPreview(activeWorkspace.files)} />
                               </div>
                               <div className="h-1/2 bg-[#0d0d0d] border-t-2 border-gray-800/70">
                                   <Console logs={logs} onClear={handleClearConsole} />
                               </div>
                           </>
                        )}
                    </div>
                </main>
            </div>

            {isLoading && (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-sm border border-white/10 text-gray-200 px-4 py-2 rounded-full flex items-center gap-3 shadow-lg z-50 transition-opacity duration-300 animate-fade-in">
                    <SpinnerIcon className="w-5 h-5 text-blue-400" />
                    <span>AI is thinking...</span>
                </div>
            )}
        </div>
    );
};

export default IDEView;
