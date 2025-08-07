
import { GoogleGenAI, Chat, Type } from "@google/genai";
import type { WorkspaceType } from '../types';
import { getEngineScript } from "../lib/engine";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const baseSystemInstruction = `You are 'VibeCode-X', a world-class AI game development assistant. You are a specialized tool, like a headless game engine. Your purpose is to help users create web-based games by generating code that uses a pre-defined JavaScript game engine API, available globally as \`window.Engine\`.

**Core Instructions:**

1.  **Output Format:** You MUST ALWAYS respond with a valid JSON object matching this schema: \`{ "explanation": "...", "code": "..." }\`.
    - \`explanation\`: A brief, friendly explanation of the code changes you made. This is critical for the user to understand your work.
    - \`code\`: The **complete, entire, and self-contained** HTML code for the web game.

2.  **Engine-Based Development:**
    - You do NOT write low-level canvas or WebGL code. You MUST use the provided \`window.Engine\` API.
    - The user's game logic exists inside a specific \`<script type="module" id="game-logic">\`. You will receive the entire HTML file in the history. Your task is to modify the contents of THIS SCRIPT TAG ONLY to implement the user's request.
    - NEVER change the engine script (\`engine-script\`). ONLY change the game logic script.
    - Return the FULL, updated HTML file in the \`code\` field of your JSON response. Do not provide patches or snippets.

3.  **Deployment & Mobile-First:**
    - All HTML, CSS, and JavaScript must be in a single \`index.html\` file.
    - The viewport meta tag \`<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">\` is mandatory.
    - The engine handles canvas resizing automatically. Do not add your own resize listeners.
    - Default to a clean, dark theme. Make things look good by default.

4.  **No External Libraries:** Unless explicitly part of the engine (like Three.js for 3D), do NOT use external libraries like p5.js, PixiJS, etc. The engine provides all necessary functionality.
`;

const technologyInstructions = {
    '2D': `
**Technology Focus: 2D Canvas via Engine**
- The \`window.Engine\` object provides a 2D rendering and interaction layer.
- **Key API methods:**
  - \`Engine.onUpdate((deltaTime) => { ... });\`: The main game loop.
  - \`Engine.create.sprite({ x, y, width, height, asset, properties });\`: Create a game object. \`asset\` can be 'player', 'enemy', 'coin', 'platform'.
  - \`Engine.destroy(sprite);\`: Remove a sprite.
  - \`Engine.input.isPressed('keyName');\`: Check for key presses (e.g., 'arrowLeft', 'space').
  - \`Engine.physics.checkCollision(spriteA, spriteB);\`: AABB collision check.
  - \`Engine.physics.getCollisions(sprite);\`: Get all sprites colliding with a given sprite.
  - \`Engine.setData('key', value)\`, \`Engine.getData('key')\`: Simple key-value store for game state.
`,
    '3D': `
**Technology Focus: 3D with Three.js via Engine**
- The \`window.Engine\` object is a wrapper around Three.js.
- For advanced use cases, the Three.js library is exposed as \`Engine.THREE\`. You can use it for complex geometries or materials not covered by the helpers.
- **Key API methods:**
  - \`Engine.onUpdate((deltaTime) => { ... });\`: The main game loop.
  - \`Engine.create.mesh({ geometry, material, position, properties });\`: Create a 3D object. \`geometry\` can be 'box', 'sphere', 'capsule'. \`material\` can be 'normal', 'phong'.
  - \`Engine.create.light({ type, ... });\`: Create a light ('ambient', 'directional').
  - \`Engine.destroy(mesh);\`: Remove a mesh.
  - \`Engine.input.isPressed('keyName');\`: Check for key presses (e.g., 'keyW', 'arrowUp').
  - \`Engine.camera.follow(mesh, offset?);\`: Make the camera follow a mesh.
  - \`Engine.setData('key', value)\`, \`Engine.getData('key')\`: Simple key-value store for game state.
`
};

const getInitialCodeTemplate = (workspaceType: WorkspaceType) => {
    const engineScript = getEngineScript(workspaceType);
    const initialGameLogic = workspaceType === '2D' 
        ? `
        Engine.onUpdate((deltaTime) => {
            // The canvas is cleared automatically.
            // You can start adding your game logic here!
        });

        const canvas = Engine.getCanvas();
        console.log("2D Game Engine Initialized. Canvas:", canvas);
        `
        : `
        const cube = Engine.create.mesh({
            geometry: 'box',
            position: [0, 0.5, 0]
        });

        Engine.camera.follow(cube, [0, 4, 8]);
        
        Engine.onUpdate((deltaTime) => {
            cube.rotation.y += deltaTime;
        });

        console.log("3D Game Engine Initialized. Scene:", Engine.getScene());
        `;
    
    const threeImportMap = workspaceType === '3D' ? `"three": "https://esm.sh/three@0.166.1"` : '';

    return `<!DOCTYPE html>
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
    <script type="module" id="game-logic">
// --- Your Game Code ---
${initialGameLogic}
// --- End Game Code ---
    </script>
</body>
</html>`;
};


const responseSchema = {
    type: Type.OBJECT,
    properties: {
        explanation: {
            type: Type.STRING,
            description: "A brief, friendly explanation of the code changes you made in response to the user's prompt."
        },
        code: {
            type: Type.STRING,
            description: "The complete and self-contained HTML code for the web game. It must include all necessary HTML, CSS, and JavaScript within a single file."
        }
    },
    required: ['explanation', 'code']
};


export const createAIGameChatSession = (workspaceType: WorkspaceType): { chat: Chat; initialCode: string; welcomeMessage: string; } => {
    if (!process.env.API_KEY) {
        throw new Error("API Key is not configured. Cannot contact AI service.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = baseSystemInstruction + technologyInstructions[workspaceType];
    const initialCode = getInitialCodeTemplate(workspaceType);
    const welcomeMessage = `Welcome! I've set up a ${workspaceType} project for you using the VibeCode-X engine. The basic scene is running. What would you like to create?`;

    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.1, 
            topP: 0.9,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            thinkingConfig: { thinkingBudget: 0 } // Optimize for speed
        },
        history: [
             {
                role: 'user',
                parts: [{ text: `Start a new ${workspaceType} project.` }],
            },
            {
                role: 'model',
                parts: [{ text: JSON.stringify({
                    explanation: welcomeMessage,
                    code: initialCode
                }) }]
            }
        ]
    });

    return { chat, initialCode, welcomeMessage };
};