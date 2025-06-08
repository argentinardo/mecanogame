import React, { useEffect } from 'react';

interface InstructionsProps {
    onStart: () => void;
    onContinue?: () => void;
    showContinue?: boolean;
}

export const Instructions: React.FC<InstructionsProps> = ({ onStart, onContinue, showContinue = false }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                onStart();
            } else if (event.key === 'c' || event.key === 'C') {
                if (showContinue && onContinue) {
                    event.preventDefault();
                    onContinue();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onStart, onContinue, showContinue]);

    return (
        <div className="instructions">
            <h2>🎯 CAÑÓN DE LETRAS 🎯</h2>
            <p>• Las letras caerán desde arriba</p>
            <p>• Presiona la tecla correcta para disparar</p>
            <p>• Si te equivocas, tendrás 3 segundos de penalización</p>
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
                            ▶️ CONTINUAR
                        </button>
                        <br />
                        <br />
                    </>
                )}
                <p className="start-instruction">
                    Presiona <strong>ENTER</strong> para {showContinue ? 'nuevo juego' : 'comenzar'}
                </p>
                <button className="start-btn" onClick={onStart}>
                    🚀 {showContinue ? 'NUEVO JUEGO' : 'VAMOS!'}
                </button>
            </div>
        </div>
    );
}; 