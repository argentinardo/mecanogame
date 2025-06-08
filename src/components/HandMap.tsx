import React from 'react';

interface HandMapProps {
    side: 'left' | 'right';
    highlightedKey?: string;
    isSpacePressed?: boolean;
}

type FingerType = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';

// Mapeo de teclas a dedos para cada mano
const FINGER_MAPPING = {
    left: {
        // Fila superior
        'Q': 'pinky' as FingerType,
        'W': 'ring' as FingerType,
        'E': 'middle' as FingerType,
        'R': 'index' as FingerType,
        'T': 'index' as FingerType,
        // Fila media (home row)
        'A': 'pinky' as FingerType,
        'S': 'ring' as FingerType,
        'D': 'middle' as FingerType,
        'F': 'index' as FingerType,
        'G': 'index' as FingerType,
        // Fila inferior
        'Z': 'pinky' as FingerType,
        'X': 'ring' as FingerType,
        'C': 'middle' as FingerType,
        'V': 'index' as FingerType,
        'B': 'index' as FingerType
    },
    right: {
        // Fila superior
        'Y': 'index' as FingerType,
        'U': 'index' as FingerType,
        'I': 'middle' as FingerType,
        'O': 'ring' as FingerType,
        'P': 'pinky' as FingerType,
        // Fila media (home row)
        'H': 'index' as FingerType,
        'J': 'index' as FingerType,
        'K': 'middle' as FingerType,
        'L': 'ring' as FingerType,
        'Ñ': 'pinky' as FingerType,
        // Fila inferior
        'N': 'index' as FingerType,
        'M': 'index' as FingerType
    }
};

export const HandMap: React.FC<HandMapProps> = ({ side, highlightedKey, isSpacePressed = false }) => {
    const fingerMapping = FINGER_MAPPING[side];
    const highlightedFinger = highlightedKey ? fingerMapping[highlightedKey as keyof typeof fingerMapping] : null;
    
    // El pulgar se ilumina si está destacado por una tecla específica O si se presiona la barra espaciadora
    const isThumbHighlighted = highlightedFinger === 'thumb' || isSpacePressed;

    return (
        <div className={`hand-map hand-map-${side}`}>
            <div className="hand-visual">
                <svg width="120" height="200" viewBox="0 0 120 200">
                    {/* Palma */}
                    <ellipse 
                        cx="60" 
                        cy="140" 
                        rx="35" 
                        ry="50" 
                        className="palm"
                    />
                    
                    {/* Dedos */}
                    {/* Pulgar */}
                    <ellipse 
                        cx={side === 'left' ? "95" : "25"} 
                        cy="120" 
                        rx="8" 
                        ry="25" 
                        className={`finger thumb ${isThumbHighlighted ? 'highlighted' : ''}`}
                        transform={side === 'left' ? "rotate(30 95 120)" : "rotate(-30 25 120)"}
                    />
                    
                    {/* Índice */}
                    <ellipse 
                        cx={side === 'left' ? "40" : "80"} 
                        cy="60" 
                        rx="8" 
                        ry="35" 
                        className={`finger ring ${highlightedFinger === 'ring' ? 'highlighted' : ''}`}
                    />
                    
                    {/* Medio */}
                    <ellipse 
                        cx="60" 
                        cy="50" 
                        rx="8" 
                        ry="40" 
                        className={`finger middle ${highlightedFinger === 'middle' ? 'highlighted' : ''}`}
                    />
                    
                    {/* Anular */}
                    <ellipse 
                        cx={side === 'left' ? "80" : "40"} 
                        cy="60" 
                        rx="8" 
                        ry="35" 
                        className={`finger index ${highlightedFinger === 'index' ? 'highlighted' : ''}`}
                    />
                    
                    {/* Meñique */}
                    <ellipse 
                        cx={side === 'left' ? "25" : "95"} 
                        cy="75" 
                        rx="6" 
                        ry="25" 
                        className={`finger pinky ${highlightedFinger === 'pinky' ? 'highlighted' : ''}`}
                    />
                </svg>
            </div>
        </div>
    );
}; 