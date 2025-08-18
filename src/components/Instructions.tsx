import React, { useEffect, useState } from 'react';
import { MemoryIcon } from './MemoryIcons';
import { TYPING_STAGES } from '../types/game';

interface InstructionsProps {
    onStart: (startingLevel?: number) => void;
    onContinue?: () => void;
    showContinue?: boolean;
}

export const Instructions: React.FC<InstructionsProps> = ({ onStart, onContinue, showContinue = false }) => {
    const [isMobile, setIsMobile] = useState(false);
    const [showDetails, setShowDetails] = useState<boolean>(false);
    const [showLevelSelector, setShowLevelSelector] = useState<boolean>(false);
    const [selectedLevel, setSelectedLevel] = useState<number>(0);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(/Mobi|Android/i.test(navigator.userAgent));
        };
        checkMobile();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'c' || event.key === 'C') {
                if (showContinue && onContinue) {
                    event.preventDefault();
                    onContinue();
                }
            } else if (event.key === 'Enter') {
                event.preventDefault();
                onStart(selectedLevel);
            }
        };

        if (!isMobile) {
            document.addEventListener('keydown', handleKeyDown);
        }
        
        return () => {
            if (!isMobile) {
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
    }, [onStart, onContinue, showContinue, isMobile, selectedLevel]);

    const handleContainerClick = (event: React.MouseEvent) => {
        if (isMobile) return; // En móvil, solo el botón funciona

        if (!(event.target as HTMLElement).closest('button') && 
            !(event.target as HTMLElement).closest('.level-selector-container')) {
            if (showContinue && onContinue) {
                onContinue();
            } else {
                onStart(selectedLevel);
            }
        }
    };

    const handleStartMobile = async () => {
        try {
            // 1. Poner en pantalla completa
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }

            // 2. Iniciar el juego (esto puede mostrar el teclado)
            onStart(selectedLevel);
            
        } catch (error) {
            console.error("Error al iniciar en modo móvil:", error);
            // Si algo falla (ej. el usuario niega la pantalla completa), igual intentamos iniciar
            onStart(selectedLevel);
        }
    };

    const handleLevelSelect = (levelIndex: number) => {
        setSelectedLevel(levelIndex);
        setShowLevelSelector(false);
    };

    return (
        <div className="instructions" onClick={handleContainerClick} style={{ cursor: isMobile ? 'default' : 'pointer' }}>
            <h2 className="neon-title">
                {Array.from('MECANOGAME').map((char, idx) => (
                    <span
                        key={`char-${idx}`}
                        className="neon-letter"
                        style={{ animationDelay: `${idx * 0.15}s` }}
                    >
                        {char}
                    </span>
                ))}
            </h2>
            
            {/* Selector de Nivel */}
            <div className="level-selector-container">
                <button
                    className="level-selector-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowLevelSelector(prev => !prev);
                    }}
                >
                    <div className="selected-level-info">
                        <span className="selected-level-name">{TYPING_STAGES[selectedLevel]?.name || 'Sector 0'}</span>
                        <span className="selected-level-desc">{TYPING_STAGES[selectedLevel]?.description || 'Posición base'}</span>
                    </div>
                    <span className="dropdown-arrow">{showLevelSelector ? '▲' : '▼'}</span>
                </button>

                {showLevelSelector && (
                    <div className="level-cards-dropdown">
                        <div className="level-cards-grid">
                            {TYPING_STAGES.map((stage, index) => (
                                <div
                                    key={index}
                                    className={`level-card ${selectedLevel === index ? 'selected' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleLevelSelect(index);
                                    }}
                                >
                                    <div className="level-card-header">
                                        <div className="level-number">SECTOR {index}</div>
                                        <div className="level-difficulty">
                                            {'★'.repeat(Math.min(Math.floor(index / 2) + 1, 5))}
                                        </div>
                                    </div>
                                    <div className="level-card-title">{stage.name.split(': ')[1] || stage.name}</div>
                                    <div className="level-card-description">{stage.description}</div>
                                    <div className="level-card-letters">
                                        <span className="letters-preview">
                                            {stage.letters.slice(0, 8).join(' ')}
                                            {stage.letters.length > 8 ? '...' : ''}
                                        </span>
                                        <span className="letters-count">({stage.letters.length} teclas)</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            {isMobile ? (
                <>
                    <p>¡Prepárate para la acción!</p>
                    <button className="start-btn-mobile" onClick={handleStartMobile}>
                        INICIAR JUEGO
                    </button>
                </>
            ) : (
                <>
                    {/* Botón para desplegar */}
                    <button
                        className="toggle-instructions-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowDetails(prev => !prev);
                        }}
                    >
                        {showDetails ? 'Ocultar instrucciones ▲' : 'Mostrar instrucciones ▼'}
                    </button>

                    {showDetails && (
                        <div className="instruction-details">
                            <p>• Las letras caerán desde arriba</p>
                            <p>• Presiona la tecla correcta para disparar</p>
                            <p>• Si te equivocas, tendrás 3 segundos de penalización</p>
                            <p>• Presiona <span className="key-label">BACKSPACE</span> durante la penalización para saltearla</p>
                            <p>• Usa <span className="key-label">ESPACIO</span> para activar el escudo</p>
                            <p>• Presiona <span className="key-label">ESC</span> para pausar</p>
                            <p>• ¡Mejora tu velocidad de escritura!</p>
                        </div>
                    )}
                    <div className="start-section">
                        {showContinue && onContinue && (
                            <>
                                <p className="start-instruction">
                                    Presiona <span className="key-label">C</span> para continuar donde te quedaste
                                </p>
                                <button className="continue-btn" onClick={onContinue}>
                                    <MemoryIcon name="play" size={16} className="btn-icon" />
                                    CONTINUAR
                                </button>
                                <br />
                                <br />
                            </>
                        )}
                        <p className="start-instruction">
                            Presiona <span className="key-label">ENTER</span> o <strong>haz click</strong> para {showContinue ? 'nuevo juego' : 'comenzar'}
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}; 