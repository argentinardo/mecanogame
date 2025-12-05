import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HUD } from './HUD';
import { Instructions } from './Instructions';
import { GameOver } from './GameOver';
import { HandMap } from './HandMap';
import { CentralMessage } from './CentralMessage';
import { VirtualKeyboard } from './VirtualKeyboard';

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

// Umbrales de letras destruidas para cada sector (0-9)
// Cuando el jugador destruye este número de letras en un sector, aparece el BOSS
// Después de derrotar al boss, avanza al siguiente sector
// Ejemplo:
//   - Sector 0: Boss aparece después de destruir 3 letras
//   - Sector 1: Boss aparece después de destruir 150 letras
//   - Sector 2: Boss aparece después de destruir 300 letras
//   - etc.
// El índice del array corresponde al número del sector (currentStage)
// Umbrales de letras destruidas para cada sector (0-9)
// Cuando el jugador destruye este número de letras en un sector, aparece el BOSS
// Después de derrotar al boss, avanza al siguiente sector
// Ejemplo:
//   - Sector 0: Boss aparece después de destruir 3 letras
//   - Sector 1: Boss aparece después de destruir 150 letras
//   - Sector 2: Boss aparece después de destruir 300 letras
//   - etc.
// El índice del array corresponde al número del sector (currentStage)
const LETTERS_DESTROYED_THRESHOLDS = [
    30,    // Sector 0: FILA SUPERIOR (QWERTYUIOP) - Reduced from 50
    150,  // Sector 1: FILA CENTRAL (ASDFGHJKLÑ)
    300,  // Sector 2: FILA INFERIOR (ZXCVBNM)
    500,  // Sector 3: NÚMEROS 1-5
    750,  // Sector 4: NÚMEROS 6-0
    1000, // Sector 5: COMBINADO Superior + Central
    1300, // Sector 6: COMBINADO Central + Inferior
    1600, // Sector 7: COMBINADO Superior + Números
    2000, // Sector 8: COMBINADO Central + Números
    2500  // Sector 9: TODAS LAS TECLAS
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
        playCountdownSound,
        playBossShot,
        playForceFieldHit,
        playSegmentExplosion,
        playBossSpawn,
        playBossLaugh,
        startBossMusic,
        startMenuMusic,
        startGameOverMusic,
        stopGameOverMusic,
        playScoringSound,
        playBlastSound,
        stopBossLaugh
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
        isLifeLostPaused: false,
        showSectorInfo: false,
        sectorInfoTimeout: null,
        firstMeteoritePause: false,
        forceFieldActivationMessage: false,
        thresholds: LETTERS_DESTROYED_THRESHOLDS
    });

    const [comboCount, setComboCount] = useState<number>(0);


    const [isMobile, setIsMobile] = useState(false);
    const [isLandscape, setIsLandscape] = useState(false);
    const [difficulty, setDifficulty] = useState<'novice' | 'advanced' | 'expert'>('novice');

    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            const isMobileDevice = /android|ipad|iphone|ipod/i.test(userAgent);
            const isSmallScreen = window.innerWidth <= 768; // Also check screen width for simulator
            const mobile = isMobileDevice || isSmallScreen;
            setIsMobile(mobile);

            // Check orientation
            if (mobile) {
                setIsLandscape(window.innerWidth > window.innerHeight);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        window.addEventListener('orientationchange', checkMobile);
        return () => {
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener('orientationchange', checkMobile);
        };
    }, []);
    const [lastHitTime, setLastHitTime] = useState<number>(0);
    const [sequentialHits, setSequentialHits] = useState<number>(0);

    // Use refs to track current values for callbacks (always up-to-date)
    const comboCountRef = useRef<number>(0);
    const lastHitTimeRef = useRef<number>(0);
    const sequentialHitsRef = useRef<number>(0);

    // Sync refs with state when state changes
    useEffect(() => {
        comboCountRef.current = comboCount;
    }, [comboCount]);

    useEffect(() => {
        sequentialHitsRef.current = sequentialHits;
    }, [sequentialHits]);

    useEffect(() => {
        lastHitTimeRef.current = lastHitTime;
    }, [lastHitTime]);

    const [currentComboMessage, setCurrentComboMessage] = useState<string | null>(null);
    const [isComboMessageVisible, setIsComboMessageVisible] = useState<boolean>(false);

    const [currentOrderMessage, setCurrentOrderMessage] = useState<string | null>(null);
    const [isOrderMessageVisible, setIsOrderMessageVisible] = useState<boolean>(false);

    const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

    const phaserRef = useRef<PhaserGameRef>(null);
    const proximityBeepIntervalRef = useRef<number | undefined>(undefined);
    const penaltyIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lifeLostCountdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const bossLaughIntervalRef = useRef<number | undefined>(undefined);
    const deathReasonRef = useRef<string | null>(null);


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
        // Delay explosion sound to let laser sound play first (sequence: Laser -> Explosion)
        setTimeout(() => {
            playExplosionSound();
        }, 150);

        // playScoringSound(); // Removed: Now played when points actually appear (in handleScoreChange)

        // Combo Logic - use refs to get current values
        const currentTime = Date.now();
        const timeSinceLastHit = lastHitTimeRef.current > 0 ? currentTime - lastHitTimeRef.current : Infinity;

        let newComboCount: number;
        let newSequentialHits: number;

        if (timeSinceLastHit <= 1200 && lastHitTimeRef.current > 0) {
            newComboCount = comboCountRef.current + 1;
            newSequentialHits = sequentialHitsRef.current + 1;
        } else {
            newComboCount = 1;
            newSequentialHits = 1;
        }

        // Update refs immediately
        comboCountRef.current = newComboCount;
        sequentialHitsRef.current = newSequentialHits;
        lastHitTimeRef.current = currentTime;

        // Update states
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

        // Score calculation
        const baseScore = 10;
        const comboScore = Math.floor(baseScore * currentMultiplier);
        const totalScore = comboScore;

        // Combo Messages
        if (newComboCount >= 3) {
            playComboSuccessSound();
            setCurrentComboMessage(`COMBO ${newComboCount}! x${currentMultiplier}`);
            setIsComboMessageVisible(true);
            setTimeout(() => setIsComboMessageVisible(false), 1500);
        }

        // Order Message (for sequential hits in correct order)
        // Show order message when sequential hits reach certain thresholds
        if (newSequentialHits >= 5) {
            const orderBonus = Math.floor(newSequentialHits / 5) * 5;
            setCurrentOrderMessage(`ORDEN ${newSequentialHits}!\n+${orderBonus} BONUS`);
            setIsOrderMessageVisible(true);
            setTimeout(() => setIsOrderMessageVisible(false), 2000);
        }

        // Return points and total score for Phaser to use
        // Score will be updated later when points text disappears
        return {
            points: comboScore, // Points to display
            totalScore: totalScore // Score to add when text disappears
        };

    }, [playExplosionSound, playComboSuccessSound]);

    // Handle score change when points text disappears
    const handleScoreChange = useCallback((newScore: number) => {
        playScoringSound(); // Play scoring sound when points are awarded (text appears)
        setGameState(prev => {
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

            // Check Stage Advance - spawn boss first, then advance stage when boss is defeated
            // Don't advance stage immediately, let boss appear first
            // The boss will trigger the stage advance when defeated

            return {
                ...prev,
                score: newScore,
                lettersDestroyed: newLettersDestroyed,
                gameSpeed: newGameSpeed,
                letterSpeed: newLetterSpeed
            };
        });
    }, [advanceStage, playScoringSound]);

    // Handle score change ONLY (no difficulty progression or letter count update)
    // Used for boss segments and other bonus points
    const handleScoreUpdateOnly = useCallback((scoreToAdd: number) => {
        playScoringSound(); // Play scoring sound when points are awarded
        setGameState(prev => ({
            ...prev,
            score: prev.score + scoreToAdd
        }));
    }, [playScoringSound]);

    const handleGameOver = useCallback(() => {
        playGameOverSound();
        stopBackgroundMusic();
        setGameState(prev => ({ ...prev, isPlaying: false, isPaused: false }));

        // Start Game Over music
        startGameOverMusic();

        // Play laugh ONLY if killed by boss
        if (deathReasonRef.current === 'boss') {
            // Play laugh immediately
            playBossLaugh();

            // Set up interval to play laugh every 5 seconds
            bossLaughIntervalRef.current = window.setInterval(() => {
                playBossLaugh();
            }, 5000);
        }
    }, [playGameOverSound, stopBackgroundMusic, startGameOverMusic, playBossLaugh]);

    const handleLetterEscaped = useCallback(() => {
        playLifeLostSound();
        comboCountRef.current = 0;
        sequentialHitsRef.current = 0;
        lastHitTimeRef.current = 0;
        setComboCount(0);
        setSequentialHits(0);
        setLastHitTime(0);

        // Clear any existing countdown
        if (lifeLostCountdownRef.current) {
            clearInterval(lifeLostCountdownRef.current);
            lifeLostCountdownRef.current = null;
        }

        setGameState(prev => {
            const newLives = prev.lives - 1;
            if (newLives <= 0) {
                handleGameOver();
                return { ...prev, lives: 0 };
            }

            // Show countdown message and pause game (separate from isPaused)
            return {
                ...prev,
                lives: newLives,
                isLifeLostPaused: true,
                showCentralMessage: true,
                centralMessage: "LETRA PERDIDA",
                countdown: 3
            };
        });

        // Life lost countdown started

        // Countdown from 3 to 1
        let countdown = 3;
        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                setGameState(prev => ({
                    ...prev,
                    countdown: countdown
                }));
                playCountdownSound(countdown);
            } else {
                clearInterval(countdownInterval);
                lifeLostCountdownRef.current = null;
                // Resume game and restore ship visibility
                setGameState(prev => ({
                    ...prev,
                    isLifeLostPaused: false,
                    showCentralMessage: false,
                    centralMessage: null,
                    countdown: null
                }));
                // Restore ship visibility in Phaser
                if (phaserRef.current) {
                    const game = (phaserRef.current as any).phaserGameRef?.current;
                    if (game) {
                        const scene = game.scene.getScene('GameScene');
                        if (scene && (scene as any).ship) {
                            (scene as any).ship.setVisible(true);
                        }
                    }
                }
            }
        }, 1000);

        lifeLostCountdownRef.current = countdownInterval;
    }, [playLifeLostSound, handleGameOver, playCountdownSound]);

    const handleShipDestroyed = useCallback((reason?: string) => {
        playLifeLostSound();
        deathReasonRef.current = reason || null;
        comboCountRef.current = 0;
        sequentialHitsRef.current = 0;
        lastHitTimeRef.current = 0;
        setComboCount(0);
        setSequentialHits(0);
        setLastHitTime(0);

        // Clear any existing countdown
        if (lifeLostCountdownRef.current) {
            clearInterval(lifeLostCountdownRef.current);
            lifeLostCountdownRef.current = null;
        }

        setGameState(prev => {
            const newLives = prev.lives - 1;
            if (newLives <= 0) {
                handleGameOver();
                return { ...prev, lives: 0 };
            }

            // Show countdown message with "NAVE DESTRUIDA"
            return {
                ...prev,
                lives: newLives,
                isLifeLostPaused: true,
                showCentralMessage: true,
                centralMessage: "NAVE DESTRUIDA",
                countdown: 3
            };
        });

        // Ship destroyed countdown started

        // Countdown from 3 to 1
        let countdown = 3;
        const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                setGameState(prev => ({
                    ...prev,
                    countdown: countdown
                }));
                playCountdownSound(countdown);
            } else {
                clearInterval(countdownInterval);
                lifeLostCountdownRef.current = null;
                // Resume game and restore ship visibility
                setGameState(prev => ({
                    ...prev,
                    isLifeLostPaused: false,
                    showCentralMessage: false,
                    centralMessage: null,
                    countdown: null
                }));
                // Restore ship visibility in Phaser
                if (phaserRef.current) {
                    const game = (phaserRef.current as any).phaserGameRef?.current;
                    if (game) {
                        const scene = game.scene.getScene('GameScene');
                        if (scene && (scene as any).ship) {
                            (scene as any).ship.setVisible(true);
                        }
                    }
                }
            }
        }, 1000);

        lifeLostCountdownRef.current = countdownInterval;
    }, [playLifeLostSound, handleGameOver, playCountdownSound]);

    const handleLetterMiss = useCallback(() => {
        playMissSound();
        comboCountRef.current = 0;
        sequentialHitsRef.current = 0;
        lastHitTimeRef.current = 0;
        setComboCount(0);
        setSequentialHits(0);
        setLastHitTime(0);

        // Clear any existing penalty interval
        if (penaltyIntervalRef.current) {
            clearInterval(penaltyIntervalRef.current);
            penaltyIntervalRef.current = null;
        }

        // Penalty
        lowerBackgroundVolume();
        setGameState(prev => ({
            ...prev,
            isPenalized: true,
            penaltyTime: 3,
            showCentralMessage: true,
            centralMessage: "Recalibrando... 3s\nPresiona BACKSPACE para saltear"
        }));

        let countdown = 3;
        const interval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                setGameState(prev => ({ ...prev, penaltyTime: countdown, centralMessage: `Recalibrando... ${countdown}s\nPresiona BACKSPACE para saltear` }));
                playCountdownSound(countdown);
            } else {
                clearInterval(interval);
                penaltyIntervalRef.current = null;
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

        penaltyIntervalRef.current = interval;
    }, [playMissSound, lowerBackgroundVolume, restoreBackgroundVolume, playCountdownSound]);

    const skipPenalty = useCallback(() => {
        if (penaltyIntervalRef.current && gameState.isPenalized) {
            clearInterval(penaltyIntervalRef.current);
            penaltyIntervalRef.current = null;
            restoreBackgroundVolume();
            setGameState(prev => ({
                ...prev,
                isPenalized: false,
                penaltyTime: 0,
                showCentralMessage: false,
                centralMessage: null
            }));
        }
    }, [gameState.isPenalized, restoreBackgroundVolume]);

    const handleBossDefeated = useCallback((nextStage: number) => {
        // Boss defeated - advance stage, show sector info and pause
        playLevelUpSound();
        startBackgroundMusic(); // Resume main theme

        // Pause for sector info
        const timeout = setTimeout(() => {
            setGameState(p => ({ ...p, showSectorInfo: false, isPaused: false, sectorInfoTimeout: null }));
        }, 5000);

        setGameState(prev => ({
            ...prev,
            currentStage: nextStage, // Advance to next stage
            showSectorInfo: true,
            isPaused: true,
            sectorInfoTimeout: timeout as unknown as number
        }));
    }, [playLevelUpSound, startBackgroundMusic]);

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

    const startGame = useCallback((startingLevel: number = 0) => {
        // Clear boss laugh interval if exists
        if (bossLaughIntervalRef.current) {
            clearInterval(bossLaughIntervalRef.current);
            bossLaughIntervalRef.current = undefined;
        }
        stopGameOverMusic();
        stopBossLaugh();

        initAudioContext();

        // Adjust settings based on difficulty
        let initialGameSpeed = INITIAL_GAME_SPEED;
        let initialLetterSpeed = INITIAL_LETTER_SPEED;

        if (difficulty === 'advanced') {
            initialGameSpeed = 1800;
            initialLetterSpeed = 1.2;
        } else if (difficulty === 'expert') {
            initialGameSpeed = 1500;
            initialLetterSpeed = 1.5;
        }

        setGameState(prev => ({
            ...prev,
            isPlaying: true,
            score: 0,
            lives: 3,
            currentStage: startingLevel,
            gameSpeed: initialGameSpeed,
            letterSpeed: initialLetterSpeed,
            fallingLetters: [],
            meteorites: [],
            isPaused: false,
            isLifeLostPaused: false,
            isPenalized: false,
            thresholds: LETTERS_DESTROYED_THRESHOLDS // Pass thresholds to GameScene
        }));
        startBackgroundMusic();
    }, [initAudioContext, startBackgroundMusic, stopGameOverMusic, stopBossLaugh, difficulty]);

    const resetToMenu = useCallback(() => {
        // Clear boss laugh interval if exists
        if (bossLaughIntervalRef.current) {
            clearInterval(bossLaughIntervalRef.current);
            bossLaughIntervalRef.current = undefined;
        }
        stopGameOverMusic();
        stopBossLaugh();

        setGameState(prev => ({
            ...prev,
            isPlaying: false, // Go back to menu
            score: 0,
            lives: 3, // Reset lives to show Instructions
            currentStage: 0,
            fallingLetters: [],
            meteorites: [],
            isPaused: false,
            isLifeLostPaused: false,
            isPenalized: false
        }));

        // Don't start background music yet, wait for user to start
    }, [stopGameOverMusic, stopBossLaugh]);

    const continueGame = useCallback(() => {
        // Clear boss laugh interval if exists
        if (bossLaughIntervalRef.current) {
            clearInterval(bossLaughIntervalRef.current);
            bossLaughIntervalRef.current = undefined;
        }
        stopBossLaugh();
        stopGameOverMusic();

        initAudioContext();
        setGameState(prev => ({
            ...prev,
            isPlaying: true,
            lives: 3,
            isPaused: false,
            isLifeLostPaused: false,
            isPenalized: false,
            fallingLetters: [],
            meteorites: [],
            thresholds: LETTERS_DESTROYED_THRESHOLDS // Pass thresholds to GameScene
        }));
        startBackgroundMusic();
    }, [initAudioContext, startBackgroundMusic, stopGameOverMusic, stopBossLaugh]);

    // Virtual Keyboard Handlers
    const handleVirtualKeyPress = useCallback((key: string) => {
        // Don't process keys when paused, penalized, or life lost countdown
        if (!gameState.isPlaying || gameState.isPaused || gameState.isPenalized || gameState.isLifeLostPaused) return;

        setGameState(prev => ({ ...prev, pressedKey: key }));
        phaserRef.current?.shootBullet(key);
        playShootSound();

        // Reset pressed key after a short delay for visual feedback
        setTimeout(() => {
            setGameState(prev => ({ ...prev, pressedKey: null }));
        }, 150);
    }, [gameState.isPlaying, gameState.isPaused, gameState.isPenalized, gameState.isLifeLostPaused, playShootSound]);

    const handleVirtualSpacePress = useCallback(() => {
        // Activate force field (only when playing and not paused/penalized)
        if (gameState.isPlaying && !gameState.isPaused && !gameState.isPenalized && !gameState.isLifeLostPaused) {
            setIsSpacePressed(true);
            phaserRef.current?.activateForceField();

            // Reset space pressed state
            setTimeout(() => {
                setIsSpacePressed(false);
            }, 150);
        }
    }, [gameState.isPlaying, gameState.isPaused, gameState.isPenalized, gameState.isLifeLostPaused]);

    // Keyboard Input
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Handle pause/unpause with Escape (works even when paused)
            if (event.key === 'Escape' && gameState.isPlaying) {
                setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
                return;
            }

            // Handle Enter to continue when sector info is shown
            if (event.key === 'Enter' && gameState.isPlaying && gameState.isPaused && gameState.showSectorInfo) {
                event.preventDefault();
                // Clear timeout and resume game
                if (gameState.sectorInfoTimeout) {
                    clearTimeout(gameState.sectorInfoTimeout);
                }
                setGameState(prev => ({
                    ...prev,
                    showSectorInfo: false,
                    isPaused: false,
                    sectorInfoTimeout: null
                }));
                return;
            }

            // Handle skip penalty with Backspace (works when penalized)
            if (event.key === 'Backspace' && gameState.isPenalized) {
                event.preventDefault();
                skipPenalty();
                return;
            }

            // Don't process other keys when paused, penalized, or life lost countdown
            if (!gameState.isPlaying || gameState.isPaused || gameState.isPenalized || gameState.isLifeLostPaused) return;

            const key = event.key.toUpperCase();
            if (LETTERS.includes(key)) {
                setGameState(prev => ({ ...prev, pressedKey: key }));
                phaserRef.current?.shootBullet(key);
                playShootSound();
            } else if (event.code === 'Space') {
                setIsSpacePressed(true);
                // Activate force field (only when playing and not paused/penalized)
                if (gameState.isPlaying && !gameState.isPaused && !gameState.isPenalized && !gameState.isLifeLostPaused) {
                    phaserRef.current?.activateForceField();
                }
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
    }, [gameState.isPlaying, gameState.isPaused, gameState.isPenalized, gameState.isLifeLostPaused, gameState.showSectorInfo, gameState.sectorInfoTimeout, playShootSound, skipPenalty]);

    // Cleanup intervals on unmount
    useEffect(() => {
        return () => {
            if (penaltyIntervalRef.current) {
                clearInterval(penaltyIntervalRef.current);
            }
            if (lifeLostCountdownRef.current) {
                clearInterval(lifeLostCountdownRef.current);
            }
        };
    }, []);

    // Mobile Detection (currently not used but kept for future features)

    // Start Menu Music on Mount - handled via interaction to avoid autoplay policy issues
    const [hasInteracted, setHasInteracted] = useState(false);

    useEffect(() => {
        const handleInteraction = () => {
            if (!hasInteracted) {
                setHasInteracted(true);
                initAudioContext();
                if (!gameState.isPlaying) {
                    startMenuMusic();
                }
            }
        };

        window.addEventListener('click', handleInteraction);
        window.addEventListener('keydown', handleInteraction);

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, [hasInteracted, initAudioContext, startMenuMusic, gameState.isPlaying]);

    // Mobile warning removed to allow gameplay with virtual keyboard
    // if (isMobile && isLandscape) { ... }

    // Show landscape warning on mobile
    if (isMobile && isLandscape) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: '#000',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 9999,
                textAlign: 'center',
                padding: '20px'
            }}>
                <h1 style={{ fontFamily: '"Press Start 2P", monospace', color: '#ff00ff', marginBottom: '20px', fontSize: '18px' }}>MODO VERTICAL REQUERIDO</h1>
                <p style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '12px', lineHeight: '1.8' }}>
                    Por favor, gira tu dispositivo<br />
                    para jugar en vertical.<br /><br />
                    🔄
                </p>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
            {/* Instructions (Splash Screen) - Full Screen */}
            {!gameState.isPlaying && gameState.lives > 0 && (
                <Instructions
                    onStart={(level) => startGame(level)}
                    onContinue={continueGame}
                    showContinue={gameState.score > 0}
                    isMobile={isMobile}
                    onDifficultyChange={setDifficulty}
                    currentDifficulty={difficulty}
                />
            )}

            {/* Game Over - Full Screen */}
            {!gameState.isPlaying && gameState.lives <= 0 && (
                <GameOver score={gameState.score} onContinue={continueGame} onNewGame={resetToMenu} />
            )}

            {/* Game Container - Only visible when playing */}
            {gameState.isPlaying && (
                <div className="game-container" style={isMobile ? {
                    height: '66vh',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    overflow: 'hidden'
                } : {}}>
                    <Starfield />
                    <div className="bg-grid"></div>

                    {/* Phaser Game Layer */}
                    <PhaserGame
                        ref={phaserRef}
                        gameState={gameState}
                        callbacks={{
                            onScoreChange: handleScoreChange,
                            onScoreUpdateOnly: handleScoreUpdateOnly,
                            onLivesChange: () => { },
                            onLetterHit: handleLetterHit,
                            onLetterMiss: handleLetterMiss,
                            onLetterEscaped: handleLetterEscaped,
                            onShipDestroyed: handleShipDestroyed,
                            onWrongKey: handleLetterMiss,
                            onMeteoriteHit: () => { },
                            onStageAdvance: handleBossDefeated,
                            onGameOver: handleGameOver,
                            onProximityWarning: handleProximityWarning,
                            onCombo: (count: number, multiplier: number) => {
                                // Combo callback - already handled in handleLetterHit
                                setCurrentComboMessage(`COMBO ${count}! x${multiplier}`);
                                setIsComboMessageVisible(true);
                                setTimeout(() => setIsComboMessageVisible(false), 1500);
                            },
                            onSequentialBonus: (bonus: number) => {
                                // Sequential bonus callback
                                setCurrentOrderMessage(`ORDEN PERFECTO!\n+${bonus} BONUS`);
                                setIsOrderMessageVisible(true);
                                setTimeout(() => setIsOrderMessageVisible(false), 2000);
                            },
                            onBossShot: playBossShot,
                            onForceFieldHit: playForceFieldHit,
                            onSegmentExplosion: playSegmentExplosion,
                            onBossSpawn: playBossSpawn,
                            onBossMusicStart: startBossMusic,
                            onBossLaugh: playBossLaugh,
                            onMassiveExplosion: playBlastSound
                        }}
                    />

                    <div className="game-ui-container" style={isMobile ? { display: 'none' } : {}}>
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

                    <CentralMessage
                        message={gameState.isPaused ? 'PAUSA\nPresiona ESC para continuar' : (gameState.centralMessage || null)}
                        countdown={gameState.isPaused ? null : gameState.countdown}
                        show={gameState.showCentralMessage || gameState.isPaused}
                        isMobile={isMobile}
                        onMessageClick={() => {
                            if (isMobile) {
                                if (gameState.isPaused && !gameState.showSectorInfo) {
                                    // Resume game (ESC) - only if not showing sector info
                                    setGameState(prev => ({ ...prev, isPaused: false }));
                                } else if (gameState.isPaused && gameState.showSectorInfo) {
                                    // Continue after sector info (ENTER)
                                    if (gameState.sectorInfoTimeout) {
                                        clearTimeout(gameState.sectorInfoTimeout);
                                    }
                                    setGameState(prev => ({
                                        ...prev,
                                        showSectorInfo: false,
                                        isPaused: false,
                                        sectorInfoTimeout: null
                                    }));
                                } else if (gameState.isPenalized) {
                                    // Skip penalty (BACKSPACE)
                                    skipPenalty();
                                }
                                // Note: isLifeLostPaused countdown cannot be skipped - no action needed
                            }
                        }}
                    />

                    {isComboMessageVisible && (
                        <div className="floating-combo-message" style={{ zIndex: 20 }}>
                            <div className="floating-combo-content">{currentComboMessage}</div>
                        </div>
                    )}

                    {isOrderMessageVisible && (
                        <div className="floating-order-message" style={{ zIndex: 20 }}>
                            <div className="floating-order-content">{currentOrderMessage}</div>
                        </div>
                    )}
                </div>
            )}

            {/* Mobile Virtual Keyboard - Bottom 34vh - Integrated with HUD */}
            {isMobile && gameState.isPlaying && (
                <div className="mobile-control-panel" style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '34vh',
                    zIndex: 1000,
                    pointerEvents: 'auto'
                }}>
                    {/* HUD Mobile Strip */}
                    <div className="mobile-hud-strip">
                        <HUD
                            score={gameState.score}
                            lives={gameState.lives}
                            isMuted={isMuted}
                            onToggleMute={toggleMute}
                            isMobile={true}
                        />
                    </div>

                    {/* Keyboard Container */}
                    <div className="keyboard-container">
                        <VirtualKeyboard
                            onKeyPress={handleVirtualKeyPress}
                            onSpacePress={handleVirtualSpacePress}
                            pressedKey={gameState.pressedKey}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Game;