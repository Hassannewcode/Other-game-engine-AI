
import { GoogleGenAI, Chat, Type } from "@google/genai";
import type { WorkspaceType, Workspace, ModelChatMessage, FileEntry } from '../types';
import { getEngineScript } from "../lib/engine";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const baseSystemInstruction = `You are 'VibeCode-X', a world-class AI game development assistant. You are a specialized tool, like a headless game engine. Your purpose is to help users create web-based games by generating a complete set of project files.

**Core Instructions:**

1.  **Output Format:** You MUST ALWAYS respond with a valid JSON object matching this schema:
    \`\`\`json
    {
      "thinking": "Your step-by-step plan for implementing the user's request...",
      "explanation": "A brief, friendly explanation of the code changes you made...",
      "files": [
        { "path": "index.html", "content": "..." },
        { "path": "game.js", "content": "..." },
        { "path": "style.css", "content": "..." }
      ]
    }
    \`\`\`
    - \`thinking\`: Before generating code, outline your plan. Describe how you'll approach the user's request, what files you'll modify or create, and any key logic you'll implement. This is for clarity and to ensure your approach is sound.
    - \`explanation\`: A brief, friendly summary of what you did. This is critical for the user to understand your work.
    - \`files\`: An array of file objects. Each object must have a \`path\` (e.g., \`index.html\`, \`scripts/player.js\`) and a \`content\` string.

2.  **File-Based Development:**
    - You will receive the user's entire project as an array of file objects. Your task is to return the **complete, updated array of all project files**.
    - You can add, remove, or modify any file to best implement the request. Create new files and folders (e.g. \`components/player.js\`) when it makes sense for organization.
    - The main entry point is \`index.html\`. Link your JavaScript files using \`<script type="module" src="./your-script.js"></script>\`.
    - The core engine code is provided to you within the \`index.html\` in a script tag with \`id="engine-script"\`. **DO NOT MODIFY THIS SCRIPT.** You should only modify the user's game logic files.

3.  **Imagination & Quality Mandate:**
    - **Mental Model:** Before you write any code, take a moment to 'imagine' the game world. Think about the visual aesthetics, the feel of the controls, and the player's experience. Briefly describe this vision in your 'thinking' step. This will help you make better design decisions.
    - **Absolute Completeness:** Every response must contain a full, working project. Never provide unfinished snippets or placeholders. Implement features fully and integrate them seamlessly.
    - **Zero-Bug Policy:** Your generated code must be robust and free of obvious bugs. Test your logic mentally. Your goal is to produce code that works perfectly on the first try.
    - **Proactive Refinement:** When modifying existing code, refactor existing parts if necessary to accommodate the new feature cleanly and maintainably.
    - **No External Libraries:** Do not use external libraries (like p5.js, PixiJS) unless they are part of the engine (Three.js for 3D). The engine provides all necessary functionality.
`;

const technologyInstructions = {
    '2D': `
**Technology Focus: 2D Canvas via Engine**
- The \`window.Engine\` object provides a 2D rendering and interaction layer. See engine API in the provided \`index.html\`.
`,
    '3D': `
**Technology Focus: 3D with Three.js via Engine**
- The \`window.Engine\` object is a wrapper around Three.js. See engine API in the provided \`index.html\`.
`
};

