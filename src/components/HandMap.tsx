import React from 'react';

interface HandMapProps {
    side: 'left' | 'right';
    highlightedKey?: string;
}

type FingerType = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';

// Mapeo de teclas a dedos para cada mano
const FINGER_MAPPING = {
    left: {
        'Q': 'pinky' as FingerType,
        'W': 'ring' as FingerType,
        'E': 'middle' as FingerType,
        'R': 'index' as FingerType,
        'T': 'index' as FingerType,
        'A': 'pinky' as FingerType,
        'S': 'ring' as FingerType,
        'D': 'middle' as FingerType,
        'F': 'index' as FingerType,
        'G': 'index' as FingerType,
        'Z': 'pinky' as FingerType,
        'X': 'ring' as FingerType,
        'C': 'middle' as FingerType,
        'V': 'index' as FingerType,
        'B': 'index' as FingerType
    },
    right: {
        'Y': 'index' as FingerType,
        'U': 'index' as FingerType,
        'I': 'middle' as FingerType,
        'O': 'ring' as FingerType,
        'P': 'pinky' as FingerType,
        'H': 'index' as FingerType,
        'J': 'index' as FingerType,
        'K': 'middle' as FingerType,
        'L': 'ring' as FingerType,
        'Ñ': 'pinky' as FingerType,
        'N': 'index' as FingerType,
        'M': 'index' as FingerType
    }
};

// Nombres de dedos en español
const FINGER_NAMES: Record<FingerType, string> = {
    pinky: 'Meñique',
    ring: 'Anular',
    middle: 'Medio',
    index: 'Índice',
    thumb: 'Pulgar'
};

export const HandMap: React.FC<HandMapProps> = ({ side, highlightedKey }) => {
    const fingerMapping = FINGER_MAPPING[side];
    const highlightedFinger = highlightedKey ? fingerMapping[highlightedKey as keyof typeof fingerMapping] : null;

    return (
        <div className={`hand-map hand-map-${side}`}>
            <h3 className="hand-title">
                Mano {side === 'left' ? 'Izquierda' : 'Derecha'}
            </h3>
            
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
                        className={`finger thumb ${highlightedFinger === 'thumb' ? 'highlighted' : ''}`}
                        transform={side === 'left' ? "rotate(30 95 120)" : "rotate(-30 25 120)"}
                    />
                    
                    {/* Índice */}
                    <ellipse 
                        cx={side === 'left' ? "40" : "80"} 
                        cy="60" 
                        rx="8" 
                        ry="35" 
                        className={`finger index ${highlightedFinger === 'index' ? 'highlighted' : ''}`}
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
                        className={`finger ring ${highlightedFinger === 'ring' ? 'highlighted' : ''}`}
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
            
            {/* Lista de teclas para esta mano */}
            <div className="key-list">
                {Object.entries(fingerMapping).map(([key, finger]) => (
                    <div 
                        key={key} 
                        className={`key-item ${highlightedKey === key ? 'active' : ''}`}
                    >
                        <span className="key">{key}</span>
                        <span className="finger-label">{FINGER_NAMES[finger]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}; 