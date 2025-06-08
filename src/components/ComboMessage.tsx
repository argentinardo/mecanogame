import React from 'react';

interface ComboMessageProps {
    message: string | null;
    show: boolean;
}

export const ComboMessage: React.FC<ComboMessageProps> = ({ message, show }) => {
    if (!show || !message) return null;

    return (
        <div className="combo-message">
            <div className="combo-message-content">
                {message}
            </div>
        </div>
    );
}; 