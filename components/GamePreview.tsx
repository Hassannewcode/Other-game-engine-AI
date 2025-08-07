
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
            const fileBlobUrls = new Map<string, string>();

            // Create blob URLs for all files and map them by their paths.
            files.forEach(file => {
                const extension = file.path.split('.').pop()?.toLowerCase() || '';
                const mimeType = mimeTypeMap[extension] || 'application/octet-stream';
                
                const blob = new Blob([file.content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                createdUrls.push(url);
                
                // Normalize path for consistent lookups (e.g., remove leading './' or '/')
                const normalizedPath = file.path.replace(/^\.?\//, '');
                fileBlobUrls.set(normalizedPath, url);
            });

            const parser = new DOMParser();
            const doc = parser.parseFromString(indexHtmlFile.content, 'text/html');

            // Find all elements with src or href attributes that might need replacement.
            doc.querySelectorAll('[src], [href]').forEach(el => {
                const src = el.getAttribute('src');
                const href = el.getAttribute('href');
                const attributeName = src !== null ? 'src' : 'href';
                const pathValue = src || href;

                // Only replace relative paths. Ignore absolute URLs, data URIs, etc.
                if (pathValue && !pathValue.startsWith('http') && !pathValue.startsWith('data:') && !pathValue.startsWith('blob:')) {
                    const normalizedPath = pathValue.replace(/^\.?\//, '');
                    const blobUrl = fileBlobUrls.get(normalizedPath);

                    if (blobUrl) {
                        el.setAttribute(attributeName, blobUrl);
                    } else {
                        console.warn(`Could not find a blob URL for path: ${pathValue} (normalized: ${normalizedPath})`);
                    }
                }
            });

            // Set the iframe content using srcdoc for better security and isolation.
            iframe.srcdoc = doc.documentElement.outerHTML;

        } catch (error) {
            console.error("Error creating game preview:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            iframe.srcdoc = `<h1>Error Creating Preview</h1><pre>${errorMessage}</pre>`;
        }
        
        // Cleanup function to revoke blob URLs when the component unmounts or files change.
        return () => {
            createdUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [files]);

    return (
        <iframe
            ref={iframeRef}
            title="Game Preview"
            sandbox="allow-scripts allow-same-origin" // allow-same-origin is crucial for module scripts and other cross-origin behaviors inside the sandbox.
            className="w-full h-full border-0"
        />
    );
};

export default GamePreview;
