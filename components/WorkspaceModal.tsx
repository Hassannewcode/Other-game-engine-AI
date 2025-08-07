
import React from 'react';
import type { WorkspaceType } from '../types';
import GridIcon from './icons/GridIcon';
import CubeIcon from './icons/CubeIcon';
import AIIcon from './icons/AIIcon';

interface WorkspaceModalProps {
  onSelect: (workspace: WorkspaceType) => void;
}

const WorkspaceModal: React.FC<WorkspaceModalProps> = ({ onSelect }) => {
  return (
    <div className="w-screen h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
        <div className="flex items-center gap-4 mb-4">
             <AIIcon className="w-12 h-12 text-blue-500" />
            <h1 className="text-5xl font-bold text-gray-100 tracking-tighter">VibeCode-X</h1>
        </div>
        <p className="text-lg text-gray-400 mb-12 max-w-2xl">
            Welcome to the AI Game Studio. Choose a workspace to begin. Your AI assistant will be specialized for your selected environment.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
            <button
            onClick={() => onSelect('2D')}
            className="group relative bg-[#121212] p-8 rounded-lg border border-gray-800/70 hover:border-blue-500/50 hover:bg-blue-900/10 transition-all duration-300"
            >
                <div className="flex flex-col items-center">
                    <GridIcon className="w-16 h-16 mb-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
                    <h2 className="text-2xl font-semibold text-gray-200 group-hover:text-white">2D Game</h2>
                    <p className="text-gray-500 mt-2 group-hover:text-gray-400">Build with the HTML5 Canvas API. Ideal for platformers, top-down shooters, and retro games.</p>
                </div>
            </button>
            <button
            onClick={() => onSelect('3D')}
            className="group relative bg-[#121212] p-8 rounded-lg border border-gray-800/70 hover:border-blue-500/50 hover:bg-blue-900/10 transition-all duration-300"
            >
                <div className="flex flex-col items-center">
                    <CubeIcon className="w-16 h-16 mb-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
                    <h2 className="text-2xl font-semibold text-gray-200 group-hover:text-white">3D Game</h2>
                    <p className="text-gray-500 mt-2 group-hover:text-gray-400">Build with Three.js & WebGL. Perfect for 3D worlds, interactive scenes, and modern experiences.</p>
                </div>
            </button>
      </div>
    </div>
  );
};

export default WorkspaceModal;
