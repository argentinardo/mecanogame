import React from 'react';

interface MissileLetterProps {
    letter: string;
    x: number;
    y: number;
    isHighlighted: boolean;
    color: string;
}

// Clip-path para esquinas pixel art (adaptado para letras)
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

// Función para crear iconos CSS de teclas retro con animación de brillo
const createRetroKeyIcon = (letter: string, color: string, isHighlighted: boolean) => {
    const baseStyle = {
        width: '50px',
        height: '50px',
        background: isHighlighted ? 'linear-gradient(145deg, #2a2a2a, #1a1a1a)' : 'linear-gradient(145deg, #1a1a1a, #0a0a0a)',
        border: `2px solid ${color}`,
        borderRadius: '0px', // Removido para usar clip-path
        clipPath: createPixelCorners(8), // Bordes pixelados
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative' as const,
        boxShadow: isHighlighted 
            ? `0 0 15px ${color}, inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3)`
            : `inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.5)`,
        fontFamily: '"Press Start 2P", "Courier New", monospace',
        fontSize: '28px',
        fontWeight: 'bold',
        color: color,
        textShadow: `0 0 8px ${color}`,
        transition: 'all 0.3s ease',
        transform: isHighlighted ? 'scale(1.1)' : 'scale(1)',
        lineHeight: '1',
        letterSpacing: '0px',
        animation: isHighlighted ? 'letterGlow 1.5s ease-in-out infinite alternate' : 'letterPulse 2s ease-in-out infinite alternate',
    };

    // Efectos adicionales para teclas especiales
    const specialKeys: Record<string, { symbol: string; style?: React.CSSProperties }> = {
        'Ñ': { symbol: 'Ñ', style: { fontSize: '24px' } },
        'Q': { symbol: 'Q' },
        'W': { symbol: 'W' },
        'E': { symbol: 'E' },
        'R': { symbol: 'R' },
        'T': { symbol: 'T' },
        'Y': { symbol: 'Y' },
        'U': { symbol: 'U' },
        'I': { symbol: 'I' },
        'O': { symbol: 'O' },
        'P': { symbol: 'P' },
        'A': { symbol: 'A' },
        'S': { symbol: 'S' },
        'D': { symbol: 'D' },
        'F': { symbol: 'F' },
        'G': { symbol: 'G' },
        'H': { symbol: 'H' },
        'J': { symbol: 'J' },
        'K': { symbol: 'K' },
        'L': { symbol: 'L' },
        'Z': { symbol: 'Z' },
        'X': { symbol: 'X' },
        'C': { symbol: 'C' },
        'V': { symbol: 'V' },
        'B': { symbol: 'B' },
        'N': { symbol: 'N' },
        'M': { symbol: 'M' }
    };

    const keyInfo = specialKeys[letter] || { symbol: letter };

    return (
        <div style={baseStyle}>
            <span style={keyInfo.style}>
                {keyInfo.symbol}
            </span>
            {/* Efecto de resplandor interno */}
            {isHighlighted && (
                <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: '2px',
                    right: '2px',
                    bottom: '2px',
                    background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
                    borderRadius: '0px',
                    clipPath: createPixelCorners(6),
                    pointerEvents: 'none',
                    animation: 'innerGlow 1.5s ease-in-out infinite alternate'
                }} />
            )}
        </div>
    );
};

export const MissileLetterComponent: React.FC<MissileLetterProps> = ({
    letter,
    x,
    y,
    isHighlighted,
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
                {/* Usar icono CSS retro en lugar de imagen */}
                {createRetroKeyIcon(letter, color, isHighlighted)}
            </div>
        </div>
    );
}; 