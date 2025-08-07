export type WorkspaceType = '2D' | '3D';

export interface UserChatMessage {
    id: string;
    role: 'user';
    text: string;
}

export interface ModelChatMessage {
    id: string;
    role: 'model';
    text: string; // Explanation for UI
    fullResponse: string; // The full stringified JSON from the AI
    rated?: boolean;
    isFixable?: boolean;
    originalPrompt?: string;
}

export type ChatMessage = UserChatMessage | ModelChatMessage;

export interface Workspace {
    id: string;
    name: string;
    type: WorkspaceType;
    code: string;
    chatHistory: ChatMessage[];
    lastModified: number;
}
