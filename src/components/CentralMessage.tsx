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
                        {message?.split('\n').map((line, index) => (
                            <div key={index} className="message-line">
                                {line.split('BACKSPACE').map((part, partIndex) => (
                                    <React.Fragment key={partIndex}>
                                        {part}
                                        {partIndex < line.split('BACKSPACE').length - 1 && (
                                            <span className="key-highlight">BACKSPACE</span>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};