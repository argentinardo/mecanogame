import React from 'react';

interface CannonProps {
    isReloading: boolean;
    angle?: number;
}

export const Cannon: React.FC<CannonProps> = ({ isReloading, angle = 0 }) => {
    return (
        <div className={`cannon ${isReloading ? 'reloading' : ''}`}>
            <div className="cannon-base"></div>
            <div className="cannon-barrel" style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}></div>
        </div>
    );
}; 