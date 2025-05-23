import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Cannon } from './Cannon';
import { HUD } from './HUD';
import { Instructions } from './Instructions';
import { GameOver } from './GameOver';
import type { GameState, FallingLetter } from '../types/game';
import { TYPING_STAGES, KEYBOARD_POSITIONS } from '../types/game';

const LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
const MAX_LETTERS_ON_SCREEN = 10000;
const INITIAL_LETTER_SPEED = 0.5;
const INITIAL_GAME_SPEED = 2000;
const KEYBOARD_WIDTH = 800; // Ancho aproximado del teclado en píxeles
const KEYBOARD_START_X = 200; // Posición inicial X del teclado en la pantalla

// Constantes para la progresión de dificultad
const SPEED_INCREMENT = 0.1; // Incremento más pequeño de velocidad
const GAME_SPEED_DECREMENT = 100; // Reducción más gradual del tiempo entre letras
const MIN_GAME_SPEED = 800; // Velocidad mínima entre letras
const SCORE_THRESHOLD = 200; // Puntos necesarios para aumentar la dificultad

// Mapa de colores para cada letra
const LETTER_COLORS: Record<string, string> = {
    A: '#ff4b4b', B: '#ff914d', C: '#ffd24d', D: '#eaff4b', E: '#aaff4b',
    F: '#4bff6e', G: '#4bffd2', H: '#4bd2ff', I: '#4b6eff', J: '#914bff',
    K: '#d24bff', L: '#ff4bea', M: '#ff4bb2', N: '#ff4b7a', O: '#ff7a4b',
    P: '#ffb24b', Q: '#eaff4b', R: '#b2ff4b', S: '#4bff91', T: '#4bffd2',
    U: '#4bb2ff', V: '#4b7aff', W: '#7a4bff', X: '#b24bff', Y: '#ff4be0',
    Z: '#ff4bb2', Ñ: '#ff4b7a'
};

// Colores de borde para cada hilera
const ROW_BORDER_COLORS = {
    top: '#ffd700',    // Dorado para la hilera superior
    home: '#00ff00',   // Verde para la hilera inicial
    bottom: '#ff4500'  // Naranja para la hilera inferior
};

// Función para determinar la hilera de una letra
const getLetterRow = (letter: string): 'top' | 'home' | 'bottom' => {
    const topRow = 'QWERTYUIOP';
    const homeRow = 'ASDFGHJKLÑ';
    const bottomRow = 'ZXCVBNM';
    
    if (topRow.includes(letter)) return 'top';
    if (homeRow.includes(letter)) return 'home';
    if (bottomRow.includes(letter)) return 'bottom';
    return 'home'; // Por defecto
};

