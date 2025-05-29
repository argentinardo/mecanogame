import React from 'react';

interface CannonProps {
    isReloading: boolean;
    angle?: number;
}

export const Cannon: React.FC<CannonProps> = ({ isReloading, angle = 0 }) => {
    return (
        <div className={`cannon ${isReloading ? 'reloading' : ''}`} style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}>
            <div className="cannon-base"></div>
            <div className="cannon-barrel"></div>
        </div>
    );
}; 