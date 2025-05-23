import React from 'react';

interface GameOverProps {
    score: number;
    onRestart: () => void;
}

export const GameOver: React.FC<GameOverProps> = ({ score, onRestart }) => {
    return (
        <div className="game-over">
            <h2>¡JUEGO TERMINADO!</h2>
            <p>Puntuación Final: <span>{score}</span></p>
            <button className="start-btn" onClick={onRestart}>
                🔄 JUGAR DE NUEVO
            </button>
        </div>
    );
}; 