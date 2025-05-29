import React from 'react';

interface CentralMessageProps {
    message: string | null;
    countdown: number | null;
    show: boolean;
}

export const CentralMessage: React.FC<CentralMessageProps> = ({ message, countdown, show }) => {
    if (!show) return null;

    return (
        <div className="central-message">
            <div className="central-message-content">
                {countdown !== null ? (
                    <div className="countdown">
                        <div className="countdown-number">{countdown}</div>
                        <div className="countdown-text">Preparándose...</div>
                    </div>
                ) : (
                    <div className="status-message">
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
};