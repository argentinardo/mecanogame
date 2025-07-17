import React, { useEffect, useState } from 'react';
// Sprite de la nave
import spriteAvion from '../assets/images/sprite-avion-102.png';

interface CannonProps {
    isReloading: boolean;
    angle?: number;
}

export const Cannon: React.FC<CannonProps> = ({ isReloading, angle = 0 }) => {
    const [floatingOffset, setFloatingOffset] = useState(0);

    useEffect(() => {
        let animationId: number;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const floatY = Math.sin(elapsed * 0.002) * 2.5; // Flotación más sutil
            setFloatingOffset(floatY);
            animationId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    }, []);

    return (
        <div 
            className={`cannon ${isReloading ? 'reloading' : ''}`} 
            style={{ 
                transform: `translate(-50%, -50%) translateY(${floatingOffset}px)`,
                animation: 'none' // Desactivar la animación CSS para permitir rotación
            }}
        >
            <div 
                className="cannon-base"
                style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
            >
                {/* Sprite animado de la nave */}
                <div 
                    className="ship-sprite" 
                    style={{ backgroundImage: `url(${spriteAvion})` }}
                >
                    {/* Estela central de fuego */}
                    <div className="central-flame" />
                </div>
            </div>
            <div 
                className="cannon-barrel"
                style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
            ></div>
        </div>
    );
}; 