import React from 'react';

const AIIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 8V4H8" />
        <rect width="8" height="4" x="8" y="16" rx="1" />
        <path d="M4 12a8 8 0 0 0 16 0Z" />
    </svg>
);

export default AIIcon;