const getInitialFilesTemplate = (workspaceType: WorkspaceType): FileEntry[] => {
    const engineScript = getEngineScript(workspaceType);
    const is3D = workspaceType === '3D';

    const initialGameJs = is3D 
        ? `
console.log("3D Game Engine Initialized. Scene:", Engine.getScene());

const cube = Engine.create.mesh({
    geometry: 'box',
    material: 'phong',
    position: [0, 0.5, 0]
});

// Ground plane
Engine.create.mesh({
    geometry: 'plane',
    material: 'phong',
    position: [0, 0, 0]
}).rotation.x = -Math.PI / 2;


Engine.camera.follow(cube, [0, 4, 8]);
Engine.camera.lookAt(0,0,0);

Engine.onUpdate((deltaTime) => {
    cube.rotation.y += deltaTime * 0.5;
});
`
        : `
console.log("2D Game Engine Initialized.");

const player = Engine.create.sprite({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    width: 30,
    height: 30,
    asset: 'player',
    properties: {
        speed: 200 // pixels per second
    }
});

Engine.camera.follow(player);

Engine.onUpdate((deltaTime) => {
    const speed = player.speed;
    // Player movement
    if (Engine.input.isPressed('ArrowLeft') || Engine.input.isPressed('KeyA')) {
        player.x -= speed * deltaTime;
    }
    if (Engine.input.isPressed('ArrowRight') || Engine.input.isPressed('KeyD')) {
        player.x += speed * deltaTime;
    }
    if (Engine.input.isPressed('ArrowUp') || Engine.input.isPressed('KeyW')) {
        player.y -= speed * deltaTime;
    }
    if (Engine.input.isPressed('ArrowDown') || Engine.input.isPressed('KeyS')) {
        player.y += speed * deltaTime;
    }
});
`;
    
    const threeImportMap = is3D ? `"three": "https://esm.sh/three@0.166.1"` : '';

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>AI ${workspaceType} Game</title>
    <style>
        body { margin: 0; overflow: hidden; background: #111; }
        canvas { display: block; }
    </style>
    <script type="importmap">
    {
        "imports": {
            ${threeImportMap}
        }
    }
    </script>
</head>
<body>
    <canvas id="game-canvas"></canvas>
    <script type="module" id="engine-script">
// --- VibeCode-X Engine ---
${engineScript}
// --- End Engine ---
    </script>
    <script type="module" src="./game.js" id="game-logic"></script>
</body>
</html>`;

    return [
        { path: 'index.html', content: indexHtml },
        { path: 'game.js', content: initialGameJs.trim() }
    ];
};


const responseSchema = {
    type: Type.OBJECT,
    properties: {
        thinking: {
            type: Type.STRING,
            description: "A step-by-step plan for how you will implement the user's request. Describe the files you will create or modify and the logic you will add."
        },
        explanation: {
            type: Type.STRING,
            description: "A brief, friendly explanation of the code changes you made in response to the user's prompt."
        },
        files: {
            type: Type.ARRAY,
            description: "The complete and self-contained file structure for the web game.",
            items: {
                type: Type.OBJECT,
                properties: {
                    path: {
                        type: Type.STRING,
                        description: "The full path of the file (e.g., 'index.html', 'scripts/main.js')."
                    },
                    content: {
                        type: Type.STRING,
                        description: "The full source code or content of the file."
                    }
                },
                required: ['path', 'content']
            }
        }
    },
    required: ['thinking', 'explanation', 'files']
};


export const getInitialWorkspaceData = (workspaceType: WorkspaceType): { initialFiles: FileEntry[]; initialHistory: ModelChatMessage[] } => {
    const initialFiles = getInitialFilesTemplate(workspaceType);
    const welcomeMessage = `Welcome! I've set up a ${workspaceType} project for you using the VibeCode-X engine. The basic scene is running. What would you like to create?`;

    const initialFullResponse = JSON.stringify({
        thinking: "Initialized the project with a standard 2-file structure: index.html for the main page and engine, and game.js for the user's game logic.",
        explanation: welcomeMessage,
        files: initialFiles
    });
    
    const initialHistory: ModelChatMessage[] = [
        {
            id: `model-init-${Date.now()}`,
            role: 'model',
            thinking: "Initialized the project with a standard 2-file structure: index.html for the main page and engine, and game.js for the user's game logic.",
            text: welcomeMessage,
            fullResponse: initialFullResponse,
        }
    ];

    return { initialFiles, initialHistory };
};

export const createChatFromWorkspace = (workspace: Workspace): Chat => {
    if (!process.env.API_KEY) {
        throw new Error("API Key is not configured. Cannot contact AI service.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = baseSystemInstruction + technologyInstructions[workspace.type];

    const apiHistory = [];
    
    // Reconstruct the chat history for the AI. The model's fullResponse contains
    // the JSON with the file state from that turn, which is how it gets context.
    for (const msg of workspace.chatHistory) {
        if (msg.role === 'user') {
            apiHistory.push({ role: 'user', parts: [{ text: msg.text }] });
        } else if (msg.role === 'model') {
            apiHistory.push({ role: 'model', parts: [{ text: (msg as ModelChatMessage).fullResponse }] });
        }
    }

    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.1, 
            topP: 0.9,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            thinkingConfig: { thinkingBudget: 100 } // Enable thinking for better quality
        },
        history: apiHistory
    });

    return chat;
};
