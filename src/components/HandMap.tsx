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

// Clip-path para esquinas pixel art (adaptado para dedos)
const createPixelCorners = (size: number) => `
  polygon(
    0px calc(100% - ${size * 0.4}px),
    ${size * 0.1}px calc(100% - ${size * 0.4}px),
    ${size * 0.1}px calc(100% - ${size * 0.3}px),
    ${size * 0.2}px calc(100% - ${size * 0.3}px),
    ${size * 0.2}px calc(100% - ${size * 0.2}px),
    ${size * 0.3}px calc(100% - ${size * 0.2}px),
    ${size * 0.3}px calc(100% - ${size * 0.1}px),
    ${size * 0.4}px calc(100% - ${size * 0.1}px),
    ${size * 0.4}px 100%,
    calc(100% - ${size * 0.4}px) 100%,
    calc(100% - ${size * 0.4}px) calc(100% - ${size * 0.1}px),
    calc(100% - ${size * 0.3}px) calc(100% - ${size * 0.1}px),
    calc(100% - ${size * 0.3}px) calc(100% - ${size * 0.2}px),
    calc(100% - ${size * 0.2}px) calc(100% - ${size * 0.2}px),
    calc(100% - ${size * 0.2}px) calc(100% - ${size * 0.3}px),
    calc(100% - ${size * 0.1}px) calc(100% - ${size * 0.3}px),
    calc(100% - ${size * 0.1}px) calc(100% - ${size * 0.4}px),
    100% calc(100% - ${size * 0.4}px),
    100% ${size * 0.4}px,
    calc(100% - ${size * 0.1}px) ${size * 0.4}px,
    calc(100% - ${size * 0.1}px) ${size * 0.3}px,
    calc(100% - ${size * 0.2}px) ${size * 0.3}px,
    calc(100% - ${size * 0.2}px) ${size * 0.2}px,
    calc(100% - ${size * 0.3}px) ${size * 0.2}px,
    calc(100% - ${size * 0.3}px) ${size * 0.1}px,
    calc(100% - ${size * 0.4}px) ${size * 0.1}px,
    calc(100% - ${size * 0.4}px) 0px,
    ${size * 0.4}px 0px,
    ${size * 0.4}px ${size * 0.1}px,
    ${size * 0.3}px ${size * 0.1}px,
    ${size * 0.3}px ${size * 0.2}px,
    ${size * 0.2}px ${size * 0.2}px,
    ${size * 0.2}px ${size * 0.3}px,
    ${size * 0.1}px ${size * 0.3}px,
    ${size * 0.1}px ${size * 0.4}px,
    0px ${size * 0.4}px
  )
`;

// Clip-path para triángulo truncado (palma)
const createTruncatedTriangle = (width: number, height: number, truncation: number = 0.3) => `
  polygon(
    ${width * 0.5}px 0px,
    ${width * (1 - truncation * 0.5)}px ${height * truncation}px,
    ${width * (1 - truncation * 0.5)}px ${height * (1 - truncation)}px,
    ${width * 0.5}px ${height}px,
    ${width * truncation * 0.5}px ${height * (1 - truncation)}px,
    ${width * truncation * 0.5}px ${height * truncation}px
  )
`;

export const HandMap: React.FC<HandMapProps> = ({ side, highlightedKey, isSpacePressed = false }) => {
    const fingerMapping = FINGER_MAPPING[side];
    const highlightedFinger = highlightedKey ? fingerMapping[highlightedKey as keyof typeof fingerMapping] : null;
    
    // El pulgar se ilumina si está destacado por una tecla específica O si se presiona la barra espaciadora
    const isThumbHighlighted = highlightedFinger === 'thumb' || isSpacePressed;

    return (
        <div className={`hand-map hand-map-${side}`}>
            <div className="hand-visual">
                {/* Palma pixel art - triángulo truncado */}
                <div 
                    className={`palm pixel-palm ${highlightedFinger === 'palm' ? 'highlighted' : ''}`}
                    style={{
                        width: '70px',
                        height: '100px',
                        position: 'absolute',
                        left: '25px',
                        top: '100px',
                        clipPath: createTruncatedTriangle(70, 100, 0.25)
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
                        clipPath: createPixelCorners(8)
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
                        clipPath: createPixelCorners(8)
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
                        clipPath: createPixelCorners(8)
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
                        clipPath: createPixelCorners(8)
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
                        clipPath: createPixelCorners(6)
                    }}
                />
            </div>
        </div>
    );
}; 