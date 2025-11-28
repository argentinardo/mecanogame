import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HUD } from './HUD';
import { Instructions } from './Instructions';
import { GameOver } from './GameOver';
import { HandMap } from './HandMap';
import { CentralMessage } from './CentralMessage';
import MobileWarning from './MobileWarning';
import { Starfield } from './Starfield';
import { PhaserGame, type PhaserGameRef } from './PhaserGame';
import { useAudio } from '../hooks/useAudio';
import type { GameState, FallingLetter } from '../types/game';
import { TYPING_STAGES } from '../types/game';

const LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ0123456789'.split('');
const INITIAL_LETTER_SPEED = 0.9;
const INITIAL_GAME_SPEED = 2100;
const SPEED_INCREMENT = 0.05;
const GAME_SPEED_DECREMENT = 50;
const MIN_GAME_SPEED = 800;

const LETTERS_DESTROYED_THRESHOLDS = [
    50, 150, 300, 500, 750, 1000, 1300, 1600, 2000, 2500
];

export const Game: React.FC = () => {
    const {
        playShootSound,
        playExplosionSound,
        playMissSound,
        playLifeLostSound,
        playGameOverSound,
        playLevelUpSound,
        playComboSuccessSound,
        playProximityBeep,
        startBackgroundMusic,
        stopBackgroundMusic,
        lowerBackgroundVolume,
        restoreBackgroundVolume,
        initAudioContext,
        toggleMute,
        isMuted,
        playCountdownSound
    } = useAudio();

    const [gameState, setGameState] = useState<GameState>({
        score: 0,
        lives: 3,
        isPlaying: false,
        isPenalized: false,
        penaltyTime: 0,
        fallingLetters: [], // Not used for rendering anymore, but kept for type compatibility
        bullets: [],
        meteorites: [],
        forceField: null,
        gameSpeed: INITIAL_GAME_SPEED,
        letterSpeed: INITIAL_LETTER_SPEED,
        currentStage: 0,
        lettersDestroyed: 0,
        pressedKey: null,
        centralMessage: null,
        showCentralMessage: false,
        countdown: null,
        isPaused: false,
        showSectorInfo: false,
        sectorInfoTimeout: null,
        firstMeteoritePause: false,
        forceFieldActivationMessage: false
    });

    const [comboCount, setComboCount] = useState<number>(0);
    const [lastHitTime, setLastHitTime] = useState<number>(0);
    const [sequentialHits, setSequentialHits] = useState<number>(0);

    const [currentComboMessage, setCurrentComboMessage] = useState<string | null>(null);
    const [isComboMessageVisible, setIsComboMessageVisible] = useState<boolean>(false);

    const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
    const [isMobile, setIsMobile] = useState<boolean>(false);

    const phaserRef = useRef<PhaserGameRef>(null);
    const proximityBeepIntervalRef = useRef<number | undefined>(undefined);

    const advanceStage = useCallback(() => {
        setGameState(prev => {
            const nextStage = prev.currentStage + 1;
            if (nextStage >= TYPING_STAGES.length) return prev;

            playLevelUpSound();

            // Pause for sector info
            const timeout = setTimeout(() => {
                setGameState(p => ({ ...p, showSectorInfo: false, isPaused: false, sectorInfoTimeout: null }));
            }, 5000);

            return {
                ...prev,
                currentStage: nextStage,
                showSectorInfo: true,
                isPaused: true,
                sectorInfoTimeout: timeout as unknown as number
            };
        });
    }, [playLevelUpSound]);

    // Callbacks for Phaser
    const handleLetterHit = useCallback((_letterObj: FallingLetter) => {
        playExplosionSound();

        // Combo Logic
        const currentTime = Date.now();
        const timeSinceLastHit = currentTime - lastHitTime;

        let newComboCount = comboCount;
        let newSequentialHits = sequentialHits;

        if (timeSinceLastHit <= 1200 && lastHitTime > 0) {
            newComboCount++;
            newSequentialHits++;
        } else {
            newComboCount = 1;
            newSequentialHits = 1;
        }

        setComboCount(newComboCount);
        setSequentialHits(newSequentialHits);
        setLastHitTime(currentTime);

        // Multiplier
        let currentMultiplier = 1;
        if (newComboCount >= 15) currentMultiplier = 4;
        else if (newComboCount >= 10) currentMultiplier = 3;
        else if (newComboCount >= 6) currentMultiplier = 2.5;
        else if (newComboCount >= 3) currentMultiplier = 2;
        else if (newComboCount >= 2) currentMultiplier = 1.5;

        // Score
        const baseScore = 10;
        const comboScore = Math.floor(baseScore * currentMultiplier);
        const totalScore = comboScore;

        setGameState(prev => {
            const newScore = prev.score + totalScore;
            const newLettersDestroyed = prev.lettersDestroyed + 1;

            // Difficulty Progression
            const currentThreshold = LETTERS_DESTROYED_THRESHOLDS[prev.currentStage] || LETTERS_DESTROYED_THRESHOLDS[LETTERS_DESTROYED_THRESHOLDS.length - 1];
            const shouldIncreaseDifficulty = newLettersDestroyed >= currentThreshold;

            const newGameSpeed = shouldIncreaseDifficulty
                ? Math.max(MIN_GAME_SPEED, prev.gameSpeed - GAME_SPEED_DECREMENT)
                : prev.gameSpeed;
            const newLetterSpeed = shouldIncreaseDifficulty
                ? prev.letterSpeed + SPEED_INCREMENT
                : prev.letterSpeed;

            // Check Stage Advance
            if (shouldIncreaseDifficulty && prev.currentStage + 1 < TYPING_STAGES.length) {
                setTimeout(() => advanceStage(), 0);
            }

            return {
                ...prev,
                score: newScore,
                lettersDestroyed: newLettersDestroyed,
                gameSpeed: newGameSpeed,
                letterSpeed: newLetterSpeed
            };
        });

        // Combo Messages
        if (newComboCount >= 3) {
            playComboSuccessSound();
            setCurrentComboMessage(`COMBO ${newComboCount}! x${currentMultiplier}`);
            setIsComboMessageVisible(true);
            setTimeout(() => setIsComboMessageVisible(false), 1500);
        }

    }, [comboCount, lastHitTime, sequentialHits, playExplosionSound, playComboSuccessSound, advanceStage]);

    const handleGameOver = useCallback(() => {
        playGameOverSound();
        stopBackgroundMusic();
        setGameState(prev => ({ ...prev, isPlaying: false, isPaused: false }));
    }, [playGameOverSound, stopBackgroundMusic]);

    const handleLetterEscaped = useCallback(() => {
        playLifeLostSound();
        setComboCount(0);

        setGameState(prev => {
            const newLives = prev.lives - 1;
            if (newLives <= 0) {
                handleGameOver();
                return { ...prev, lives: 0 };
            }
            return { ...prev, lives: newLives };
        });
    }, [playLifeLostSound, handleGameOver]);

    const handleLetterMiss = useCallback(() => {
        playMissSound();
        setComboCount(0);

        // Penalty
        lowerBackgroundVolume();
        setGameState(prev => ({
            ...prev,
            isPenalized: true,
            penaltyTime: 3,
            showCentralMessage: true,
            centralMessage: "Recalibrando... 3s"
        }));

        let countdown = 3;
        const interval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                setGameState(prev => ({ ...prev, penaltyTime: countdown, centralMessage: `Recalibrando... ${countdown}s` }));
                playCountdownSound(countdown);
            } else {
                clearInterval(interval);
                restoreBackgroundVolume();
                setGameState(prev => ({
                    ...prev,
                    isPenalized: false,
                    penaltyTime: 0,
                    showCentralMessage: false,
                    centralMessage: null
                }));
            }
        }, 1000);
    }, [playMissSound, lowerBackgroundVolume, restoreBackgroundVolume, playCountdownSound]);

    const handleProximityWarning = useCallback((hasWarning: boolean) => {
        if (hasWarning) {
            if (!proximityBeepIntervalRef.current && !isMuted && gameState.isPlaying) {
                playProximityBeep();
                proximityBeepIntervalRef.current = window.setInterval(playProximityBeep, 500);
            }
        } else {
            if (proximityBeepIntervalRef.current) {
                clearInterval(proximityBeepIntervalRef.current);
                proximityBeepIntervalRef.current = undefined;
            }
        }
    }, [isMuted, gameState.isPlaying, playProximityBeep]);

    const startGame = useCallback(() => {
        initAudioContext();
        setGameState(prev => ({
            ...prev,
            isPlaying: true,
            score: 0,
            lives: 3,
            currentStage: 0,
            gameSpeed: INITIAL_GAME_SPEED,
            letterSpeed: INITIAL_LETTER_SPEED,
            fallingLetters: [],
            meteorites: [],
            isPaused: false,
            isPenalized: false
        }));
        startBackgroundMusic();
    }, [initAudioContext, startBackgroundMusic]);

    const continueGame = useCallback(() => {
        initAudioContext();
        setGameState(prev => ({
            ...prev,
            isPlaying: true,
            lives: 3,
            isPaused: false,
            isPenalized: false,
            fallingLetters: [],
            meteorites: []
        }));
        startBackgroundMusic();
    }, [initAudioContext, startBackgroundMusic]);

    // Keyboard Input
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!gameState.isPlaying || gameState.isPaused || gameState.isPenalized) return;

            const key = event.key.toUpperCase();
            if (LETTERS.includes(key)) {
                setGameState(prev => ({ ...prev, pressedKey: key }));
                phaserRef.current?.shootBullet(key);
                playShootSound();
            } else if (event.code === 'Space') {
                setIsSpacePressed(true);
                // Activate force field logic if needed
            } else if (event.key === 'Escape') {
                setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            const key = event.key.toUpperCase();
            if (LETTERS.includes(key)) {
                setGameState(prev => ({ ...prev, pressedKey: null }));
            } else if (event.code === 'Space') {
                setIsSpacePressed(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState.isPlaying, gameState.isPaused, gameState.isPenalized, playShootSound]);

    // Mobile Detection
    useEffect(() => {
        const checkMobile = () => setIsMobile(/Mobi|Android/i.test(navigator.userAgent));
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <div className="game-container">
            <MobileWarning />
            <Starfield />
            <div className="bg-grid"></div>

            {/* Phaser Game Layer */}
            <PhaserGame
                ref={phaserRef}
                gameState={gameState}
                callbacks={{
                    onScoreChange: () => { },
                    onLivesChange: () => { },
                    onLetterHit: handleLetterHit,
                    onLetterMiss: handleLetterMiss,
                    onLetterEscaped: handleLetterEscaped,
                    onWrongKey: handleLetterMiss,
                    onMeteoriteHit: () => { },
                    onStageAdvance: () => { },
                    onGameOver: handleGameOver,
                    onProximityWarning: handleProximityWarning,
                    onCombo: () => { },
                    onSequentialBonus: () => { }
                }}
            />
            <div className="game-ui-container">
                <div className="sector-info">
                    <div className="sector-panel">
                        <div className="sector-label">SECTOR</div>
                        <div className="sector-name">{TYPING_STAGES[gameState.currentStage]?.name || 'N/A'}</div>
                    </div>
                </div>

                {gameState.showSectorInfo && (
                    <div className="sector-info-large">
                        <div className="sector-panel-large">
                            <div className="sector-label-large">NUEVO SECTOR</div>
                            <div className="sector-name-large">{TYPING_STAGES[gameState.currentStage]?.name}</div>
                        </div>
                    </div>
                )}

                {isComboMessageVisible && (
                    <div className="floating-combo-message">
                        <div className="floating-combo-content">{currentComboMessage}</div>
                    </div>
                )}

                <div className="integrated-control-panel">
                    <div className="control-section left-section">
                        <HandMap side="left" highlightedKey={gameState.pressedKey || undefined} isSpacePressed={isSpacePressed} subtleKeys={[]} />
                    </div>
                    <div className="central-instruments">
                        <HUD score={gameState.score} lives={gameState.lives} isMuted={isMuted} onToggleMute={toggleMute} />
                    </div>
                    <div className="control-section right-section">
                        <HandMap side="right" highlightedKey={gameState.pressedKey || undefined} isSpacePressed={isSpacePressed} subtleKeys={[]} />
                    </div>
                </div>
            </div>

            <CentralMessage message={gameState.centralMessage} countdown={gameState.countdown} show={gameState.showCentralMessage} />

            {!gameState.isPlaying && gameState.lives > 0 && (
                <Instructions onStart={() => startGame()} onContinue={continueGame} showContinue={gameState.score > 0} />
            )}

            {!gameState.isPlaying && gameState.lives <= 0 && (
                <GameOver score={gameState.score} onContinue={continueGame} onNewGame={startGame} />
            )}
        </div>
    );
};

export default Game;