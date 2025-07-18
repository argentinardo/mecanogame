import React from 'react';

interface CentralMessageProps {
    message: string | null;
    countdown: number | null;
    show: boolean;
}

export const CentralMessage: React.FC<CentralMessageProps> = ({ message, countdown, show }) => {
    if (!show) return null;

    const wrapperClass = countdown !== null ? 'central-message countdown-only' : 'central-message';

    return (
        <div className={wrapperClass}>
            <div className="central-message-content">
                {countdown !== null ? (
                    <div className="countdown">
                        <div key={countdown} className="countdown-number horizon-anim">{countdown}</div>
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