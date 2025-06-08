import React from 'react';

interface MissileLetterProps {
    letter: string;
    x: number;
    y: number;
    isHighlighted: boolean;
    letterImage?: string;
    color: string;
}

export const MissileLetterComponent: React.FC<MissileLetterProps> = ({
    letter,
    x,
    y,
    isHighlighted,
    letterImage,
    color
}) => {
    return (
        <div
            className={`missile-letter ${isHighlighted ? 'highlighted' : ''}`}
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
            {/* Estela de fuego */}
            <div className="fire-trail">
                <div className="fire-particle fire-1"></div>
                <div className="fire-particle fire-2"></div>
                <div className="fire-particle fire-3"></div>
                <div className="fire-particle fire-4"></div>
                <div className="fire-particle fire-5"></div>
            </div>
            
            {/* Cuerpo del misil/letra */}
            <div className="missile-body">
                {letterImage ? (
                    <img 
                        src={letterImage} 
                        alt={letter}
                        className="missile-letter-image"
                        style={{
                            width: '50px',
                            height: '50px',
                            objectFit: 'contain',
                            filter: `drop-shadow(0 0 2px ${color})`
                        }}
                    />
                ) : (
                    <span 
                        className="missile-letter-text"
                        style={{
                            color: color,
                            fontSize: '36px',
                            fontWeight: 'bold',
                            textShadow: `0 0 8px ${color}`,
                        }}
                    >
                        {letter}
                    </span>
                )}
            </div>
        </div>
    );
}; 