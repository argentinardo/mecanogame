import React from 'react';

interface CannonProps {
    isReloading: boolean;
}

export const Cannon: React.FC<CannonProps> = ({ isReloading }) => {
    return (
        <div className={`cannon ${isReloading ? 'reloading' : ''}`}>
            <div className="cannon-base"></div>
            <div className="cannon-barrel"></div>
        </div>
    );
}; 