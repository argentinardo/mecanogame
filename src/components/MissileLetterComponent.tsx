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

    // Colores neón posibles
    const neonColors = ['#ff0080', '#ff8000', '#ffff00', '#00ff00', '#00ffff', '#0080ff', '#8000ff'];
    const color = neonColors[letter.charCodeAt(0) % neonColors.length];

    const cubeStyle: React.CSSProperties = {
        left: x + 'px',
        top: y + 'px',
        position: 'absolute',
        width: '100px',
        height: '100px',
        zIndex: 4,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        color: color,
    };
    (cubeStyle as any)['--cube-color'] = color;

    return (
        <div
            className={`falling-letter cube-wrapper ${isHighlighted ? 'highlighted' : ''}`}
            style={cubeStyle}
        >
            <div className="cube" style={{ width: '100%', height: '100%' }}>
                <div className="face front">{letter}</div>
                <div className="face back">{letter}</div>
                <div className="face right">{letter}</div>
                <div className="face left">{letter}</div>
                <div className="face top">{letter}</div>
                <div className="face bottom">{letter}</div>
            </div>
        </div>
    );
};
