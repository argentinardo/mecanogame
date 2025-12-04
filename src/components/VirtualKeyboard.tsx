import React, { useRef, useCallback } from 'react';

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

    // Ref to track if we just handled a touch event (to prevent mouse event from also firing)
    const handledTouchRef = useRef<boolean>(false);

    // Handle touch start - mark that we handled touch
    const handleTouchStart = useCallback((e: React.TouchEvent, key: string) => {
        e.preventDefault(); // Prevent default touch behavior (scrolling, zooming, and synthetic mouse events)
        e.stopPropagation();
        handledTouchRef.current = true;
        onKeyPress(key);

        // Reset flag after a short delay
        setTimeout(() => {
            handledTouchRef.current = false;
        }, 100);
    }, [onKeyPress]);

    // Handle mouse down - only fire if we didn't just handle a touch
    const handleMouseDown = useCallback((e: React.MouseEvent, key: string) => {
        if (handledTouchRef.current) {
            // Skip - this is a synthetic mouse event following a touch
            return;
        }
        e.preventDefault();
        onKeyPress(key);
    }, [onKeyPress]);

    // Handle space touch
    const handleSpaceTouchStart = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handledTouchRef.current = true;
        onSpacePress();

        setTimeout(() => {
            handledTouchRef.current = false;
        }, 100);
    }, [onSpacePress]);

    // Handle space mouse
    const handleSpaceMouseDown = useCallback((e: React.MouseEvent) => {
        if (handledTouchRef.current) {
            return;
        }
        e.preventDefault();
        onSpacePress();
    }, [onSpacePress]);

    return (
        <div className="virtual-keyboard">
            <div className="keyboard-grid">
                {rows.map((row, rowIndex) => (
                    <div key={rowIndex} className="keyboard-row">
                        {row.map((key) => (
                            <button
                                key={key}
                                className={`keyboard-key ${pressedKey === key ? 'active' : ''}`}
                                onMouseDown={(e) => handleMouseDown(e, key)}
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
                        onMouseDown={handleSpaceMouseDown}
                        onTouchStart={handleSpaceTouchStart}
                    >
                        ESCUDO (SPACE)
                    </button>
                </div>
            </div>
        </div>
    );
};
