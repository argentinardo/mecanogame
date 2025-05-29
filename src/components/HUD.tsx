import React from 'react';
import type { TypingStage, ForceField } from '../types/game';

interface HUDProps {
    score: number;
    lives: number;
    status: string;
    isPenalized: boolean;
    stage?: TypingStage;
    hideStatus?: boolean;
    forceField?: ForceField | null;
}

export const HUD: React.FC<HUDProps> = ({ score, lives, status, isPenalized, stage, hideStatus = false, forceField }) => {
    // Determinar el mensaje de estado
    const getStatusMessage = () => {
        if (forceField?.isActive) {
            return '⚠️ Escudo activo - No puedes disparar';
        }
        return status;
    };

    return (
        <div className="hud">
            <div className="score">Puntos: {score}</div>
            <div className="lives">Vidas: {lives}</div>
            <div className="stage">
                <div className="stage-name">{stage?.name || 'Etapa no definida'}</div>
                <div className="stage-description">{stage?.description || 'Sin descripción'}</div>
            </div>
            <div className={`force-field-indicator ${forceField?.isActive ? 'active' : 'ready'}`}>
                <span className="force-field-icon">🛡️</span>
                <span className="force-field-text">
                    {forceField?.isActive ? 'ESCUDO ACTIVO' : 'ESPACIO: Escudo'}
                </span>
            </div>
            <div className={`status ${isPenalized ? 'penalty' : ''} ${forceField?.isActive ? 'force-field-active' : ''} ${hideStatus ? 'hidden' : ''}`}>
                {getStatusMessage()}
            </div>
        </div>
    );
}; 