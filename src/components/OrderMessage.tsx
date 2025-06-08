import React from 'react';

interface OrderMessageProps {
    message: string | null;
    show: boolean;
}

export const OrderMessage: React.FC<OrderMessageProps> = ({ message, show }) => {
    if (!show || !message) return null;

    return (
        <div className="order-message">
            <div className="order-message-content">
                {message}
            </div>
        </div>
    );
}; 