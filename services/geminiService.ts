
import { GoogleGenAI, Chat, Type } from "@google/genai";
import type { WorkspaceType, Workspace, ModelChatMessage } from '../types';
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

**Development Philosophy & Quality Mandate:**

1.  **Absolute Completeness:** Every response must be a fully working, complete piece of code. Never provide unfinished snippets, placeholders like \`// ... your logic here\`, or code that requires the user to fix it. If a user asks for a feature, you implement it fully and integrate it seamlessly.
2.  **Zero-Bug Policy:** Your generated code must be robust and free of obvious bugs. Test your logic mentally. For example, check for null references, ensure loop conditions are correct, and handle edge cases where appropriate. Your goal is to produce code that works perfectly on the first try.
3.  **Relevance and Focus:** Only implement what the user asks for. Do not add unrelated features. Stick to the scope of the request, but implement it to the highest standard.
4.  **Proactive Refinement:** When modifying existing code, seamlessly integrate the new logic. Do not just append code; refactor existing parts if necessary to accommodate the new feature cleanly and maintainably.
5.  **No External Libraries:** Unless explicitly part of the engine (like Three.js for 3D), do NOT use external libraries like p5.js, PixiJS, etc. The engine provides all necessary functionality.
`;

const technologyInstructions = {
    '2D': `
**Technology Focus: 2D Canvas via Engine**
- The \`window.Engine\` object provides a 2D rendering and interaction layer.
- **Key API methods:**
  - \`Engine.onUpdate((deltaTime) => { ... });\`: The main game loop.
  - \`Engine.create.sprite({ x, y, width, height, asset, properties });\`: Create a game object. \`asset\` can be 'player', 'enemy', 'coin', 'platform'.
  - \`Engine.create.particles({ x, y, count, color, size, life });\`: Creates a burst of particles.
  - \`Engine.destroy(sprite);\`: Remove a sprite.
  - \`Engine.input.isPressed('keyName');\`: Check for key presses (e.g., 'arrowLeft', 'space').
  - \`Engine.physics.checkCollision(spriteA, spriteB);\`: AABB collision check.
  - \`Engine.physics.getCollisions(sprite);\`: Get all sprites colliding with a given sprite.
  - \`Engine.camera.follow(sprite, {x: 0, y: 0});\`: Make the camera follow a sprite. Pass an offset object.
  - \`Engine.ui.drawText({ text, x, y, size, font, color, align });\`: Draw text on the screen.
  - \`Engine.audio.play(soundName);\`: Play a predefined sound. Available sounds: 'jump', 'collect', 'explosion', 'shoot'.
  - \`Engine.setData('key', value)\`, \`Engine.getData('key')\`: Simple key-value store for game state.
`,
    '3D': `
**Technology Focus: 3D with Three.js via Engine**
- The \`window.Engine\` object is a wrapper around Three.js.
- For advanced use cases, the Three.js library is exposed as \`Engine.THREE\`.
- **Key API methods:**
  - \`Engine.onUpdate((deltaTime) => { ... });\`: The main game loop.
  - \`Engine.create.mesh({ geometry, material, position, properties });\`: Create a 3D object. \`geometry\` can be 'box', 'sphere', 'capsule'. \`material\` can be 'normal', 'phong'.
  - \`Engine.create.light({ type, ... });\`: Create a light ('ambient', 'directional').
  - \`Engine.destroy(mesh);\`: Remove a mesh.
  - \`Engine.input.isPressed('keyName');\`: Check for key presses (e.g., 'keyW', 'arrowUp').
  - \`Engine.physics.checkCollision(meshA, meshB);\`: AABB collision check.
  - \`Engine.physics.getCollisions(mesh);\`: Get all meshes colliding with a given mesh.
  - \`Engine.camera.follow(mesh, offset?);\`: Make the camera follow a mesh.
  - \`Engine.ui.drawText({ text, x, y, size, font, color, align });\`: Draw text on a UI overlay.
  - \`Engine.audio.play(soundName);\`: Play a predefined sound. Available sounds: 'jump', 'collect', 'explosion', 'shoot'.
  - \`Engine.setData('key', value)\`, \`Engine.getData('key')\`: Simple key-value store for game state.
`
};

const getInitialCodeTemplate = (workspaceType: WorkspaceType) => {
    const engineScript = getEngineScript(workspaceType);
    const initialGameLogic = workspaceType === '2D' 
        ? `
        const player = Engine.create.sprite({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            width: 30,
            height: 30,
            asset: 'player'
        });

        const speed = 200; // pixels per second

        Engine.onUpdate((deltaTime) => {
            // Player movement
            if (Engine.input.isPressed('ArrowLeft')) {
                player.x -= speed * deltaTime;
            }
            if (Engine.input.isPressed('ArrowRight')) {
                player.x += speed * deltaTime;
            }
            if (Engine.input.isPressed('ArrowUp')) {
                player.y -= speed * deltaTime;
            }
            if (Engine.input.isPressed('ArrowDown')) {
                player.y += speed * deltaTime;
            }
        });

        console.log("2D Game Engine Initialized.");
        `
        : `
        const cube = Engine.create.mesh({
            geometry: 'box',
            position: [0, 0.5, 0]
        });

        Engine.create.mesh({
            geometry: 'plane',
            material: 'phong',
            position: [0, -0.5, 0]
        }).rotation.x = -Math.PI / 2;


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


export const getInitialWorkspaceData = (workspaceType: WorkspaceType): { initialCode: string; initialHistory: ModelChatMessage[] } => {
    const initialCode = getInitialCodeTemplate(workspaceType);
    const welcomeMessage = `Welcome! I've set up a ${workspaceType} project for you using the VibeCode-X engine. The basic scene is running. What would you like to create?`;

    const initialFullResponse = JSON.stringify({
        explanation: welcomeMessage,
        code: initialCode
    });
    
    const initialHistory: ModelChatMessage[] = [
        {
            id: `model-init-${Date.now()}`,
            role: 'model',
            text: welcomeMessage,
            fullResponse: initialFullResponse,
        }
    ];

    return { initialCode, initialHistory };
};

export const createChatFromWorkspace = (workspace: Workspace): Chat => {
    if (!process.env.API_KEY) {
        throw new Error("API Key is not configured. Cannot contact AI service.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = baseSystemInstruction + technologyInstructions[workspace.type];

    const apiHistory = [];
    apiHistory.push({
        role: 'user',
        parts: [{ text: `You have created a ${workspace.type} project. The user is now going to give you instructions. Here is the code you previously generated.` }],
    });
    
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
            thinkingConfig: { thinkingBudget: 0 }
        },
        history: apiHistory
    });

    return chat;
};
