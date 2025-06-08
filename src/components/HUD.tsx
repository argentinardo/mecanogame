import React, { useEffect, useState } from 'react';

interface HUDProps {
    score: number;
    lives: number;
    isMuted?: boolean;
    onToggleMute?: () => void;
}

export const HUD: React.FC<HUDProps> = ({ 
    score, 
    lives, 
    isMuted = false,
    onToggleMute
}) => {
    const [displayScore, setDisplayScore] = useState(score);
    const [previousScore, setPreviousScore] = useState(score);

    useEffect(() => {
        if (score !== previousScore) {
            // Si el score aumentó, animar el contador
            if (score > previousScore) {
                let currentScore = previousScore;
                const difference = score - previousScore;
                
                // Ajustar velocidad según la diferencia de puntos
                const speed = difference > 50 ? 20 : difference > 20 ? 25 : 30;
                
                const animateScore = () => {
                    if (currentScore < score) {
                        // Incrementar de 1 en 1 para mayor efecto visual
                        currentScore += 1;
                        setDisplayScore(currentScore);
                        
                        if (currentScore < score) {
                            setTimeout(animateScore, speed);
                        }
                    }
                };
                
                animateScore();
            } else {
                // Si el score disminuyó (reset), cambiar inmediatamente
                setDisplayScore(score);
            }
            setPreviousScore(score);
        }
    }, [score, previousScore]);

    return (
        <div className="compact-hud">
            <div className="compact-instrument-panel">
                <div className="compact-score-display">
                    <div className="compact-instrument-label">SCORE</div>
                    <div className="compact-score-value" key={`${score}-${Date.now()}`}>
                        {displayScore.toString().padStart(8, '0')}
                    </div>
                </div>
                
                <div className="compact-lives-display">
                    <div className="compact-instrument-label">VIDAS</div>
                    <div className="compact-lives-ships">
                        {Array.from({ length: lives }).map((_, index) => (
                            <div key={index} className="compact-life-ship">
                                <div className="compact-mini-ship"></div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className={`compact-mute-toggle ${isMuted ? 'muted' : 'unmuted'}`} onClick={onToggleMute}>
                    <div className="compact-instrument-label">AUDIO</div>
                    <div className="compact-mute-icon">
                        {isMuted ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                            </svg>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}; 