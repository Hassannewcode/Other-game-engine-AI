
import { WorkspaceType } from '../types';

export const getEngineScript = (workspaceType: WorkspaceType): string => {
    if (workspaceType === '2D') {
        return `
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
        let onUpdateCallback = (deltaTime) => {};
        let lastTime = 0;
        const state = new Map();

        window.Engine = {
            getCanvas: () => canvas,
            onUpdate: (callback) => { onUpdateCallback = callback; },
            setData: (key, value) => state.set(key, value),
            getData: (key) => state.get(key),
            create: {
                sprite: ({ x = 0, y = 0, width = 20, height = 20, asset = 'default', properties = {} }) => {
                    const colorMap = { player: 'skyblue', enemy: 'tomato', platform: 'lightgreen', coin: 'gold', default: 'white' };
                    const sprite = { x, y, width, height, asset, color: colorMap[asset] || colorMap.default, ...properties };
                    sprites.push(sprite);
                    return sprite;
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
            }
        };

        function gameLoop(timestamp) {
            const deltaTime = (timestamp - lastTime) / 1000;
            lastTime = timestamp;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (onUpdateCallback) {
                onUpdateCallback(deltaTime || 0);
            }
            
            sprites.forEach(sprite => {
                ctx.fillStyle = sprite.color;
                ctx.fillRect(sprite.x, sprite.y, sprite.width, sprite.height);
            });

            requestAnimationFrame(gameLoop);
        }

        requestAnimationFrame(gameLoop);
    `;
    }

    if (workspaceType === '3D') {
        // This script is a module and relies on an import map for 'three'.
        return `
        import * as THREE from 'three';

        const canvas = document.getElementById('game-canvas');
        if (!canvas) throw new Error('Could not find canvas');

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111111);
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        const clock = new THREE.Clock();
        const state = new Map();
        let cameraTarget = null;
        let cameraOffset = new THREE.Vector3(0, 5, 10);

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        const keysPressed = new Set();
        document.addEventListener('keydown', (e) => keysPressed.add(e.code));
        document.addEventListener('keyup', (e) => keysPressed.delete(e.code));

        let meshes = [];
        let onUpdateCallback = (deltaTime) => {};

        window.Engine = {
            THREE, // Expose THREE for advanced use
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
                    cameraTarget = null; // stop following
                    camera.lookAt(x, y, z);
                }
            }
        };

        // Default scene setup
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
            
            if (onUpdateCallback) {
                onUpdateCallback(deltaTime);
            }
            
            if (cameraTarget) {
                const targetPosition = cameraTarget.position.clone().add(cameraOffset);
                camera.position.lerp(targetPosition, 0.08); // Smoother follow
                camera.lookAt(cameraTarget.position);
            }

            renderer.render(scene, camera);
        }
        renderer.setAnimationLoop(animate);
        `;
    }

    return ''; // Should not happen
};