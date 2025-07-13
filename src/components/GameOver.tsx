import React from 'react';
import { MemoryIcon } from './MemoryIcons';

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
                    <MemoryIcon name="play" size={16} className="btn-icon" />
                    CONTINUAR
                </button>
                <button className="start-btn" onClick={onNewGame}>
                    <MemoryIcon name="gamepad" size={16} className="btn-icon" />
                    NUEVO JUEGO
                </button>
            </div>
        </div>
    );
}; 