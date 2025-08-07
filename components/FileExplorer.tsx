
import React from 'react';
import { FileEntry } from '../types';
import FileIcon from './icons/FileIcon';

interface FileExplorerProps {
    files: FileEntry[];
    activePath: string;
    onSelect: (path: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ files, activePath, onSelect }) => {
    // A simple sort to keep files in a predictable order.
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

    return (
        <div className="p-2 h-full overflow-y-auto">
            <h2 className="text-xs font-bold uppercase text-gray-500 px-2 mb-2 tracking-wider">Project Files</h2>
            <nav>
                <ul>
                    {sortedFiles.map(file => (
                        <li key={file.path}>
                            <button
                                onClick={() => onSelect(file.path)}
                                className={`w-full text-left flex items-center px-2 py-1.5 text-sm rounded-md transition-colors ${
                                    activePath === file.path
                                        ? 'bg-blue-500/20 text-blue-300'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                                }`}
                            >
                                <FileIcon className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
                                <span className="truncate">{file.path}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        </div>
    );
};

export default FileExplorer;
