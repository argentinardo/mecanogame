import React from 'react';
import type { TypingStage } from '../types/game';

interface HUDProps {
    score: number;
    lives: number;
    status: string;
    isPenalized: boolean;
    stage?: TypingStage;
}

export const HUD: React.FC<HUDProps> = ({ score, lives, status, isPenalized, stage }) => {
    return (
        <div className="hud">
            <div className="score">Puntos: {score}</div>
            <div className="lives">Vidas: {lives}</div>
            <div className="stage">
                <div className="stage-name">{stage?.name || 'Etapa no definida'}</div>
                <div className="stage-description">{stage?.description || 'Sin descripción'}</div>
            </div>
            <div className={`status ${isPenalized ? 'penalty' : ''}`}>
                {status}
            </div>
        </div>
    );
}; 