
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import IDEView from './components/IDEView';
import WorkspaceModal from './components/WorkspaceModal';
import { getInitialWorkspaceData, createChatFromWorkspace } from './services/geminiService';
import type { WorkspaceType, Workspace, ChatMessage, UserChatMessage, ModelChatMessage, FileEntry } from './types';
import SpinnerIcon from './components/icons/SpinnerIcon';

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// A robust function to extract and parse JSON from a string that might contain markdown or other text.
const extractJsonFromString = (text: string): any | null => {
    if (!text) {
        return null;
    }

    let textToParse = text;

    // Common pattern: ```json ... ``` or ``` ... ```
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        textToParse = markdownMatch[1];
    }
    
    // Find the first '{' or '[' to handle cases where JSON is not in a markdown block
    // and might be preceded by conversational text.
    const firstBrace = textToParse.indexOf('{');
    const firstBracket = textToParse.indexOf('[');
    
    let startIndex = -1;

    if (firstBrace === -1 && firstBracket === -1) return null;

    if (firstBrace === -1) {
        startIndex = firstBracket;
    } else if (firstBracket === -1) {
        startIndex = firstBrace;
    } else {
        startIndex = Math.min(firstBrace, firstBracket);
    }
    
    const jsonString = textToParse.substring(startIndex);
    
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Failed to parse JSON from AI response:", error);
        // The AI might have included trailing text after the JSON. This is invalid JSON.
        // The error is caught and we return null, which is handled gracefully.
        return null;
    }
};

const STORAGE_KEY = 'ai-game-studio-state-v3'; // Incremented version for new data structure

