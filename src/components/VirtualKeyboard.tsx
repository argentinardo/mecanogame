import React from 'react';

interface VirtualKeyboardProps {
    onKeyPress: (key: string) => void;
    onSpacePress: () => void;
    pressedKey: string | null;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({ onKeyPress, onSpacePress, pressedKey }) => {
    const rows = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
        ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
    ];

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent, key: string) => {
        e.preventDefault(); // Prevent default touch behavior (scrolling, zooming)
        onKeyPress(key);
    };

    const handleSpaceTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault();
        onSpacePress();
    };

    return (
        <div className="virtual-keyboard">
            <div className="keyboard-grid">
                {rows.map((row, rowIndex) => (
                    <div key={rowIndex} className="keyboard-row">
                        {row.map((key) => (
                            <button
                                key={key}
                                className={`keyboard-key ${pressedKey === key ? 'active' : ''}`}
                                onMouseDown={(e) => handleTouchStart(e, key)}
                                onTouchStart={(e) => handleTouchStart(e, key)}
                            >
                                {key}
                            </button>
                        ))}
                    </div>
                ))}
                <div className="keyboard-row space-row">
                    <button
                        className="keyboard-key space-key"
                        onMouseDown={handleSpaceTouchStart}
                        onTouchStart={handleSpaceTouchStart}
                    >
                        ESCUDO (SPACE)
                    </button>
                </div>
            </div>
        </div>
    );
};
