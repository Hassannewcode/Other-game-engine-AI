export type WorkspaceType = '2D' | '3D';

export interface FileEntry {
    path: string;
    content: string;
}

export interface UserChatMessage {
    id: string;
    role: 'user';
    text: string;
}

export interface ModelChatMessage {
    id: string;
    role: 'model';
    thinking?: string;
    text: string; // Explanation for UI
    fullResponse: string; // The full stringified JSON from the AI
    rated?: boolean;
    isFixable?: boolean;
    originalPrompt?: string;
}

export type ChatMessage = UserChatMessage | ModelChatMessage;

export interface LogEntry {
    type: string;
    message: string;
}

export interface Workspace {
    id: string;
    name: string;
    type: WorkspaceType;
    files: FileEntry[];
    chatHistory: ChatMessage[];
    lastModified: number;
}
