import React, { useEffect, useState } from 'react';
// Sprite de la nave
import spriteAvion from '../assets/images/sprite-avion-102.png';

interface CannonProps {
    isReloading: boolean;
    angle?: number;
    isExploding?: boolean;
    isSpawning?: boolean;
}

export const Cannon: React.FC<CannonProps> = ({ isReloading, angle = 0, isExploding = false, isSpawning = false }) => {
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

    // Estilo condicional: evitar sobrescribir transform cuando hay animaciones
    const wrapperStyle: React.CSSProperties = (isExploding || isSpawning)
        ? { animation: 'none' }
        : { transform: `translate(-50%, -50%) translateY(${floatingOffset}px)` };

    return (
        <div 
            className={`cannon ${isReloading ? 'reloading' : ''} ${isExploding ? 'exploding' : ''} ${isSpawning ? 'spawning' : ''}`} 
            style={wrapperStyle}
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