
import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import TrashIcon from './icons/TrashIcon';
import AIIcon from './icons/AIIcon';

interface ConsoleProps {
    logs: LogEntry[];
    onClear: () => void;
    onAutoFix: (errorMessage: string) => void;
}

const Console: React.FC<ConsoleProps> = ({ logs, onClear, onAutoFix }) => {
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Only auto-scroll if the user is near the bottom
        const el = logsEndRef.current;
        if (el) {
            const parent = el.parentElement;
            if (parent && parent.scrollHeight - parent.scrollTop < parent.clientHeight + 100) {
                 el.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [logs]);

    const getLogColor = (type: string) => {
        switch (type) {
            case 'warn':
                return 'text-yellow-300';
            case 'error':
                return 'text-red-400';
            case 'info':
                return 'text-blue-300';
            default:
                return 'text-gray-300';
        }
    };
    
    return (
        <div className="flex flex-col h-full bg-[#0d0d0d] font-mono text-xs text-gray-400">
            <header className="flex-shrink-0 bg-[#121212] border-b border-gray-800/70 flex justify-between items-center px-3 py-1">
                <h2 className="font-semibold text-sm text-gray-200 uppercase tracking-wider">Console</h2>
                <button 
                    onClick={onClear} 
                    className="p-1 text-gray-400 rounded hover:bg-white/10 hover:text-white" 
                    aria-label="Clear console"
                    title="Clear console"
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
            </header>
            <div className="flex-grow p-2 overflow-y-auto">
                {logs.length === 0 ? (
                    <div className="text-gray-500 italic p-2">Console is empty. Logs from your game will appear here.</div>
                ) : (
                    logs.map((log, index) => (
                        <div key={index} className={`flex items-start justify-between whitespace-pre-wrap break-words border-b border-gray-900/70 py-1.5 group ${getLogColor(log.type)}`}>
                           <div className="flex-1 flex items-start">
                             <span className="mr-2 select-none opacity-50">&gt;</span>
                             <span className="flex-1">{log.message}</span>
                           </div>
                           {log.type === 'error' && (
                                <button 
                                    onClick={() => onAutoFix(log.message)}
                                    className="ml-4 flex-shrink-0 bg-yellow-500/10 text-yellow-300 px-2 py-0.5 rounded text-xs font-semibold hover:bg-yellow-500/30 flex items-center gap-1.5 transition-all opacity-0 group-hover:opacity-100"
                                    title="Ask AI to fix this error"
                                >
                                    <AIIcon className="w-3 h-3" />
                                    Auto-Fix
                                </button>
                           )}
                        </div>
                    ))
                )}
                <div ref={logsEndRef} />
            </div>
        </div>
    );
};

export default Console;
