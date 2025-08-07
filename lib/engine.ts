
import { WorkspaceType } from '../types';

export const getEngineScript = (workspaceType: WorkspaceType): string => {
    const consoleOverride = `
    (function() {
        if (typeof window.parent === 'undefined' || window.parent === window) return;
        const originalConsole = { ...console };

        const serializeArg = (arg) => {
             if (arg instanceof Error) {
                return arg.stack || arg.message;
             }
             if (typeof arg === 'object' && arg !== null) {
                try {
                    // Simple serializer to avoid circular reference issues
                    const cache = new Set();
                    return JSON.stringify(arg, (key, value) => {
                        if (typeof value === 'object' && value !== null) {
                            if (cache.has(value)) return '[Circular]';
                            cache.add(value);
                        }
                        return value;
                    }, 2);
                } catch (e) {
                    return '[Unserializable Object]';
                }
             }
             return String(arg);
        };

        const postLog = (type, args) => {
            const message = args.map(serializeArg).join(' ');
            window.parent.postMessage({ type: 'console', payload: { type, message } }, '*');
        };

        console.log = (...args) => {
            originalConsole.log.apply(console, args);
            postLog('log', args);
        };
        console.warn = (...args) => {
            originalConsole.warn.apply(console, args);
            postLog('warn', args);
        };
        console.error = (...args) => {
            originalConsole.error.apply(console, args);
            postLog('error', args);
        };
        console.info = (...args) => {
            originalConsole.info.apply(console, args);
            postLog('info', args);
        };
    })();
    `;

    if (workspaceType === '2D') {
        return `
        ${consoleOverride}
        const canvas = document.getElementById('game-canvas');
        if (!canvas) throw new Error('Could not find canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context');

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const keysPressed = new Set();
        document.addEventListener('keydown', (e) => keysPressed.add(e.code));
        document.addEventListener('keyup', (e) => keysPressed.delete(e.code));

        let sprites = [];
        let particles = [];
        let uiTasks = [];
        let onUpdateCallback = (deltaTime) => {};
        let lastTime = 0;
        const state = new Map();

        const camera = {
            x: 0,
            y: 0,
            target: null,
            offset: { x: 0, y: 0 }
        };

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        function playSound(type) {
            if (!audioContext || audioContext.state === 'suspended') {
                audioContext.resume();
            }
            if (!audioContext) return;
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 1);
            
            let freq = 440;
            switch(type) {
                case 'jump': freq = 660; break;
                case 'collect': freq = 880; break;
                case 'explosion': freq = 220; break;
                case 'shoot': freq = 550; break;
            }

            oscillator.type = type === 'explosion' ? 'sawtooth' : 'sine';
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
        }

        window.Engine = {
            getCanvas: () => canvas,
            onUpdate: (callback) => { onUpdateCallback = callback; },
            setData: (key, value) => state.set(key, value),
            getData: (key) => state.get(key),
            create: {
                sprite: ({ x = 0, y = 0, width = 20, height = 20, asset = 'default', properties = {} }) => {
                    const colorMap = { player: 'skyblue', enemy: 'tomato', platform: 'lightgreen', coin: 'gold', default: 'white' };
                    const sprite = { id: Math.random(), x, y, width, height, asset, color: colorMap[asset] || colorMap.default, ...properties };
                    sprites.push(sprite);
                    return sprite;
                },
                 particles: ({ x=0, y=0, count=10, color='orange', size=2, life=0.5 }) => {
                    for(let i=0; i<count; i++) {
                        particles.push({
                            x, y,
                            vx: (Math.random() - 0.5) * 150,
                            vy: (Math.random() - 0.5) * 150,
                            life: Math.random() * life,
                            color, size
                        });
                    }
                }
            },
            destroy: (spriteToDestroy) => {
                sprites = sprites.filter(s => s !== spriteToDestroy);
            },
            input: {
                isPressed: (key) => {
                    const keyMap = { 'space': 'Space', 'arrowleft': 'ArrowLeft', 'arrowright': 'ArrowRight', 'arrowup': 'ArrowUp', 'arrowdown': 'ArrowDown' };
                    const mappedKey = key.toLowerCase().replace(/ /g, '');
                    return keysPressed.has(keyMap[mappedKey] || key);
                }
            },
            physics: {
                checkCollision: (spriteA, spriteB) => {
                    if (!spriteA || !spriteB) return false;
                    return spriteA.x < spriteB.x + spriteB.width &&
                           spriteA.x + spriteA.width > spriteB.x &&
                           spriteA.y < spriteB.y + spriteB.height &&
                           spriteA.y + spriteA.height > spriteB.y;
                },
                getCollisions: (sprite) => {
                    return sprites.filter(other => sprite !== other && window.Engine.physics.checkCollision(sprite, other));
                }
            },
            camera: {
                follow: (sprite, offset = {x: 0, y: 0}) => {
                    camera.target = sprite;
                    camera.offset = offset;
                }
            },
            ui: {
                drawText: (config) => uiTasks.push(config)
            },
            audio: {
                play: (soundName) => playSound(soundName)
            }
        };

        function gameLoop(timestamp) {
            const deltaTime = (timestamp - lastTime) / 1000 || 0;
            lastTime = timestamp;

            if (camera.target) {
                camera.x = camera.target.x - (canvas.width / 2) + camera.offset.x;
                camera.y = camera.target.y - (canvas.height / 2) + camera.offset.y;
            }

            particles = particles.filter(p => p.life > 0);
            particles.forEach(p => {
                p.x += p.vx * deltaTime;
                p.y += p.vy * deltaTime;
                p.life -= deltaTime;
            });
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(-camera.x, -camera.y);
            
            onUpdateCallback(deltaTime);
            
            sprites.forEach(sprite => {
                ctx.fillStyle = sprite.color;
                ctx.fillRect(sprite.x, sprite.y, sprite.width, sprite.height);
            });

            particles.forEach(p => {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life / 0.5);
                ctx.fillRect(p.x, p.y, p.size, p.size);
            });
            ctx.globalAlpha = 1.0;

            ctx.restore();

            uiTasks.forEach(task => {
                ctx.fillStyle = task.color || 'white';
                ctx.font = \`\${task.size || 16}px \${task.font || 'sans-serif'}\`;
                ctx.textAlign = task.align || 'left';
                ctx.fillText(task.text, task.x, task.y);
            });
            uiTasks = [];

            requestAnimationFrame(gameLoop);
        }

        requestAnimationFrame(gameLoop);
    `;
    }

    if (workspaceType === '3D') {
        return `
        ${consoleOverride}
        import * as THREE from 'three';

        const canvas = document.getElementById('game-canvas');
        if (!canvas) throw new Error('Could not find canvas');

        const uiCanvas = document.createElement('canvas');
        const uiCtx = uiCanvas.getContext('2d');
        document.body.appendChild(uiCanvas);
        uiCanvas.style.position = 'absolute';
        uiCanvas.style.left = '0';
        uiCanvas.style.top = '0';
        uiCanvas.style.pointerEvents = 'none';

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111111);
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        const clock = new THREE.Clock();
        const state = new Map();
        let cameraTarget = null;
        let cameraOffset = new THREE.Vector3(0, 5, 10);
        let uiTasks = [];

        function resizeAll() {
             camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            uiCanvas.width = window.innerWidth;
            uiCanvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeAll);
        resizeAll();

        const keysPressed = new Set();
        document.addEventListener('keydown', (e) => keysPressed.add(e.code));
        document.addEventListener('keyup', (e) => keysPressed.delete(e.code));

        let meshes = [];
        let onUpdateCallback = (deltaTime) => {};

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        function playSound(type) {
            if (!audioContext || audioContext.state === 'suspended') {
                audioContext.resume();
            }
            if (!audioContext) return;
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 1);
            
            let freq = 440;
            switch(type) {
                case 'jump': freq = 660; break;
                case 'collect': freq = 880; break;
                case 'explosion': freq = 220; break;
                case 'shoot': freq = 550; break;
            }

            oscillator.type = type === 'explosion' ? 'sawtooth' : 'sine';
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
        }

        window.Engine = {
            THREE, 
            getScene: () => scene,
            getCamera: () => camera,
            onUpdate: (callback) => { onUpdateCallback = callback; },
            setData: (key, value) => state.set(key, value),
            getData: (key) => state.get(key),
            create: {
                mesh: ({ geometry = 'box', material = 'normal', position = [0,0,0], properties = {} }) => {
                    let geom;
                    switch(geometry) {
                        case 'sphere': geom = new THREE.SphereGeometry(0.5, 32, 16); break;
                        case 'capsule': geom = new THREE.CapsuleGeometry(0.5, 0.5, 16, 8); break;
                        case 'plane': geom = new THREE.PlaneGeometry(10, 10); break;
                        case 'box': default: geom = new THREE.BoxGeometry(1, 1, 1); break;
                    }
                    
                    let mat;
                    switch(material) {
                        case 'phong': mat = new THREE.MeshPhongMaterial({ color: 0xcccccc }); break;
                        case 'lambert': mat = new THREE.MeshLambertMaterial({ color: 0xcccccc }); break;
                        case 'normal': default: mat = new THREE.MeshNormalMaterial(); break;
                    }

                    const mesh = new THREE.Mesh(geom, mat);
                    mesh.position.set(...position);
                    Object.assign(mesh.userData, properties);
                    scene.add(mesh);
                    meshes.push(mesh);
                    return mesh;
                },
                light: ({ type = 'ambient', color = 0xffffff, intensity = 1, position = [0, 10, 0] }) => {
                    let light;
                    switch(type) {
                        case 'directional': 
                            light = new THREE.DirectionalLight(color, intensity);
                            light.position.set(...position);
                            break;
                        case 'point':
                            light = new THREE.PointLight(color, intensity);
                            light.position.set(...position);
                            break;
                        case 'ambient':
                        default:
                            light = new THREE.AmbientLight(color, intensity);
                            break;
                    }
                    scene.add(light);
                    return light;
                }
            },
            destroy: (object3D) => {
                if (object3D.geometry) object3D.geometry.dispose();
                if (object3D.material && Array.isArray(object3D.material)) {
                    object3D.material.forEach(m => m.dispose());
                } else if (object3D.material) {
                    object3D.material.dispose();
                }
                scene.remove(object3D);
                meshes = meshes.filter(m => m !== object3D);
            },
            input: {
                isPressed: (key) => {
                    const keyMap = { 'space': 'Space', 'arrowleft': 'ArrowLeft', 'arrowright': 'ArrowRight', 'arrowup': 'ArrowUp', 'arrowdown': 'ArrowDown', 'keyw': 'KeyW', 'keya': 'KeyA', 'keys': 'KeyS', 'keyd': 'KeyD'};
                    const mappedKey = key.toLowerCase().replace(/ /g, '');
                    return keysPressed.has(keyMap[mappedKey] || key);
                }
            },
            camera: {
                follow: (meshToFollow, offset = [0, 5, 10]) => {
                    cameraTarget = meshToFollow;
                    cameraOffset.set(...offset);
                },
                lookAt: (x, y, z) => {
                    cameraTarget = null;
                    camera.lookAt(x, y, z);
                }
            },
            physics: {
                checkCollision: (meshA, meshB) => {
                    if (!meshA || !meshB) return false;
                    meshA.geometry.computeBoundingBox();
                    meshB.geometry.computeBoundingBox();
                    const boxA = new THREE.Box3().setFromObject(meshA);
                    const boxB = new THREE.Box3().setFromObject(meshB);
                    return boxA.intersectsBox(boxB);
                },
                getCollisions: (mesh) => {
                    const boxA = new THREE.Box3().setFromObject(mesh);
                    return meshes.filter(other => {
                        if (mesh === other) return false;
                        const boxB = new THREE.Box3().setFromObject(other);
                        return boxA.intersectsBox(boxB);
                    });
                }
            },
            ui: {
                drawText: (config) => uiTasks.push(config)
            },
            audio: {
                play: (soundName) => playSound(soundName)
            }
        };

        camera.position.z = 10;
        const gridHelper = new THREE.GridHelper( 100, 100, 0x333333, 0x333333 );
        scene.add( gridHelper );
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);

        function animate() {
            const deltaTime = clock.getDelta();
            
            onUpdateCallback(deltaTime);
            
            if (cameraTarget) {
                const targetPosition = cameraTarget.position.clone().add(cameraOffset);
                camera.position.lerp(targetPosition, 0.08);
                camera.lookAt(cameraTarget.position);
            }

            renderer.render(scene, camera);

            if (uiCtx) {
                uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
                uiTasks.forEach(task => {
                    uiCtx.fillStyle = task.color || 'white';
                    uiCtx.font = \`\${task.size || 16}px \${task.font || 'sans-serif'}\`;
                    uiCtx.textAlign = task.align || 'left';
                    uiCtx.fillText(task.text, task.x, task.y);
                });
                uiTasks = [];
            }
        }
        renderer.setAnimationLoop(animate);
        `;
    }

    return '';
};