const App: React.FC = () => {
    const [workspaces, setWorkspaces] = useState<Record<string, Workspace>>({});
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);

    // Load from localStorage on initial mount
    useEffect(() => {
        try {
            const savedState = localStorage.getItem(STORAGE_KEY);
            if (savedState) {
                const { workspaces: savedWorkspaces, activeWorkspaceId: savedActiveId } = JSON.parse(savedState);
                if (savedWorkspaces && Object.keys(savedWorkspaces).length > 0) {
                    setWorkspaces(savedWorkspaces);
                    // Check if the saved active ID is still valid
                    if (savedActiveId && savedWorkspaces[savedActiveId]) {
                        setActiveWorkspaceId(savedActiveId);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load state from localStorage:", error);
            // Clear corrupted state
            localStorage.removeItem(STORAGE_KEY);
        } finally {
            setIsInitialized(true);
        }
    }, []);

    // Save to localStorage whenever state changes
    useEffect(() => {
        if (!isInitialized) return; // Don't save until after initial load
        try {
            const stateToSave = { workspaces, activeWorkspaceId };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (error) {
            console.error("Failed to save state to localStorage:", error);
        }
    }, [workspaces, activeWorkspaceId, isInitialized]);
    
    const activeWorkspace = useMemo(() => {
        return activeWorkspaceId ? workspaces[activeWorkspaceId] : null;
    }, [activeWorkspaceId, workspaces]);

    const handleCreateWorkspace = useCallback((type: WorkspaceType) => {
        try {
            const { initialFiles, initialHistory } = getInitialWorkspaceData(type);
            const newId = generateId();
            const newWorkspace: Workspace = {
                id: newId,
                name: `${type} Project - ${new Date().toLocaleDateString()}`,
                type: type,
                files: initialFiles,
                chatHistory: initialHistory,
                lastModified: Date.now(),
            };
            
            setWorkspaces(prev => ({ ...prev, [newId]: newWorkspace }));
            setActiveWorkspaceId(newId);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            alert(`Error initializing AI: ${errorMessage}`);
        }
    }, []);
    
    const handleSelectWorkspace = useCallback((id: string) => {
        if (workspaces[id]) {
            setWorkspaces(prev => ({
                ...prev,
                [id]: { ...prev[id], lastModified: Date.now() }
            }));
            setActiveWorkspaceId(id);
        }
    }, [workspaces]);

    const handleGenerateCode = useCallback(async (prompt: string, isRetry = false) => {
        if (!activeWorkspace || isLoading) return;

        const chat = createChatFromWorkspace(activeWorkspace);

        setIsLoading(true);
        const userMessage: UserChatMessage = { id: generateId(), role: 'user', text: prompt };
        
        const updatedHistory = [...activeWorkspace.chatHistory, userMessage];
        setWorkspaces(prev => ({
            ...prev,
            [activeWorkspace.id]: { ...prev[activeWorkspace.id], chatHistory: updatedHistory, lastModified: Date.now() }
        }));
        
        try {
            const response = await chat.sendMessage({ message: prompt });
            const fullResponseText = response.text;
            const jsonResponse = extractJsonFromString(fullResponseText);

            if (!jsonResponse) {
                throw new Error('AI returned an invalid or non-JSON response.');
            }
            
            const { thinking, explanation, files } = jsonResponse;

            if (!Array.isArray(files) || files.length === 0 || !files.every((f: any) => f.path && typeof f.content === 'string')) {
                 throw new Error("AI response is missing the 'files' field or it has an invalid format.");
            }
            
            const modelMessageText = (typeof explanation === 'string' && explanation.trim()) ? explanation : 'Code updated successfully.';

            const modelMessage: ModelChatMessage = { 
                id: generateId(), 
                role: 'model', 
                thinking: thinking,
                text: modelMessageText,
                fullResponse: fullResponseText,
            };

            setWorkspaces(prev => {
                const currentWs = prev[activeWorkspace.id];
                const finalHistory = [...currentWs.chatHistory.filter(m => m.id !== userMessage.id), userMessage, modelMessage];
                return {
                    ...prev,
                    [activeWorkspace.id]: {
                        ...currentWs,
                        files: files as FileEntry[],
                        chatHistory: finalHistory,
                        lastModified: Date.now(),
                    }
                };
            });

        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred. The AI may have returned an invalid response.';
            
            let errorChatMessage: ModelChatMessage;
            if (!isRetry) {
                errorChatMessage = {
                    id: generateId(),
                    role: 'model',
                    text: `I encountered an issue processing that request. Would you like me to try again? (${errorMessage})`,
                    fullResponse: JSON.stringify({ error: errorMessage }),
                    isFixable: true,
                    originalPrompt: prompt,
                };
            } else {
                 errorChatMessage = {
                     id: generateId(),
                     role: 'model',
                     text: `I'm sorry, I failed to recover from the error. Please try a different prompt. (${errorMessage})`,
                     fullResponse: JSON.stringify({ error: errorMessage }),
                 };
            }
            setWorkspaces(prev => {
                const currentWs = prev[activeWorkspace.id];
                return { ...prev, [activeWorkspace.id]: { ...currentWs, chatHistory: [...currentWs.chatHistory, errorChatMessage] }};
            });
        } finally {
            setIsLoading(false);
        }
    }, [activeWorkspace, isLoading]);

    const handleRetry = useCallback((promptToRetry: string) => {
        if (!activeWorkspace) return;
        
        const newHistory = activeWorkspace.chatHistory.filter(msg => 
            !((msg.role === 'model' && msg.isFixable) && msg.originalPrompt === promptToRetry)
        );
        
        setWorkspaces(prev => ({
            ...prev,
            [activeWorkspace.id]: { ...prev[activeWorkspace.id], chatHistory: newHistory }
        }));

        handleGenerateCode(promptToRetry, true);
    }, [activeWorkspace, handleGenerateCode]);
    
    const handlePositiveFeedback = useCallback((messageId: string) => {
        if (!activeWorkspace) return;

        const newHistory = activeWorkspace.chatHistory.map(msg => {
            if (msg.id === messageId && msg.role === 'model') {
                return { ...msg, rated: true };
            }
            return msg;
        });

        if (JSON.stringify(newHistory) !== JSON.stringify(activeWorkspace.chatHistory)) {
             setWorkspaces(prev => ({
                ...prev,
                [activeWorkspace.id]: { ...activeWorkspace, chatHistory: newHistory, lastModified: Date.now() }
            }));
        }
    }, [activeWorkspace]);

    const handleRenameWorkspace = useCallback((newName: string) => {
        if (!activeWorkspace || !newName.trim()) return;
        const updatedWs = { ...activeWorkspace, name: newName.trim(), lastModified: Date.now() };
        setWorkspaces(prev => ({ ...prev, [activeWorkspace.id]: updatedWs }));
    }, [activeWorkspace]);

    const handleDeleteWorkspace = useCallback((idToDelete: string) => {
        if (!workspaces[idToDelete]) return;

        const newWorkspaces = { ...workspaces };
        delete newWorkspaces[idToDelete];
        setWorkspaces(newWorkspaces);

        if (activeWorkspaceId === idToDelete) {
            setActiveWorkspaceId(null);
        }
    }, [workspaces, activeWorkspaceId]);
    
    const handleUpdateFileContent = useCallback((path: string, content: string) => {
        if (!activeWorkspace) return;
        
        const newFiles = activeWorkspace.files.map(file => 
            file.path === path ? { ...file, content } : file
        );

        setWorkspaces(prev => ({
            ...prev,
            [activeWorkspace.id]: { ...prev[activeWorkspace.id], files: newFiles, lastModified: Date.now() }
        }));

    }, [activeWorkspace]);

    const handleReturnToLauncher = useCallback(() => {
        setActiveWorkspaceId(null);
    }, []);
    
    if (!isInitialized) {
        return (
            <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-gray-400">
                <SpinnerIcon className="w-10 h-10 text-blue-500" />
                <p className="mt-4">Loading Studio...</p>
            </div>
        );
    }

    if (!activeWorkspace) {
        return <WorkspaceModal
            workspaces={Object.values(workspaces)}
            onSelect={handleSelectWorkspace}
            onCreate={handleCreateWorkspace}
            onDelete={handleDeleteWorkspace}
        />;
    }

    return (
        <div className="w-screen h-screen bg-black">
            <IDEView
                key={activeWorkspace.id}
                activeWorkspace={activeWorkspace}
                isLoading={isLoading}
                onGenerate={handleGenerateCode}
                onPositiveFeedback={handlePositiveFeedback}
                onRetry={handleRetry}
                onRenameWorkspace={handleRenameWorkspace}
                onDeleteWorkspace={() => handleDeleteWorkspace(activeWorkspace.id)}
                onReturnToLauncher={handleReturnToLauncher}
                onUpdateFileContent={handleUpdateFileContent}
            />
        </div>
    );
};

export default App;
