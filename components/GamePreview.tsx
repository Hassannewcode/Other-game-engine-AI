import React, { useRef, useEffect } from 'react';

interface GamePreviewProps {
    htmlContent: string;
}

const GamePreview: React.FC<GamePreviewProps> = ({ htmlContent }) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        // Using a Blob URL is a more robust way to load dynamic HTML content
        // into an iframe, especially when dealing with module scripts and import maps.
        // It can avoid some browser-specific quirks related to srcdoc.
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        iframe.src = url;

        // It's important to revoke the object URL when the component unmounts
        // or the content changes, to prevent memory leaks.
        return () => {
            URL.revokeObjectURL(url);
        };
    }, [htmlContent]);

    return (
        <iframe
            ref={iframeRef}
            title="Game Preview"
            sandbox="allow-scripts allow-same-origin" // allow-same-origin is needed for modules in sandboxed iframes, including from blob URLs
            className="w-full h-full border-0"
        />
    );
};

export default GamePreview;
