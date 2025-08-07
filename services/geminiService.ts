
import { GoogleGenAI, Chat, Type } from "@google/genai";
import type { WorkspaceType, Workspace, ModelChatMessage, FileEntry } from '../types';
import { getEngineScript } from "../lib/engine";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const baseSystemInstruction = `You are 'VibeCode-X', a world-class AI game development assistant. Your role is to act as a senior game developer and an entire creative team, transforming user prompts into complete, polished, and playable web-based games.

**Core Directive: Exceed Expectations**
Your primary goal is not just to fulfill requests, but to deliver a product that is more creative, complete, and engaging than the user asked for. Be ambitious.

**1. Output Format: The Project Manifest**
You MUST ALWAYS respond with a single, valid JSON object. This is your project delivery manifest.
Schema:
\`\`\`json
{
  "thinking": "Your detailed, step-by-step plan. This is your design document.",
  "explanation": "A brief, friendly summary of the new features and changes you've made.",
  "files": [
    { "path": "path/to/file.ext", "content": "..." }
  ]
}
\`\`\`

**2. Project Structure & Asset Management: Build a Real Project**
- **Rich File Structure:** DO NOT use a flat file structure. Always create logical directories. For example:
  - \`index.html\` (main entry point)
  - \`style.css\` (main styles)
  - \`scripts/main.js\` (main game logic)
  - \`scripts/player.js\`, \`scripts/enemy.js\` (component files)
- **Use Web Assets:** Your games must have visuals and sound to be engaging.
  - **Find and use royalty-free assets from the web.** Use specific, real URLs for images, textures, and even sounds.
  - When you use an asset from a URL, DO NOT add it to the 'files' array. Instead, reference the URL directly in your code (e.g., in an \`<img>\` tag's \`src\` or in the engine's asset loaders).
  - **Create SVG Assets:** For simple vector graphics (icons, UI elements, simple characters), you can create them directly as SVG files. Create a new file like \`assets/coin.svg\` and write the SVG XML content.
- **Engine Script:** The core engine code is provided in \`index.html\` within a script tag with \`id="engine-script"\`. **DO NOT MODIFY THIS SCRIPT.**

**3. The Quality Mandate: Create Polished Experiences**
- **Imagine First:** Before coding, visualize the game. What's the mood? How does it feel? Describe this vision in your 'thinking' step. This leads to better creative choices.
- **Proactive Development ("Game Juice"):** A great game feels alive. Go beyond the user's prompt and add details that enhance the experience, even if not explicitly asked for. Examples:
  - **Visuals:** Particle effects on collision, screen shake, animated sprites, UI feedback (button presses, score updates).
  - **Audio:** Sound effects for actions (jump, collect, shoot), background music.
  - **Gameplay:** A scoring system, lives, a start/end screen, increasing difficulty.
- **Zero-Bug & Completeness Policy:** Every response must be a complete, working project. No placeholders, no "TODO" comments. Test your logic mentally to ensure it's robust and bug-free.

**4. Technology & Engine Mastery**
- The \`window.Engine\` object is your primary tool. You must use its full capabilities: physics, audio, UI, particle effects, and camera controls.
- Remember the engine supports loading textures and images directly from URLs. Use this feature extensively.
`;

const technologyInstructions = {
    '2D': `
**Technology Focus: 2D Canvas via Engine**
- The \`window.Engine\` object provides a 2D rendering and interaction layer. See engine API in the provided \`index.html\`.
- You can create sprites with images by providing an \`imageUrl\` property.
`,
    '3D': `
**Technology Focus: 3D with Three.js via Engine**
- The \`window.Engine\` object is a wrapper around Three.js. See engine API in the provided \`index.html\`.
- You can create meshes with textures by providing a \`textureUrl\` in the material properties.
`
};

const getInitialFilesTemplate = (workspaceType: WorkspaceType): FileEntry[] => {
    const engineScript = getEngineScript(workspaceType);
    const is3D = workspaceType === '3D';

    const initialGameJs = is3D 
        ? `
import * as THREE from 'three';
console.log("3D Game Engine Initialized. Scene:", Engine.getScene());

// Ground
Engine.create.mesh({
    geometry: 'plane',
    material: 'phong',
    color: 0x444444,
    position: [0, 0, 0],
    scale: [10, 10, 10],
}).rotation.x = -Math.PI / 2;

// Main character
const character = Engine.create.mesh({
    geometry: 'capsule',
    material: 'phong',
    color: 0xeeeeee,
    position: [0, 1, 0]
});

// A decorative spinning cube
const spinningCube = Engine.create.mesh({
    geometry: 'box',
    material: 'phong',
    color: 0x00aaff,
    position: [-3, 1, -3]
});

// Simple lighting
Engine.create.light({type: 'directional', intensity: 0.8, position: [5, 10, 7]});

Engine.camera.follow(character, [0, 5, 8]);
Engine.camera.lookAt(character.position);

Engine.onUpdate((deltaTime) => {
    spinningCube.rotation.y += deltaTime;
    spinningCube.rotation.x += deltaTime * 0.5;

    // Basic character movement
    const speed = 5;
    if (Engine.input.isPressed('KeyW')) character.position.z -= speed * deltaTime;
    if (Engine.input.isPressed('KeyS')) character.position.z += speed * deltaTime;
    if (Engine.input.isPressed('KeyA')) character.position.x -= speed * deltaTime;
    if (Engine.input.isPressed('KeyD')) character.position.x += speed * deltaTime;
});
`
        : `
console.log("2D Game Engine Initialized.");

// Score tracking
let score = 0;
Engine.setData('score', 0);

// Player setup
const player = Engine.create.sprite({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    width: 50,
    height: 50,
    color: 'skyblue', // Fallback color
    // Let's find a simple character image online!
    imageUrl: 'https://placehold.co/50x50/3498db/ffffff.png?text=P', // A placeholder image
    properties: {
        speed: 250 // pixels per second
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

    // Update UI with score
    Engine.ui.drawText({
      text: \`Score: \${Engine.getData('score')}\`,
      x: 20,
      y: 30,
      size: 24,
      color: 'white',
      font: 'Arial'
    });
});
`;
    
    const threeImportMap = is3D ? `"three": "https://esm.sh/three@0.166.1"` : '';

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>AI ${workspaceType} Game</title>
    <link rel="stylesheet" href="style.css">
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
    <script type="module" src="./scripts/game.js" id="game-logic"></script>
</body>
</html>`;

    const styleCss = `
body { 
    margin: 0; 
    overflow: hidden; 
    background: #1a1a1a; 
}
canvas { 
    display: block; 
}
`;

    return [
        { path: 'index.html', content: indexHtml },
        { path: 'scripts/game.js', content: initialGameJs.trim() },
        { path: 'style.css', content: styleCss.trim() }
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
    const welcomeMessage = `I've set up a new ${workspaceType} project for you with a professional file structure. I've already added a basic scene with placeholder assets. Let's build something amazing! What's our first feature?`;

    const initialFullResponse = JSON.stringify({
        thinking: "Initialized the project with a professional structure: index.html, style.css, and a dedicated 'scripts' folder for game logic. Added a basic starter scene to demonstrate engine capabilities.",
        explanation: welcomeMessage,
        files: initialFiles
    });
    
    const initialHistory: ModelChatMessage[] = [
        {
            id: `model-init-${Date.now()}`,
            role: 'model',
            thinking: "Initialized the project with a professional structure: index.html, style.css, and a dedicated 'scripts' folder for game logic. Added a basic starter scene to demonstrate engine capabilities.",
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
