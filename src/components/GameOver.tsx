import React from 'react';

interface GameOverProps {
    score: number;
    onContinue: () => void;
    onNewGame: () => void;
}

export const GameOver: React.FC<GameOverProps> = ({ score, onContinue, onNewGame }) => {
    return (
        <div className="game-over">
            <h2>¡JUEGO TERMINADO!</h2>
            <p>Puntuación Final: <span>{score}</span></p>
            <div className="game-over-buttons">
                <button className="continue-btn" onClick={onContinue}>
                    ▶️ CONTINUAR
                </button>
                <button className="start-btn" onClick={onNewGame}>
                    🔄 NUEVO JUEGO
                </button>
            </div>
        </div>
    );
}; 