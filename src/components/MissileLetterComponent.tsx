import React from 'react';

interface MissileLetterProps {
    letter: string;
    x: number;
    y: number;
    isHighlighted: boolean;
}

export const MissileLetterComponent: React.FC<MissileLetterProps> = ({
    letter,
    x,
    y,
    isHighlighted
}) => {
    // Calcular la escala basada en la posición Y
    // Las letras aparecen en y = -72 (fuera de pantalla arriba)
    // y llegan hasta y = window.innerHeight (piso)
    const screenHeight = window.innerHeight;
    const letterSize = 72;
    const startY = -letterSize; // Posición inicial de las letras
    const endY = screenHeight; // Posición final (piso)
    
    const minScale = 0.3; // Más pequeño al inicio
    const maxScale = 1.0; // Tamaño normal al final
    
    // Calcular el progreso (0 = inicio arriba, 1 = piso)
    const totalDistance = endY - startY;
    const currentDistance = y - startY;
    const progress = Math.max(0, Math.min(currentDistance / totalDistance, 1));
    
    // Interpolación lineal entre minScale y maxScale
    const scale = minScale + (maxScale - minScale) * progress;

    return (
        <div
            className={`falling-letter ${isHighlighted ? 'highlighted' : ''}`}
            style={{
                left: x + 'px',
                top: y + 'px',
                position: 'absolute',
                width: '72px',
                height: '72px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 4,
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
            }}
        >
            {/* Letra con animación de color brillante */}
            <span style={{ 
                position: 'relative', 
                zIndex: 2,
                fontSize: isHighlighted ? '40px' : '38px',
                fontWeight: 'bold',
                fontFamily: '"Press Start 2P", monospace',
                lineHeight: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%'
            }}>
                {letter}
            </span>
        </div>
    );
}; 