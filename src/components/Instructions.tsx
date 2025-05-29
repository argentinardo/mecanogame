import React, { useEffect } from 'react';

interface InstructionsProps {
    onStart: () => void;
}

export const Instructions: React.FC<InstructionsProps> = ({ onStart }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                onStart();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onStart]);

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
                <p className="start-instruction">
                    Presiona <strong>ENTER</strong> para comenzar
                </p>
                <button className="start-btn" onClick={onStart}>
                    🚀 VAMOS!
                </button>
            </div>
        </div>
    );
}; 