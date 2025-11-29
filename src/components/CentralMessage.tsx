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
                {message && (
                    <div className="status-message">
                        {message.split('\n').map((line, index) => (
                            <div key={index} className="message-line">
                                {line.replace(/BACKSPACE|ENTER|ESC/gi, match => `||${match}||`).split('||').map((segment, i) => (
                                    segment.match(/BACKSPACE|ENTER|ESC/i) ?
                                        <span key={i} className="key-label">{segment}</span> :
                                        <React.Fragment key={i}>{segment}</React.Fragment>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
                {countdown !== null && (
                    <div className="countdown">
                        <div key={countdown} className="countdown-number horizon-anim">{countdown}</div>
                    </div>
                )}
            </div>
        </div>
    );
};