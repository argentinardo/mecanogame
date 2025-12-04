import React from 'react';

interface CentralMessageProps {
    message: string | null;
    countdown: number | null;
    show: boolean;
    onMessageClick?: () => void;
    isMobile?: boolean;
}

export const CentralMessage: React.FC<CentralMessageProps> = ({ message, countdown, show, onMessageClick, isMobile = false }) => {
    if (!show) return null;

    const wrapperClass = countdown !== null ? 'central-message countdown-only' : 'central-message';

    // Replace BACKSPACE with TOCA AQUÍ on mobile
    const displayMessage = isMobile && message
        ? message.replace(/BACKSPACE/g, 'TOCA AQUÍ')
        : message;

    return (
        <div
            className={wrapperClass}
            onClick={onMessageClick}
            style={onMessageClick ? { cursor: 'pointer', pointerEvents: 'auto' } : {}}
        >
            <div className="central-message-content">
                {displayMessage && (
                    <div className="status-message">
                        {displayMessage.split('\n').map((line, index) => (
                            <div key={index} className="message-line">
                                {line.replace(/TOCA AQUÍ|ENTER|ESC/gi, match => `||${match}||`).split('||').map((segment, i) => (
                                    segment.match(/TOCA AQUÍ|ENTER|ESC/i) ?
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