
import React, { useState, useCallback, useRef } from 'react';
import type { Chat } from '@google/genai';
import IDEView from './components/IDEView';
import WorkspaceModal from './components/WorkspaceModal';
import { createAIGameChatSession } from './services/geminiService';
import type { WorkspaceType } from './types';

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    rated?: boolean;
    isFixable?: boolean;
    originalPrompt?: string;
}

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


const App: React.FC = () => {
    const [workspace, setWorkspace] = useState<WorkspaceType | null>(null);
    const aiChatRef = useRef<Chat | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [generatedCode, setGeneratedCode] = useState<string>('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    
    const handleSelectWorkspace = useCallback((selectedWorkspace: WorkspaceType) => {
        try {
            const { chat, initialCode, welcomeMessage } = createAIGameChatSession(selectedWorkspace);
            aiChatRef.current = chat;
            setGeneratedCode(initialCode);
            setChatHistory([{ id: `model-init-${Date.now()}`, role: 'model', text: welcomeMessage }]);
            setWorkspace(selectedWorkspace);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            setChatHistory([{ id: `model-error-${Date.now()}`, role: 'model', text: `Error initializing AI: ${errorMessage}` }]);
        }
    }, []);

    const handleGenerateCode = useCallback(async (prompt: string, isRetry = false) => {
        const aiChat = aiChatRef.current;
        if (!aiChat || !prompt || isLoading || !workspace) return;

        setIsLoading(true);
        const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text: prompt };
        setChatHistory(prev => [...prev, userMessage]);
        
        try {
            const response = await aiChat.sendMessage({ message: prompt });

            const jsonResponse = extractJsonFromString(response.text);

            if (!jsonResponse) {
                throw new Error('AI returned an invalid or non-JSON response.');
            }
            
            const { explanation, code } = jsonResponse;

            if (typeof code !== 'string') {
                 throw new Error("AI response is missing the 'code' field or it is not a string.");
            }
            setGeneratedCode(code);

            const modelMessageText = (typeof explanation === 'string' && explanation.trim())
                ? explanation
                : 'Code updated successfully.';

            setChatHistory(prev => [...prev, { 
                id: `model-${Date.now()}`, 
                role: 'model', 
                text: modelMessageText 
            }]);

        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred. The AI may have returned an invalid response.';
            
            if (!isRetry) {
                const fixableError: ChatMessage = {
                    id: `model-error-${Date.now()}`,
                    role: 'model',
                    text: `I encountered an issue processing that request. Would you like me to try again? (${errorMessage})`,
                    isFixable: true,
                    originalPrompt: prompt,
                };
                setChatHistory(prev => [...prev, fixableError]);
            } else {
                 setChatHistory(prev => [...prev, { id: `model-error-${Date.now()}`, role: 'model', text: `I'm sorry, I failed to recover from the error. Please try a different prompt. (${errorMessage})` }]);
            }

        } finally {
            setIsLoading(false);
        }
    }, [isLoading, workspace]);

    const handleRetry = useCallback((promptToRetry: string) => {
        // Find the error message in history and remove it before retrying
        setChatHistory(prev => prev.filter(msg => msg.originalPrompt !== promptToRetry));
        handleGenerateCode(promptToRetry, true);
    }, [handleGenerateCode]);
    
    const handlePositiveFeedback = useCallback((messageId: string) => {
        if (!aiChatRef.current) return;

        // The Chat 'history' property is private and cannot be modified directly.
        // This feedback mechanism is therefore a UI-only operation to acknowledge the user's input.
        setChatHistory(prev => {
            const newHistory = [...prev];
            const messageIndex = newHistory.findIndex(msg => msg.id === messageId);

            if (messageIndex === -1 || newHistory[messageIndex].rated) {
                return newHistory; // Message not found or already rated
            }
            
            // Mark original message as rated
            newHistory[messageIndex] = { ...newHistory[messageIndex], rated: true };

            // Insert feedback messages into the UI after the rated message
            const feedbackUiMessages: ChatMessage[] = [
                {
                    id: `user-feedback-${Date.now()}`,
                    role: 'user',
                    text: "That was a great update!",
                    rated: true, // Not rateable
                },
                {
                    id: `model-feedback-${Date.now()}`,
                    role: 'model',
                    text: "Great! I'll keep that in mind for future updates.",
                    rated: true, // Not rateable
                }
            ];

            newHistory.splice(messageIndex + 1, 0, ...feedbackUiMessages);
            return newHistory;
        });
    }, []);


    const handleReset = useCallback(() => {
        setWorkspace(null);
        aiChatRef.current = null;
        setChatHistory([]);
        setGeneratedCode('');
        setIsLoading(false);
    }, []);

    if (!workspace) {
        return <WorkspaceModal onSelect={handleSelectWorkspace} />;
    }

    return (
        <div className="w-screen h-screen bg-black">
            <IDEView
                workspaceType={workspace}
                generatedCode={generatedCode}
                chatHistory={chatHistory}
                isLoading={isLoading}
                onGenerate={handleGenerateCode}
                onReset={handleReset}
                onPositiveFeedback={handlePositiveFeedback}
                onRetry={handleRetry}
            />
        </div>
    );
};

export default App;
