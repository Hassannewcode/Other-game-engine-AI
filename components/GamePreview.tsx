
import React, { useRef, useEffect } from 'react';
import { FileEntry } from '../types';

interface GamePreviewProps {
    files: FileEntry[];
}

const mimeTypeMap: { [key: string]: string } = {
    js: 'text/javascript',
    css: 'text/css',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    ttf: 'font/ttf',
    otf: 'font/otf',
    woff: 'font/woff',
    woff2: 'font/woff2',
};


const GamePreview: React.FC<GamePreviewProps> = ({ files }) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe || files.length === 0) return;

        const indexHtmlFile = files.find(f => f.path === 'index.html');
        if (!indexHtmlFile) {
            iframe.srcdoc = '<h1>Error: index.html not found.</h1>';
            return;
        }

        const createdUrls: string[] = [];

        try {
            const assetUrls = new Map<string, string>();
            const importMap: { imports: Record<string, string> } = { imports: {} };

            // Create blob URLs for all assets and prepare the import map for JS files
            files.forEach(file => {
                if (file.path === 'index.html') return;
                
                const extension = file.path.split('.').pop()?.toLowerCase() || '';
                const mimeType = mimeTypeMap[extension] || 'application/octet-stream';
                
                const blob = new Blob([file.content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                createdUrls.push(url);

                const normalizedPath = file.path.startsWith('./') ? file.path.substring(2) : file.path;
                assetUrls.set(normalizedPath, url);
                
                // Add JS files to the import map for ES module resolution
                if (mimeType === 'text/javascript') {
                    importMap.imports[normalizedPath] = url;
                    importMap.imports[`./${normalizedPath}`] = url;
                    importMap.imports[`/${normalizedPath}`] = url;
                }
            });

            const parser = new DOMParser();
            const doc = parser.parseFromString(indexHtmlFile.content, 'text/html');

            // Find existing importmap or create a new one, then merge our dynamic imports
            let importMapScript = doc.querySelector<HTMLScriptElement>('script[type="importmap"]');
            if (!importMapScript) {
                importMapScript = doc.createElement('script');
                importMapScript.type = 'importmap';
                doc.head.insertBefore(importMapScript, doc.head.firstChild);
            }
            
            try {
                const existingMap = importMapScript.textContent ? JSON.parse(importMapScript.textContent) : {};
                if (!existingMap.imports) existingMap.imports = {};
                Object.assign(existingMap.imports, importMap.imports);
                importMapScript.textContent = JSON.stringify(existingMap, null, 2);
            } catch (e) {
                console.error("Failed to parse or merge import map, overwriting.", e);
                importMapScript.textContent = JSON.stringify(importMap, null, 2);
            }

            // Replace URLs for known asset-loading tags.
            // Note: We DO NOT replace script `src` attributes. The browser will use the import map to resolve them.
            const selectorsAndAttributes: Record<string, string> = {
                'link[rel="stylesheet"]': 'href',
                'img': 'src',
                'audio': 'src',
                'video': 'src',
                'source': 'src',
                'track': 'src'
            };

            Object.entries(selectorsAndAttributes).forEach(([selector, attribute]) => {
                doc.querySelectorAll(selector).forEach(el => {
                    const value = el.getAttribute(attribute);
                    if (value && !value.startsWith('data:') && !value.startsWith('http')) {
                        // Normalize path, removing leading './' or '/'
                        const normalizedValue = value.startsWith('./') ? value.substring(2) : (value.startsWith('/') ? value.substring(1) : value);
                        if (assetUrls.has(normalizedValue)) {
                            el.setAttribute(attribute, assetUrls.get(normalizedValue)!);
                        }
                    }
                });
            });

            const finalHtml = doc.documentElement.outerHTML;
            const finalHtmlBlob = new Blob([finalHtml], { type: 'text/html' });
            const finalUrl = URL.createObjectURL(finalHtmlBlob);
            createdUrls.push(finalUrl);

            iframe.src = finalUrl;

        } catch (error) {
            console.error("Error creating game preview:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            iframe.srcdoc = `<h1>Error Creating Preview</h1><pre>${errorMessage}</pre>`;
        }
        
        return () => {
            createdUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [files]);

    return (
        <iframe
            ref={iframeRef}
            title="Game Preview"
            sandbox="allow-scripts allow-same-origin" // allow-same-origin is crucial for module scripts in sandboxed iframes
            className="w-full h-full border-0"
        />
    );
};

export default GamePreview;
