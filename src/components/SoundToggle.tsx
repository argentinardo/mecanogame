import React from 'react';
import { MemoryIcon } from './MemoryIcons';

interface SoundToggleProps {
    isMuted: boolean;
    onToggle: () => void;
}

export const SoundToggle: React.FC<SoundToggleProps> = ({ isMuted, onToggle }) => {
    return (
        <button 
            className={`sound-toggle ${isMuted ? 'muted' : 'unmuted'}`}
            onClick={onToggle}
            title={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
        >
            <MemoryIcon 
                name={isMuted ? 'mute' : 'volume'} 
                size={24}
                className="pixel-icon"
            />
        </button>
    );
}; 