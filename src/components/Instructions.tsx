import React, { useEffect } from 'react';
import { MemoryIcon } from './MemoryIcons';

interface InstructionsProps {
    onStart: () => void;
    onContinue?: () => void;
    showContinue?: boolean;
}

export const Instructions: React.FC<InstructionsProps> = ({ onStart, onContinue, showContinue = false }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'c' || event.key === 'C') {
                if (showContinue && onContinue) {
                    event.preventDefault();
                    onContinue();
                }
            } else if (event.key === 'Enter') {
                // Solo ENTER inicia el juego
                event.preventDefault();
                onStart();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onStart, onContinue, showContinue]);

    const handleContainerClick = (event: React.MouseEvent) => {
        // Solo activar si el click no fue en un botón
        if (!(event.target as HTMLElement).closest('button')) {
            if (showContinue && onContinue) {
                onContinue();
            } else {
                onStart();
            }
        }
    };

    return (
        <div className="instructions" onClick={handleContainerClick} style={{ cursor: 'pointer' }}>
            <h2>🎯 CAÑÓN DE LETRAS 🎯</h2>
            <p>• Las letras caerán desde arriba</p>
            <p>• Presiona la tecla correcta para disparar</p>
            <p>• Si te equivocas, tendrás 3 segundos de penalización</p>
            <p>• Presiona <strong>BACKSPACE</strong> durante la penalización para saltearla</p>
            <p>• Usa <strong>ESPACIO</strong> para activar el escudo</p>
            <p>• Presiona <strong>ESC</strong> para pausar</p>
            <p>• ¡Mejora tu velocidad de escritura!</p>
            <div className="start-section">
                {showContinue && onContinue && (
                    <>
                        <p className="start-instruction">
                            Presiona <strong>C</strong> para continuar donde te quedaste
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
                    Presiona <strong>ENTER</strong> o <strong>haz click</strong> para {showContinue ? 'nuevo juego' : 'comenzar'}
                </p>
            </div>
        </div>
    );
}; 