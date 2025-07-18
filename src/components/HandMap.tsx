import React from 'react';

interface HandMapProps {
    side: 'left' | 'right';
    highlightedKey?: string;      // Tecla actualmente presionada
    subtleKeys?: string[];        // Conjunto de letras en pantalla (iluminación leve)
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

export const HandMap: React.FC<HandMapProps> = ({ side, highlightedKey, subtleKeys, isSpacePressed = false }) => {
    const fingerMapping = FINGER_MAPPING[side];
    const highlightedFinger = highlightedKey ? fingerMapping[highlightedKey as keyof typeof fingerMapping] : null;

    const isFingerSubtle = (finger: FingerType) => {
        if (!subtleKeys || subtleKeys.length === 0) return false;
        return subtleKeys.some(k => fingerMapping[k as keyof typeof fingerMapping] === finger);
    };

    // El pulgar se ilumina si está destacado por una tecla específica O si se presiona la barra espaciadora
    const isThumbHighlighted = highlightedFinger === 'thumb' || isSpacePressed;

    return (
        <div className={`hand-map hand-map-${side}`}>
            <div className="hand-visual">
                {/* Palma superior (rectángulo más grande) */}
                <div 
                    className={`palm palm-upper pixel-palm ${highlightedFinger === 'palm' ? 'highlighted' : ''}`}
                    style={{
                        width: '74px',
                        height: '60px',
                        position: 'absolute',
                        left: side === 'left' ? '20px' : '40px',
                        top: '110px',
                        borderRadius: '8px'
                    }}
                />
                
                {/* Palma inferior (rectángulo más pequeño) */}
                <div 
                    className={`palm palm-lower pixel-palm ${highlightedFinger === 'palm' ? 'highlighted' : ''}`}
                    style={{
                        width: '58px',
                        height: '40px',
                        position: 'absolute',
                        left: side === 'left' ? '28px' : '48px',
                        top: '168px',
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
                        left: side === 'left' ? '100px' : '16px',
                        top: '110px',
                        transform: side === 'left' ? 'rotate(10deg)' : 'rotate(-10deg)',
                        borderRadius: '8px'
                    }}
                />
                
                {/* Índice */}
                <div 
                    className={`finger index pixel-finger ${highlightedFinger === 'index' ? 'highlighted' : isFingerSubtle('index') ? 'subtle-highlight' : ''}`}
                    style={{
                        width: '16px',
                        height: '70px',
                        position: 'absolute',
                        left: side === 'left' ? '76px' : '40px',
                        bottom: '114px',
                        borderRadius: '8px'
                    }}
                />
                
                {/* Medio */}
                <div 
                    className={`finger middle pixel-finger ${highlightedFinger === 'middle' ? 'highlighted' : isFingerSubtle('middle') ? 'subtle-highlight' : ''}`}
                    style={{
                        width: '16px',
                        height: '80px',
                        position: 'absolute',
                        left: side === 'left' ? '56px' : '60px',
                        bottom: '114px',
                        borderRadius: '8px'
                    }}
                />
                
                {/* Anular */}
                <div 
                    className={`finger ring pixel-finger ${highlightedFinger === 'ring' ? 'highlighted' : isFingerSubtle('ring') ? 'subtle-highlight' : ''}`}
                    style={{
                        width: '16px',
                        height: '70px',
                        position: 'absolute',
                        bottom: '114px',
                        left: side === 'left' ? '36px' : '80px',
                        borderRadius: '8px'
                        
                    }}
                />
                
                {/* Meñique */}
                <div 
                    className={`finger pinky pixel-finger ${highlightedFinger === 'pinky' ? 'highlighted' : isFingerSubtle('pinky') ? 'subtle-highlight' : ''}`}
                    style={{
                        width: '12px',
                        height: '50px',
                        position: 'absolute',
                        left: side === 'left' ? '20px' : '100px',
                        bottom: '114px',
                        borderRadius: '6px'
                    }}
                />
            </div>
        </div>
    );
}; 