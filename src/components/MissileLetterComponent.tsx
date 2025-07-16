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