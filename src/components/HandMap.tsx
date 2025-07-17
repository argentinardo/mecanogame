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
                {/* Palma superior (rectángulo más grande) */}
                <div 
                    className={`palm palm-upper pixel-palm ${highlightedFinger === 'palm' ? 'highlighted' : ''}`}
                    style={{
                        width: '80px',
                        height: '60px',
                        position: 'absolute',
                        left: '20px',
                        top: '80px',
                        borderRadius: '8px'
                    }}
                />
                
                {/* Palma inferior (rectángulo más pequeño) */}
                <div 
                    className={`palm palm-lower pixel-palm ${highlightedFinger === 'palm' ? 'highlighted' : ''}`}
                    style={{
                        width: '60px',
                        height: '40px',
                        position: 'absolute',
                        left: '30px',
                        top: '140px',
                        borderRadius: '6px'
                    }}
                />
                
                {/* Dedos pixel art */}
                {/* Pulgar */}
                <div 
                    className={`finger thumb pixel-finger ${isThumbHighlighted ? 'highlighted' : ''}`}
                    style={{
                        width: '16px',
                        height: '50px',
                        position: 'absolute',
                        left: side === 'left' ? '85px' : '19px',
                        top: '100px',
                        transform: side === 'left' ? 'rotate(30deg)' : 'rotate(-30deg)',
                        borderRadius: '8px'
                    }}
                />
                
                {/* Índice */}
                <div 
                    className={`finger index pixel-finger ${highlightedFinger === 'index' ? 'highlighted' : ''}`}
                    style={{
                        width: '16px',
                        height: '70px',
                        position: 'absolute',
                        left: side === 'left' ? '30px' : '74px',
                        top: '30px',
                        borderRadius: '8px'
                    }}
                />
                
                {/* Medio */}
                <div 
                    className={`finger middle pixel-finger ${highlightedFinger === 'middle' ? 'highlighted' : ''}`}
                    style={{
                        width: '16px',
                        height: '80px',
                        position: 'absolute',
                        left: '52px',
                        top: '20px',
                        borderRadius: '8px'
                    }}
                />
                
                {/* Anular */}
                <div 
                    className={`finger ring pixel-finger ${highlightedFinger === 'ring' ? 'highlighted' : ''}`}
                    style={{
                        width: '16px',
                        height: '70px',
                        position: 'absolute',
                        left: side === 'left' ? '70px' : '34px',
                        top: '30px',
                        borderRadius: '8px'
                    }}
                />
                
                {/* Meñique */}
                <div 
                    className={`finger pinky pixel-finger ${highlightedFinger === 'pinky' ? 'highlighted' : ''}`}
                    style={{
                        width: '12px',
                        height: '50px',
                        position: 'absolute',
                        left: side === 'left' ? '15px' : '85px',
                        top: '45px',
                        borderRadius: '6px'
                    }}
                />
            </div>
        </div>
    );
}; 