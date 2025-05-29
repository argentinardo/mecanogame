import React from 'react';
import type { TypingStage, ForceField } from '../types/game';

interface HUDProps {
    score: number;
    lives: number;
    isPenalized: boolean;
    stage?: TypingStage;
    forceField?: ForceField | null;
}

export const HUD: React.FC<HUDProps> = ({ score, lives, isPenalized, stage, forceField }) => {
    return (
        <div className="hud">
            <div className="instrument-panel">
                <div className="score">
                    <div className="instrument-label">SCORE</div>
                    <div className="instrument-value">{score.toString().padStart(6, '0')}</div>
                </div>
                
                <div className="lives">
                    <div className="instrument-label">LIVES</div>
                    <div className="instrument-value">{lives}</div>
                </div>
                
                <div className="stage">
                    <div className="instrument-label">SECTOR</div>
                    <div className="stage-name">{stage?.name || 'N/A'}</div>
                    <div className="stage-description">{stage?.description || '---'}</div>
                </div>
                
                <div className={`force-field-indicator ${forceField?.isActive ? 'active' : 'ready'}`}>
                    <div className="instrument-label">SHIELD</div>
                    <span className="force-field-icon">🛡️</span>
                    <span className="force-field-text">
                        {forceField?.isActive ? 'ON' : 'SPACE'}
                    </span>
                </div>
                
                <div className="status-indicator">
                    <div className="instrument-label">STATUS</div>
                    <div className={`status-light ${isPenalized ? 'penalty' : 'ready'}`}>
                        {isPenalized ? '⚠️' : '✓'}
                    </div>
                </div>
            </div>
        </div>
    );
}; 