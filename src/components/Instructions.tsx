import React, { useEffect, useState } from 'react';
import { MemoryIcon } from './MemoryIcons';

interface InstructionsProps {
    onStart: () => void;
    onContinue?: () => void;
    showContinue?: boolean;
}

export const Instructions: React.FC<InstructionsProps> = ({ onStart, onContinue, showContinue = false }) => {
    const [isMobile, setIsMobile] = useState(false);
    const [showDetails, setShowDetails] = useState<boolean>(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(/Mobi|Android/i.test(navigator.userAgent));
        };
        checkMobile();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'c' || event.key === 'C') {
                if (showContinue && onContinue) {
                    event.preventDefault();
                    onContinue();
                }
            } else if (event.key === 'Enter') {
                event.preventDefault();
                onStart();
            }
        };

        if (!isMobile) {
            document.addEventListener('keydown', handleKeyDown);
        }
        
        return () => {
            if (!isMobile) {
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
    }, [onStart, onContinue, showContinue, isMobile]);

    const handleContainerClick = (event: React.MouseEvent) => {
        if (isMobile) return; // En móvil, solo el botón funciona

        if (!(event.target as HTMLElement).closest('button')) {
            if (showContinue && onContinue) {
                onContinue();
            } else {
                onStart();
            }
        }
    };

    const handleStartMobile = async () => {
        try {
            // 1. Poner en pantalla completa
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }

            // 2. Iniciar el juego (esto puede mostrar el teclado)
            onStart();
            
        } catch (error) {
            console.error("Error al iniciar en modo móvil:", error);
            // Si algo falla (ej. el usuario niega la pantalla completa), igual intentamos iniciar
            onStart();
        }
    };

    return (
        <div className="instructions" onClick={handleContainerClick} style={{ cursor: isMobile ? 'default' : 'pointer' }}>
            <h2 className="neon-title">
                {Array.from('MECANOSTEROID').map((char, idx) => (
                    <span
                        key={`char-${idx}`}
                        className="neon-letter"
                        style={{ animationDelay: `${idx * 0.15}s` }}
                    >
                        {char}
                    </span>
                ))}
            </h2>
            
            {isMobile ? (
                <>
                    <p>¡Prepárate para la acción!</p>
                    <button className="start-btn-mobile" onClick={handleStartMobile}>
                        INICIAR JUEGO
                    </button>
                </>
            ) : (
                <>
                    {/* Botón para desplegar */}
                    <button
                        className="toggle-instructions-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowDetails(prev => !prev);
                        }}
                    >
                        {showDetails ? 'Ocultar instrucciones ▲' : 'Mostrar instrucciones ▼'}
                    </button>

                    {showDetails && (
                        <div className="instruction-details">
                            <p>• Las letras caerán desde arriba</p>
                            <p>• Presiona la tecla correcta para disparar</p>
                            <p>• Si te equivocas, tendrás 3 segundos de penalización</p>
                            <p>• Presiona <span className="key-label">BACKSPACE</span> durante la penalización para saltearla</p>
                            <p>• Usa <span className="key-label">ESPACIO</span> para activar el escudo</p>
                            <p>• Presiona <span className="key-label">ESC</span> para pausar</p>
                            <p>• ¡Mejora tu velocidad de escritura!</p>
                        </div>
                    )}
                    <div className="start-section">
                        {showContinue && onContinue && (
                            <>
                                <p className="start-instruction">
                                    Presiona <span className="key-label">C</span> para continuar donde te quedaste
                                </p>
                                <button className="continue-btn" onClick={onContinue}>
                                    <MemoryIcon name="play" size={16} className="btn-icon" />
                                    CONTINUAR
                                </button>
                                <br />
                                <br />
                            </>
                        )}
                        <p className="start-instruction">
                            Presiona <span className="key-label">ENTER</span> o <strong>haz click</strong> para {showContinue ? 'nuevo juego' : 'comenzar'}
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}; 