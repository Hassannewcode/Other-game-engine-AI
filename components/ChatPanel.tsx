
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import AIIcon from './icons/AIIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import ThumbsUpIcon from './icons/ThumbsUpIcon';
import RefreshIcon from './icons/RefreshIcon';

interface ChatPanelProps {
    history: ChatMessage[];
    isLoading: boolean;
    onSend: (prompt: string) => void;
    onDeleteWorkspace: () => void;
    onPositiveFeedback: (messageId: string) => void;
    onRetry: (prompt: string) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ history, isLoading, onSend, onDeleteWorkspace, onPositiveFeedback, onRetry }) => {
    const [prompt, setPrompt] = useState('');
    const historyEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const handleSend = () => {
        if (prompt.trim() && !isLoading) {
            onSend(prompt.trim());
            setPrompt('');
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full p-4 bg-[#121212] min-w-[380px]">
            <header className="flex-shrink-0 mb-4 pb-4 border-b border-gray-800/70">
                <div className="flex items-center gap-3">
                    <AIIcon className="w-8 h-8 text-blue-500" />
                    <h1 className="text-xl font-medium text-gray-100">VibeCode-X</h1>
                </div>
                <p className="text-sm text-gray-500 mt-1">Your AI Game Dev Assistant</p>
            </header>

            <div className="flex-grow overflow-y-auto pr-2">
                <div className="space-y-6">
                    {history.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 items-start ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'model' && (
                                <div className="w-7 h-7 flex-shrink-0 bg-gray-800 rounded-full flex items-center justify-center">
                                    <AIIcon className="w-4 h-4 text-blue-400" />
                                </div>
                            )}
                            <div className="group relative">
                                <div className={`text-sm leading-relaxed rounded-lg px-4 py-2 max-w-sm ${msg.role === 'model' ? (msg.isFixable ? 'bg-red-900/50 border border-red-500/30 text-red-200' : 'bg-gray-800/50 text-gray-300') : 'bg-blue-600/80 text-white'}`}>
                                    {msg.text}
                                    {msg.role === 'model' && msg.isFixable && msg.originalPrompt && (
                                        <button 
                                            onClick={() => onRetry(msg.originalPrompt!)}
                                            disabled={isLoading}
                                            className="mt-3 flex items-center gap-2 text-sm font-medium bg-yellow-500/20 text-yellow-300 px-3 py-1.5 rounded-md hover:bg-yellow-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <RefreshIcon className="w-4 h-4"/>
                                            Try Again
                                        </button>
                                    )}
                                </div>
                                {msg.role === 'model' && !msg.rated && !msg.isFixable && (
                                     <button 
                                        onClick={() => onPositiveFeedback(msg.id)}
                                        className="absolute -bottom-4 right-2 p-1 rounded-full bg-gray-700/80 text-gray-400 hover:text-green-400 hover:bg-gray-600 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                        aria-label="Good response"
                                        disabled={!!msg.rated || isLoading}
                                    >
                                        <ThumbsUpIcon className="w-3.5 h-3.5" />
                                     </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && history[history.length-1]?.role === 'user' && (
                         <div className="flex gap-3 items-start">
                            <div className="w-7 h-7 flex-shrink-0 bg-gray-800 rounded-full flex items-center justify-center">
                                <SpinnerIcon className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="text-sm leading-relaxed rounded-lg px-4 py-2 max-w-sm bg-gray-800/50 text-gray-400 italic">
                                Thinking...
                            </div>
                        </div>
                    )}
                </div>
                <div ref={historyEndRef} />
            </div>

            <footer className="flex-shrink-0 mt-4 pt-4 border-t border-gray-800/70">
                 <div className="relative">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="e.g., 'Add enemies that shoot back' or 'create a particle explosion on collision'"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 pr-20 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                        rows={3}
                        disabled={isLoading}
                        aria-label="AI instruction prompt"
                    />
                    <button
                        onClick={handleSend}
                        className="absolute right-2 bottom-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-1.5 px-3 rounded-md flex items-center justify-center gap-2 transition-colors disabled:bg-blue-600/50 disabled:cursor-not-allowed"
                        disabled={isLoading || !prompt.trim()}
                        aria-label="Send prompt"
                    >
                        Send
                    </button>
                </div>
                <button 
                    onClick={() => {
                        if (window.confirm("Are you sure you want to delete this workspace? This action cannot be undone.")) {
                            onDeleteWorkspace();
                        }
                    }} 
                    className="text-xs mt-3 w-full text-center p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                >
                    Delete Workspace
                </button>
            </footer>
        </div>
    );
};

export default ChatPanel;
