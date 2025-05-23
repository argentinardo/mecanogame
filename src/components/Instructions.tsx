import React from 'react';

interface InstructionsProps {
    onStart: () => void;
}

export const Instructions: React.FC<InstructionsProps> = ({ onStart }) => {
    return (
        <div className="instructions">
            <h2>🎯 CAÑÓN DE LETRAS 🎯</h2>
            <p>• Las letras caerán desde arriba</p>
            <p>• Presiona la tecla correcta para disparar</p>
            <p>• Si te equivocas, tendrás 3 segundos de penalización</p>
            <p>• ¡Mejora tu velocidad de escritura!</p>
            <button className="start-btn" onClick={onStart}>
                🚀 COMENZAR JUEGO
            </button>
        </div>
    );
}; 