export const Game: React.FC = () => {
    const [gameState, setGameState] = useState<GameState>({
        score: 0,
        lives: 3,
        isPlaying: false,
        isPenalized: false,
        penaltyTime: 0,
        fallingLetters: [],
        bullets: [],
        gameSpeed: INITIAL_GAME_SPEED,
        letterSpeed: INITIAL_LETTER_SPEED,
        currentStage: 0
    });

    const gameAreaRef = useRef<HTMLDivElement>(null);
    const gameLoopRef = useRef<number | undefined>(undefined);
    const spawnIntervalRef = useRef<number | undefined>(undefined);
    const lastSpawnTimeRef = useRef<number>(0);

    const getLetterPosition = useCallback((letter: string) => {
        const position = KEYBOARD_POSITIONS[letter];
        if (!position) return { x: Math.random() * (window.innerWidth - 60), y: -60 };

        // Convertir la posición del teclado a coordenadas de pantalla
        // La posición X se calcula basada en la columna del teclado
        const x = KEYBOARD_START_X + (position.col * (KEYBOARD_WIDTH / 10));
        const y = -60; // Comenzar desde arriba

        return { x, y };
    }, []);

    const spawnLetters = useCallback(() => {
        if (!gameState.isPlaying) return;

        const now = Date.now();
        if (now - lastSpawnTimeRef.current < gameState.gameSpeed) {
            spawnIntervalRef.current = window.setTimeout(spawnLetters, gameState.gameSpeed);
            return;
        }

        if (gameState.fallingLetters.length >= MAX_LETTERS_ON_SCREEN) {
            spawnIntervalRef.current = window.setTimeout(spawnLetters, gameState.gameSpeed);
            return;
        }

        // Verificar que currentStage esté dentro de los límites válidos
        if (gameState.currentStage < 0 || gameState.currentStage >= TYPING_STAGES.length) {
            console.warn('Índice de etapa inválido:', gameState.currentStage);
            spawnIntervalRef.current = window.setTimeout(spawnLetters, gameState.gameSpeed);
            return;
        }

        const currentStage = TYPING_STAGES[gameState.currentStage];
        if (!currentStage || !currentStage.letters || currentStage.letters.length === 0) {
            console.warn('No hay letras disponibles para la etapa actual');
            spawnIntervalRef.current = window.setTimeout(spawnLetters, gameState.gameSpeed);
            return;
        }
        const letter = currentStage.letters[Math.floor(Math.random() * currentStage.letters.length)];
        const { x, y } = getLetterPosition(letter);
        
        // Verificar si ya existe una letra en la misma posición
        const isPositionOccupied = gameState.fallingLetters.some(
            existingLetter => Math.abs(existingLetter.x - x) < 60 // 60 es el ancho de la letra
        );

        if (isPositionOccupied) {
            // Si la posición está ocupada, intentar de nuevo en el siguiente ciclo
            spawnIntervalRef.current = window.setTimeout(spawnLetters, gameState.gameSpeed);
            return;
        }
        
        lastSpawnTimeRef.current = now;
        
        setGameState(prev => ({
            ...prev,
            fallingLetters: [...prev.fallingLetters, {
                letter,
                x,
                y,
                speed: prev.letterSpeed,
                id: now + Math.random()
            }]
        }));

        spawnIntervalRef.current = window.setTimeout(spawnLetters, gameState.gameSpeed);
    }, [gameState.isPlaying, gameState.fallingLetters, gameState.gameSpeed, gameState.letterSpeed, gameState.currentStage, getLetterPosition]);

    const shootBullet = useCallback((targetLetter: string) => {
        if (gameState.isPenalized) return;

        const targetLetterObj = gameState.fallingLetters.find(l => l.letter === targetLetter);
        if (!targetLetterObj) {
            handleMiss();
            return;
        }

        const laser = document.createElement('div');
        laser.className = 'bullet';
        
        const cannonRect = document.querySelector('.cannon')?.getBoundingClientRect();
        if (!cannonRect) return;

        const startX = cannonRect.left + cannonRect.width / 2;
        const startY = window.innerHeight - 130;
        
        const targetX = targetLetterObj.x + 30;
        const targetY = targetLetterObj.y + 30;
        
        // Calcular la longitud y ángulo del rayo
        const deltaX = targetX - startX;
        const deltaY = targetY - startY;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        
        // Establecer el estilo del rayo
        laser.style.position = 'absolute';
        laser.style.left = startX + 'px';
        laser.style.top = startY + 'px';
        laser.style.width = length + 'px';
        laser.style.height = '6px'; // Aumentado de 2px a 6px
        laser.style.background = 'linear-gradient(to right, #ff0000, #ffffff, #ff0000)';
        laser.style.boxShadow = '0 0 15px #ff0000, 0 0 30px #ff0000';
        laser.style.transformOrigin = '0 0';
        laser.style.transform = `rotate(${angle}deg)`;
        laser.style.opacity = '0.9';
        
        gameAreaRef.current?.appendChild(laser);
        
        // Crear efecto de parpadeo y cambio de color
        let opacity = 0.9;
        let colorPhase = 0;
        const fadeInterval = setInterval(() => {
            opacity = opacity === 0.9 ? 0.6 : 0.9;
            colorPhase = (colorPhase + 1) % 3;
            
            // Cambiar el color según la fase
            switch(colorPhase) {
                case 0:
                    laser.style.background = 'linear-gradient(to right, #ff0000, #ffffff, #ff0000)';
                    break;
                case 1:
                    laser.style.background = 'linear-gradient(to right, #ffffff, #ff0000, #ffffff)';
                    break;
                case 2:
                    laser.style.background = 'linear-gradient(to right, #ff0000, #ffffff, #ff0000)';
                    break;
            }
            
            laser.style.opacity = opacity.toString();
        }, 33); // Más rápido para una transición más suave
        
        // Eliminar el rayo después de un breve momento
        setTimeout(() => {
            clearInterval(fadeInterval);
            laser.remove();
            hitLetter(targetLetterObj, {
                left: targetX,
                top: targetY
            });
        }, 100);
    }, [gameState.isPenalized, gameState.fallingLetters]);

    const advanceStage = useCallback(() => {
        setGameState(prev => {
            const nextStage = prev.currentStage + 1;
            // Si ya estamos en la última etapa, no avanzamos más
            if (nextStage >= TYPING_STAGES.length) {
                return {
                    ...prev,
                    // Mantener la última etapa pero seguir aumentando la dificultad
                    gameSpeed: Math.max(MIN_GAME_SPEED, prev.gameSpeed - GAME_SPEED_DECREMENT),
                    letterSpeed: prev.letterSpeed + SPEED_INCREMENT
                };
            }
            return {
                ...prev,
                currentStage: nextStage,
                fallingLetters: [], // Limpiar letras actuales
                gameSpeed: Math.max(INITIAL_GAME_SPEED - (nextStage * 100), MIN_GAME_SPEED),
                letterSpeed: INITIAL_LETTER_SPEED + (nextStage * 0.5)
            };
        });
    }, []);

    const hitLetter = useCallback((letterObj: FallingLetter, bulletRect: { left: number; top: number }) => {
        createExplosion(bulletRect.left, bulletRect.top);
        
        setGameState(prev => {
            const newScore = prev.score + 10;
            // Aumentar dificultad cada SCORE_THRESHOLD puntos
            const shouldIncreaseDifficulty = newScore % SCORE_THRESHOLD === 0;
            const newGameSpeed = shouldIncreaseDifficulty 
                ? Math.max(MIN_GAME_SPEED, prev.gameSpeed - GAME_SPEED_DECREMENT)
                : prev.gameSpeed;
            const newLetterSpeed = shouldIncreaseDifficulty 
                ? prev.letterSpeed + SPEED_INCREMENT
                : prev.letterSpeed;
            
            // Verificar si debemos avanzar de etapa, pero asegurarnos de no exceder el límite
            const nextStage = prev.currentStage + 1;
            const shouldAdvanceStage = newScore >= (prev.currentStage + 1) * SCORE_THRESHOLD && nextStage < TYPING_STAGES.length;
            
            return {
                ...prev,
                score: newScore,
                gameSpeed: newGameSpeed,
                letterSpeed: newLetterSpeed,
                fallingLetters: prev.fallingLetters.filter(l => l.id !== letterObj.id),
                currentStage: shouldAdvanceStage ? nextStage : prev.currentStage
            };
        });

        // Avanzar a la siguiente etapa si es necesario y es posible
        if (gameState.score >= (gameState.currentStage + 1) * SCORE_THRESHOLD && 
            gameState.currentStage + 1 < TYPING_STAGES.length) {
            advanceStage();
        }
    }, [gameState.score, gameState.currentStage, advanceStage]);

    const handleMiss = useCallback(() => {
        setGameState(prev => ({
            ...prev,
            isPenalized: true,
            penaltyTime: 3
        }));

        const penaltyInterval = setInterval(() => {
            setGameState(prev => {
                const newPenaltyTime = prev.penaltyTime - 1;
                
                if (newPenaltyTime <= 0) {
                    clearInterval(penaltyInterval);
                    return {
                        ...prev,
                        isPenalized: false,
                        penaltyTime: 0
                    };
                }
                
                return {
                    ...prev,
                    penaltyTime: newPenaltyTime
                };
            });
        }, 1000);
    }, []);

    const createExplosion = (x: number, y: number) => {
        const explosion = document.createElement('div');
        explosion.className = 'explosion';
        explosion.style.left = (x - 50) + 'px';
        explosion.style.top = (y - 50) + 'px';
        gameAreaRef.current?.appendChild(explosion);
        
        for (let i = 0; i < 20; i++) {
            createParticle(x, y);
        }
        
        setTimeout(() => explosion.remove(), 500);
    };

    const createParticle = (x: number, y: number) => {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        gameAreaRef.current?.appendChild(particle);
        
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 4;
        const vx = Math.cos(angle) * speed;
        let vy = Math.sin(angle) * speed;
        const gravity = 0.2;
        
        let px = x, py = y;
        const particleInterval = setInterval(() => {
            px += vx;
            vy += gravity;
            py += vy;
            
            particle.style.left = px + 'px';
            particle.style.top = py + 'px';
            particle.style.opacity = String(parseFloat(particle.style.opacity || '1') - 0.01);
            
            if (parseFloat(particle.style.opacity) <= 0 || py > window.innerHeight) {
                clearInterval(particleInterval);
                particle.remove();
            }
        }, 16);
    };

    const startGame = useCallback(() => {
        if (spawnIntervalRef.current) {
            clearTimeout(spawnIntervalRef.current);
        }
        if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
        }

        lastSpawnTimeRef.current = 0;

        setGameState({
            score: 0,
            lives: 3,
            isPlaying: true,
            isPenalized: false,
            penaltyTime: 0,
            fallingLetters: [],
            bullets: [],
            gameSpeed: INITIAL_GAME_SPEED,
            letterSpeed: INITIAL_LETTER_SPEED,
            currentStage: 0
        });
    }, []);

    const endGame = useCallback(() => {
        setGameState(prev => ({
            ...prev,
            isPlaying: false
        }));
        
        if (spawnIntervalRef.current) {
            clearTimeout(spawnIntervalRef.current);
        }
        if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
        }
    }, []);

    const restartGame = useCallback(() => {
        if (spawnIntervalRef.current) {
            clearTimeout(spawnIntervalRef.current);
        }
        if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
        }
        
        startGame();
    }, [startGame]);

    // Efecto para iniciar el spawn de letras cuando isPlaying cambia a true
    useEffect(() => {
        if (gameState.isPlaying) {
            spawnLetters();
        }
    }, [gameState.isPlaying, spawnLetters]);

    // Efecto para el game loop
    useEffect(() => {
        const gameLoop = () => {
            if (!gameState.isPlaying) return;
            
            setGameState(prev => {
                const updatedLetters = prev.fallingLetters.map(letter => ({
                    ...letter,
                    y: letter.y + letter.speed
                }));

                const lettersAtBottom = updatedLetters.filter(letter => letter.y > window.innerHeight);
                if (lettersAtBottom.length > 0) {
                    const newLives = prev.lives - lettersAtBottom.length;
                    if (newLives <= 0) {
                        endGame();
                        return prev;
                    }
                    return {
                        ...prev,
                        lives: newLives,
                        fallingLetters: updatedLetters.filter(letter => letter.y <= window.innerHeight)
                    };
                }

                return {
                    ...prev,
                    fallingLetters: updatedLetters
                };
            });
            
            gameLoopRef.current = requestAnimationFrame(gameLoop);
        };

        if (gameState.isPlaying) {
            gameLoopRef.current = requestAnimationFrame(gameLoop);
        }

        return () => {
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
            }
        };
    }, [gameState.isPlaying, endGame]);

    // Efecto de limpieza
    useEffect(() => {
        return () => {
            if (spawnIntervalRef.current) {
                clearTimeout(spawnIntervalRef.current);
            }
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!gameState.isPlaying || gameState.isPenalized) return;
            
            const key = event.key.toUpperCase();
            if (LETTERS.includes(key)) {
                shootBullet(key);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [gameState.isPlaying, gameState.isPenalized, shootBullet]);

    return (
        <div className="game-container">
            <div className="bg-grid"></div>
            
            <HUD
                score={gameState.score}
                lives={gameState.lives}
                status={gameState.isPenalized ? `Recargando... ${gameState.penaltyTime}s` : '¡Listo para disparar!'}
                isPenalized={gameState.isPenalized}
                stage={TYPING_STAGES[gameState.currentStage]}
            />

            <div className="game-area" ref={gameAreaRef} style={{ 
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <Cannon isReloading={gameState.isPenalized} />
                {gameState.fallingLetters.map(letter => {
                    const row = getLetterRow(letter.letter);
                    return (
                        <div
                            key={letter.id}
                            className="falling-letter"
                            style={{
                                left: letter.x + 'px',
                                top: letter.y + 'px',
                                position: 'absolute',
                                width: '60px',
                                height: '60px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '36px',
                                fontWeight: 'bold',
                                color: LETTER_COLORS[letter.letter] || '#00ffff',
                                textShadow: `0 0 10px ${LETTER_COLORS[letter.letter] || '#00ffff'}`,
                                background: 'linear-gradient(45deg, #1a1a2e, #16213e)',
                                border: `3px solid ${ROW_BORDER_COLORS[row]}`,
                                borderRadius: '15px',
                                boxShadow: `0 0 20px ${ROW_BORDER_COLORS[row]}`
                            }}
                        >
                            {letter.letter}
                        </div>
                    );
                })}
            </div>

            {!gameState.isPlaying && gameState.lives > 0 && (
                <Instructions onStart={startGame} />
            )}

            {!gameState.isPlaying && gameState.lives <= 0 && (
                <GameOver score={gameState.score} onRestart={restartGame} />
            )}
        </div>
    );
}; 