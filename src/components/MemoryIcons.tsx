import React from 'react';
import {
    MemoryPlay,
    MemoryPause,
    MemoryVolumeHigh,
    MemoryVolumeMute,
    MemoryHeart,
    MemoryTarget,
    MemoryShield,
    MemoryGamepad
} from '@pictogrammers/memory';

interface MemoryIconProps {
    name: string;
    size?: number;
    className?: string;
}

export const MemoryIcon: React.FC<MemoryIconProps> = ({ name, size = 24, className = '' }) => {
    const iconStyle = {
        width: size,
        height: size,
        imageRendering: 'pixelated' as const,
    };

    const combinedClassName = `memory-icon ${className}`.trim();

    const renderIcon = () => {
        switch (name.toLowerCase()) {
            case 'play':
                return (
                    <svg style={iconStyle} className={combinedClassName} viewBox="0 0 24 24" fill="currentColor">
                        <path d={MemoryPlay} />
                    </svg>
                );
            case 'pause':
                return (
                    <svg style={iconStyle} className={combinedClassName} viewBox="0 0 24 24" fill="currentColor">
                        <path d={MemoryPause} />
                    </svg>
                );
            case 'volume':
                return (
                    <svg style={iconStyle} className={combinedClassName} viewBox="0 0 24 24" fill="currentColor">
                        <path d={MemoryVolumeHigh} />
                    </svg>
                );
            case 'mute':
                return (
                    <svg style={iconStyle} className={combinedClassName} viewBox="0 0 24 24" fill="currentColor">
                        <path d={MemoryVolumeMute} />
                    </svg>
                );
            case 'heart':
                return (
                    <svg style={iconStyle} className={combinedClassName} viewBox="0 0 24 24" fill="currentColor">
                        <path d={MemoryHeart} />
                    </svg>
                );
            case 'target':
                return (
                    <svg style={iconStyle} className={combinedClassName} viewBox="0 0 24 24" fill="currentColor">
                        <path d={MemoryTarget} />
                    </svg>
                );
            case 'shield':
                return (
                    <svg style={iconStyle} className={combinedClassName} viewBox="0 0 24 24" fill="currentColor">
                        <path d={MemoryShield} />
                    </svg>
                );
            case 'gamepad':
                return (
                    <svg style={iconStyle} className={combinedClassName} viewBox="0 0 24 24" fill="currentColor">
                        <path d={MemoryGamepad} />
                    </svg>
                );
            default:
                return (
                    <svg style={iconStyle} className={combinedClassName} viewBox="0 0 24 24" fill="currentColor">
                        <path d={MemoryTarget} />
                    </svg>
                );
        }
    };

    return renderIcon();
}; 