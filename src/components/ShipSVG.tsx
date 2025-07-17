import React from 'react';

interface ShipSVGProps {
    size?: number;
    className?: string;
    color?: string;
}

export const ShipSVG: React.FC<ShipSVGProps> = ({ 
    size = 80, 
    className = '', 
    color = '#00ffff' 
}) => {

    
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 80 80"
            className={className}
            style={{ display: 'block' }}
        >
            {/* Cuerpo principal de la nave */}
            <path
                d="M40,10 L60,50 L50,70 L30,70 L20,50 Z"
                fill={color}
                stroke={color}
                strokeWidth="2" opacity="0.8" />
            
            {/* Ala izquierda */}
            <path
                d="M20,50 L10,45 L15,60 L30,70 Z"
                fill={color}
                stroke={color}
                strokeWidth="1.5" opacity="0.7" />
            
            {/* Ala derecha */}
            <path
                d="M60,50 L70,45 L65,60 L50,70 Z"
                fill={color}
                stroke={color}
                strokeWidth="1.5" opacity="0.7" />
            
            {/* Cabina de mando */}
            <ellipse
                cx="40" cy="35" rx="8" ry="6" fill="rgba(255, 255, 255, 0.9)"
                stroke={color}
                strokeWidth="1" />
            
            {/* Detalles de la cabina */}
            <ellipse
                cx="40" cy="35" rx="4" ry="3" fill="rgba(0, 255, 255, 0.6)"
                stroke="none"
            />
            
            {/* Motor izquierdo */}
            <circle
                cx="30" cy="65"
                r="3" fill={color}
                stroke="none"
                opacity="0.9" />
            
            {/* Motor derecho */}
            <circle
                cx="50" cy="65"
                r="3" fill={color}
                stroke="none"
                opacity="0.9" />
            
            {/* Efectos de energía */}
            <circle
                cx="30" cy="65"
                r="6" fill="none"
                stroke={color}
                strokeWidth="1" opacity="0.4" />
            
            <circle
                cx="50" cy="65"
                r="6" fill="none"
                stroke={color}
                strokeWidth="1" opacity="0.4" />
            
            {/* Detalles de la nariz */}
            <path
                d="M40,10 L42,15 L38,15 Z"
                fill="rgba(255, 255, 255, 0.8)"
                stroke="none"
            />
            
            {/* Líneas de energía */}
            <line
                x1="40" y1="20" x2="40" y2="30" stroke={color}
                strokeWidth="1" opacity="0.6" />
            
            <line
                x1="35" y1="25" x2="45" y2="25" stroke={color}
                strokeWidth="1" opacity="0.6" />
        </svg>
    );
}; 