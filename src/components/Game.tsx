import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Cannon } from './Cannon';
import { HUD } from './HUD';
import { Instructions } from './Instructions';
import { GameOver } from './GameOver';
import { HandMap } from './HandMap';
import { CentralMessage } from './CentralMessage';
import { SoundToggle } from './SoundToggle';
import { useAudio } from '../hooks/useAudio';
import type { GameState, FallingLetter } from '../types/game';
import { TYPING_STAGES, KEYBOARD_POSITIONS } from '../types/game';

// Importar imágenes de letras de la fila del medio (home row)
import letterA from '../assets/images/letter/A.png';
import letterS from '../assets/images/letter/s.png';
import letterD from '../assets/images/letter/d.png';
import letterF from '../assets/images/letter/f.png';
import letterG from '../assets/images/letter/g.png';
import letterH from '../assets/images/letter/h.png';
import letterJ from '../assets/images/letter/j.png';
import letterK from '../assets/images/letter/k.png';
import letterL from '../assets/images/letter/l.png';
import letterEnie from '../assets/images/letter/enie.png';

// Mapa de imágenes para las letras de la fila del medio (home row)
const LETTER_IMAGES: Record<string, string> = {
    'A': letterA,
    'S': letterS,
    'D': letterD,
    'F': letterF,
    'G': letterG,
    'H': letterH,
    'J': letterJ,
    'K': letterK,
    'L': letterL,
    'Ñ': letterEnie
};

const LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
const MAX_LETTERS_ON_SCREEN = 10000;
const INITIAL_LETTER_SPEED = 0.4;
const INITIAL_GAME_SPEED = 2200;

// Constantes para la progresión de dificultad
const SPEED_INCREMENT = 0.1; // Incremento más pequeño de velocidad
const GAME_SPEED_DECREMENT = 100; // Reducción más gradual del tiempo entre letras
const MIN_GAME_SPEED = 800; // Velocidad mínima entre letras
const SCORE_THRESHOLD = 200; // Puntos necesarios para aumentar la dificultad

// Constantes de tamaños para colisiones precisas
const LETTER_SIZE = 60;          // Tamaño de las letras que caen
const CANNON_RADIUS = 50;        // Radio de colisión del cañón (punto rojo de debug)
const FORCE_FIELD_RADIUS = 200;  // Radio del campo de fuerza protector

// Mapa de colores para cada letra
const LETTER_COLORS: Record<string, string> = {
    A: '#ff4b4b', B: '#ff914d', C: '#ffd24d', D: '#eaff4b', E: '#aaff4b',
    F: '#4bff6e', G: '#4bffd2', H: '#4bd2ff', I: '#4b6eff', J: '#914bff',
    K: '#d24bff', L: '#ff4bea', M: '#ff4bb2', N: '#ff4b7a', O: '#ff7a4b',
    P: '#ffb24b', Q: '#eaff4b', R: '#b2ff4b', S: '#4bff91', T: '#4bffd2',
    U: '#4bb2ff', V: '#4b7aff', W: '#7a4bff', X: '#b24bff', Y: '#ff4be0',
    Z: '#ff4bb2', Ñ: '#ff4b7a'
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
    const {
        playShootSound,
        playExplosionSound,
        playMissSound,
        playLifeLostSound,
        playGameOverSound,
        playLevelUpSound,
        playMeteoriteSound,
        startBackgroundMusic,
        stopBackgroundMusic,
        initAudioContext,
        toggleMute,
        isMuted
    } = useAudio();

    const [gameState, setGameState] = useState<GameState>({
        score: 0,
        lives: 3,
        isPlaying: false,
        isPenalized: false,
        penaltyTime: 0,
        fallingLetters: [],
        bullets: [],
        meteorites: [],
        forceField: null,
        gameSpeed: INITIAL_GAME_SPEED,
        letterSpeed: INITIAL_LETTER_SPEED,
        currentStage: 0,
        pressedKey: null,
        centralMessage: null,
        showCentralMessage: false,
        countdown: null,
        isPaused: false
    });

    const [cannonAngle, setCannonAngle] = useState<number>(0);
    const [comboCount, setComboCount] = useState<number>(0);
    const [lastHitTime, setLastHitTime] = useState<number>(0);

    const gameAreaRef = useRef<HTMLDivElement>(null);
    const gameLoopRef = useRef<number | undefined>(undefined);
    const spawnIntervalRef = useRef<number | undefined>(undefined);
    const lastSpawnTimeRef = useRef<number>(0);
    const lastSpawnedLetterRef = useRef<string | null>(null);
    const comboTimeoutRef = useRef<number | undefined>(undefined);

    const getLetterPosition = useCallback((letter: string) => {
        const position = KEYBOARD_POSITIONS[letter];
        if (!position) return { x: Math.random() * (window.innerWidth - LETTER_SIZE), y: -LETTER_SIZE };

        // Usar el ancho del contenedor del juego en lugar de window.innerWidth
        const gameArea = gameAreaRef.current;
        const gameAreaWidth = gameArea ? gameArea.offsetWidth : 1000; // Fallback al nuevo max-width
        
        // Márgenes más pequeños y adaptativos
        const keyboardMargin = Math.min(50, gameAreaWidth * 0.05); // 5% del ancho o máximo 50px
        const availableWidth = gameAreaWidth - (keyboardMargin * 2);
        
        // El teclado ahora usa columnas de 0 a 9.7 (Ñ), usamos 10 para dar un poco de margen
        const maxColumns = 10;
        const columnWidth = availableWidth / maxColumns;
        
        // Calcular la posición X basada en la columna real del teclado
        const x = keyboardMargin + (position.col * columnWidth);
        
        // Asegurar que la letra esté completamente dentro del área de juego
        const clampedX = Math.max(0, Math.min(x, gameAreaWidth - LETTER_SIZE));
        
        return { x: clampedX, y: -LETTER_SIZE };
    }, []);

    const spawnLetters = useCallback(() => {
        if (!gameState.isPlaying || gameState.isPaused) return;

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

        // Obtener letras disponibles excluyendo la última letra generada
        let availableLetters = currentStage.letters;
        if (lastSpawnedLetterRef.current && availableLetters.length > 1) {
            availableLetters = availableLetters.filter(letter => letter !== lastSpawnedLetterRef.current);
        }

        const letter = availableLetters[Math.floor(Math.random() * availableLetters.length)];
        lastSpawnedLetterRef.current = letter;
        
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
        
        // No permitir disparar mientras el campo de fuerza esté activo
        if (gameState.forceField?.isActive) return;

        const targetLetterObj = gameState.fallingLetters.find(l => l.letter === targetLetter);
        if (!targetLetterObj) {
            handleMiss();
            return;
        }

        // Reproducir sonido de disparo
        playShootSound();

        const laser = document.createElement('div');
        laser.className = 'bullet';
        
        const cannonRect = document.querySelector('.cannon-barrel')?.getBoundingClientRect();
        if (!cannonRect) return;

        // Posición de inicio del láser (punta del cañón)
        const startX = cannonRect.left + (cannonRect.width / 2);
        const startY = cannonRect.top;
        
        // Posición objetivo (centro de la letra)
        const gameArea = gameAreaRef.current?.getBoundingClientRect();
        if (!gameArea) return;

        const targetX = gameArea.left + targetLetterObj.x + (LETTER_SIZE / 2);
        const targetY = gameArea.top + targetLetterObj.y + (LETTER_SIZE / 2);
        
        // Calcular la longitud y ángulo del rayo
        const deltaX = targetX - startX;
        const deltaY = targetY - startY;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        
        // Rotar el cañón hacia el objetivo
        const cannonRotationAngle = Math.atan2(deltaX, -deltaY) * (180 / Math.PI);
        setCannonAngle(cannonRotationAngle);
        
        // Restablecer el ángulo del cañón después del disparo con animación rápida
        setTimeout(() => {
            setCannonAngle(0);
        }, 150);
        
        // Establecer el estilo del rayo
        laser.style.position = 'fixed';
        laser.style.left = `${startX}px`;
        laser.style.top = `${startY}px`;
        laser.style.width = `${length}px`;
        laser.style.height = '4px';
        laser.style.background = '#ff0000';
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
                    laser.style.background = 'yellow';
                    break;
                case 1:
                    laser.style.background = 'white';
                    break;
                case 2:
                    laser.style.background = 'red';
                    break;
            }
            
            laser.style.opacity = opacity.toString();
        }, 33);
        
        // Eliminar el rayo después de un breve momento
        setTimeout(() => {
            clearInterval(fadeInterval);
            laser.remove();
            // Ejecutar hitLetter de forma asíncrona para evitar problemas de dependencia
            setTimeout(() => hitLetter(targetLetterObj), 0);
        }, 100);
    }, [gameState.isPenalized, gameState.forceField, gameState.fallingLetters, playShootSound, setCannonAngle]);

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
            
            // Reproducir sonido de level up
            playLevelUpSound();
            
            return {
                ...prev,
                currentStage: nextStage,
                fallingLetters: [], // Limpiar letras actuales
                gameSpeed: Math.max(INITIAL_GAME_SPEED - (nextStage * 100), MIN_GAME_SPEED),
                letterSpeed: INITIAL_LETTER_SPEED + (nextStage * 0.5)
            };
        });
    }, [playLevelUpSound]);

    const hitLetter = useCallback((letterObj: FallingLetter) => {
        const gameArea = gameAreaRef.current?.getBoundingClientRect();
        if (!gameArea) return;

        // Calcular las coordenadas absolutas del centro de la letra
        const explosionX = gameArea.left + letterObj.x + (LETTER_SIZE / 2);
        const explosionY = gameArea.top + letterObj.y + (LETTER_SIZE / 2);
        
        // Reproducir sonido de explosión
        playExplosionSound();
        
        createExplosion(explosionX, explosionY);
        
        // Sistema de combos
        const currentTime = Date.now();
        const timeSinceLastHit = currentTime - lastHitTime;
        
        if (timeSinceLastHit <= 1500 && lastHitTime > 0) {
            // Continuar combo (aumentado a 1500ms para facilitar los combos)
            setComboCount(prev => {
                const newCount = prev + 1;
                // Programar mostrar combo con delay en lugar de inmediatamente
                setTimeout(() => scheduleComboMessage(), 0);
                return newCount;
            });
        } else {
            // Iniciar nuevo combo
            setComboCount(1);
            // Programar mostrar combo para el primer hit también
            setTimeout(() => scheduleComboMessage(), 0);
        }
        
        // TODO: Feedback inmediato deshabilitado para evitar conflicto con combos
        // if (comboCount >= 1) {
        //     showCentralMessage(`Hit ${comboCount + 1}!`, 800);
        // }
        
        setLastHitTime(currentTime);
        
        setGameState(prev => {
            const newScore = prev.score + 10;
            const shouldIncreaseDifficulty = newScore % SCORE_THRESHOLD === 0;
            const newGameSpeed = shouldIncreaseDifficulty 
                ? Math.max(MIN_GAME_SPEED, prev.gameSpeed - GAME_SPEED_DECREMENT)
                : prev.gameSpeed;
            const newLetterSpeed = shouldIncreaseDifficulty 
                ? prev.letterSpeed + SPEED_INCREMENT
                : prev.letterSpeed;
            
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

        if (gameState.score >= (gameState.currentStage + 1) * SCORE_THRESHOLD && 
            gameState.currentStage + 1 < TYPING_STAGES.length) {
            advanceStage();
        }
    }, [gameState.score, gameState.currentStage, advanceStage, playExplosionSound, lastHitTime, setComboCount, setLastHitTime]);

    // Función para mostrar mensaje central temporalmente
    const showCentralMessage = useCallback((message: string, duration: number = 2000) => {
        setGameState(prev => ({
            ...prev,
            centralMessage: message,
            showCentralMessage: true
        }));

        setTimeout(() => {
            setGameState(prev => ({
                ...prev,
                showCentralMessage: false,
                centralMessage: null
            }));
        }, duration);
    }, []);

    // Función para mostrar mensaje de combo
    const showComboMessage = useCallback((count: number) => {
        if (count < 2) return; // Mostrar combo desde 2 aciertos (más fácil)
        
        let adjective = '';
        if (count >= 15) adjective = 'ULTRA';
        else if (count >= 12) adjective = 'MEGA';
        else if (count >= 8) adjective = 'SUPER';
        else if (count >= 6) adjective = 'AWESOME';
        else if (count >= 4) adjective = 'GREAT';
        else if (count >= 2) adjective = 'GOOD';
        
        const message = `${adjective} COMBO ${count}!`;
        showCentralMessage(message, 2500);
    }, [showCentralMessage]);

    // Función para resetear combo
    const resetCombo = useCallback(() => {
        // Limpiar timeout pendiente
        if (comboTimeoutRef.current) {
            clearTimeout(comboTimeoutRef.current);
            comboTimeoutRef.current = undefined;
        }
        
        if (comboCount >= 2) {
            showComboMessage(comboCount);
        }
        setComboCount(0);
        setLastHitTime(0);
    }, [comboCount, showComboMessage, setComboCount, setLastHitTime]);

    // Función para programar mostrar combo con delay
    const scheduleComboMessage = useCallback(() => {
        // Limpiar timeout anterior si existe
        if (comboTimeoutRef.current) {
            clearTimeout(comboTimeoutRef.current);
        }
        
        // Programar mostrar el combo después de 500ms de inactividad (más rápido)
        comboTimeoutRef.current = window.setTimeout(() => {
            if (comboCount >= 2) {
                let adjective = '';
                if (comboCount >= 15) adjective = 'ULTRA';
                else if (comboCount >= 12) adjective = 'MEGA';
                else if (comboCount >= 8) adjective = 'SUPER';
                else if (comboCount >= 6) adjective = 'AWESOME';
                else if (comboCount >= 4) adjective = 'GREAT';
                else if (comboCount >= 2) adjective = 'GOOD';
                
                const message = `${adjective} COMBO ${comboCount}!`;
                showCentralMessage(message, 2000);
            }
        }, 500);
    }, [comboCount, showCentralMessage]);

    // Efecto para mostrar mensajes de combo eliminado - ahora usa delay

    const handleMiss = useCallback(() => {
        // Reproducir sonido de fallo
        playMissSound();
        
        // Resetear combo al fallar
        resetCombo();
        
        setGameState(prev => ({
            ...prev,
            isPenalized: true,
            penaltyTime: 3,
            showCentralMessage: true,
            centralMessage: 'Recalibrando... 3s'
        }));

        const penaltyInterval = setInterval(() => {
            setGameState(prev => {
                const newPenaltyTime = prev.penaltyTime - 1;
                
                if (newPenaltyTime > 0) {
                    return {
                        ...prev,
                        penaltyTime: newPenaltyTime,
                        showCentralMessage: true,
                        centralMessage: `Recalibrando... ${newPenaltyTime}s`
                    };
                }
                
                // Cuando llegue a 0, limpiar todo
                clearInterval(penaltyInterval);
                return {
                    ...prev,
                    isPenalized: false,
                    penaltyTime: 0,
                    showCentralMessage: false,
                    centralMessage: null
                };
            });
        }, 1000);
    }, [playMissSound, resetCombo]);

    const createExplosion = (x: number, y: number) => {
        // Solo crear partículas, sin la bola de explosión
        for (let i = 0; i < 20; i++) {
            createParticle(x, y);
        }
    };

    const createParticle = (x: number, y: number) => {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.position = 'fixed';
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.transform = 'translate(-50%, -50%)';
        document.body.appendChild(particle);
        
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
            
            particle.style.left = `${px}px`;
            particle.style.top = `${py}px`;
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

        // Solo inicializar contexto de audio, no iniciar música aquí
        initAudioContext();

        setGameState({
            score: 0,
            lives: 3,
            isPlaying: true,
            isPenalized: false,
            penaltyTime: 0,
            fallingLetters: [],
            bullets: [],
            meteorites: [],
            forceField: null,
            gameSpeed: INITIAL_GAME_SPEED,
            letterSpeed: INITIAL_LETTER_SPEED,
            currentStage: 0,
            pressedKey: null,
            centralMessage: null,
            showCentralMessage: false,
            countdown: null,
            isPaused: false
        });
    }, [initAudioContext]);

    const endGame = useCallback(() => {
        // Reproducir sonido de game over
        playGameOverSound();
        
        // Detener música de fondo
        stopBackgroundMusic();
        
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
    }, [playGameOverSound, stopBackgroundMusic]);

    const restartGame = useCallback(() => {
        // Limpiar todos los timeouts e intervalos
        if (spawnIntervalRef.current) {
            clearTimeout(spawnIntervalRef.current);
            spawnIntervalRef.current = undefined;
        }
        if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
            gameLoopRef.current = undefined;
        }
        
        // Resetear completamente las referencias
        lastSpawnTimeRef.current = 0;
        lastSpawnedLetterRef.current = null;
        
        // Resetear estados de combo
        setComboCount(0);
        setLastHitTime(0);
        setCannonAngle(0);
        
        // Inicializar contexto de audio
        initAudioContext();
        
        // Establecer estado inicial completamente limpio
        setGameState({
            score: 0,
            lives: 3,
            isPlaying: true,
            isPenalized: false,
            penaltyTime: 0,
            fallingLetters: [], // Asegurar que esté vacío
            bullets: [],
            meteorites: [],
            forceField: null,
            gameSpeed: INITIAL_GAME_SPEED,
            letterSpeed: INITIAL_LETTER_SPEED,
            currentStage: 0, // Comenzar desde la primera etapa
            pressedKey: null,
            centralMessage: null,
            showCentralMessage: false,
            countdown: null,
            isPaused: false
        });
    }, [initAudioContext, setComboCount, setLastHitTime, setCannonAngle]);

    // Función para iniciar cuenta regresiva cuando se pierde una vida
    const startLifeLostCountdown = useCallback(() => {
        // Reproducir sonido de vida perdida
        playLifeLostSound();
        
        setGameState(prev => ({
            ...prev,
            isPaused: true,
            countdown: 3,
            showCentralMessage: true
        }));

        let currentCount = 3;
        const countdownInterval = setInterval(() => {
            currentCount--;
            if (currentCount > 0) {
                setGameState(prev => ({
                    ...prev,
                    countdown: currentCount
                }));
            } else {
                clearInterval(countdownInterval);
                setGameState(prev => ({
                    ...prev,
                    isPaused: false,
                    countdown: null,
                    showCentralMessage: false
                }));
                showCentralMessage('¡Continúa!', 1000);
            }
        }, 1000);
    }, [showCentralMessage, playLifeLostSound]);

    // Función para obtener las coordenadas exactas del centro del cañón
    const getCannonCenterCoordinates = useCallback(() => {
        const gameArea = gameAreaRef.current;
        if (!gameArea) return { x: 0, y: 0 };
        
        const gameAreaRect = gameArea.getBoundingClientRect();
        
        // El cañón está centrado horizontalmente en el game-area
        // y posicionado a 150px desde el fondo (según CSS: bottom: 150px)
        const cannonX = gameAreaRect.width / 2;
        const cannonY = gameAreaRect.height - 150; // 150px desde el fondo según CSS
        
        return { x: cannonX, y: cannonY };
    }, []);

    // Función para generar meteoritos
    const spawnMeteorite = useCallback(() => {
        if (!gameState.isPlaying || gameState.isPaused) return;
        
        // Solo generar meteoritos a partir de la tercera etapa
        if (gameState.currentStage < -1) return;

        const gameArea = gameAreaRef.current;
        if (!gameArea) return;
        
        const gameAreaRect = gameArea.getBoundingClientRect();
        const { x: cannonX, y: cannonY } = getCannonCenterCoordinates();

        // Meteoritos aparecen desde toda la parte superior del game-area
        // Margen más conservador para asegurar que apunten hacia la nave
        const margin = 50;
        const startX = margin + Math.random() * (gameAreaRect.width - 2 * margin);
        const startY = -120; // Más arriba para dar tiempo de reacción

        // Calcular la dirección exacta hacia el centro del cañón
        const deltaX = cannonX - startX;
        const deltaY = cannonY - startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Velocidad más controlada y predecible
        const baseSpeed = 1.0; // Velocidad base ligeramente reducida
        const speedVariation = 0.4; // Menor variación para trayectorias más consistentes
        const speed = baseSpeed + (Math.random() * speedVariation);
        
        // Normalizar la dirección y aplicar velocidad
        const speedX = (deltaX / distance) * speed;
        const speedY = (deltaY / distance) * speed;

        // Tamaño consistente
        const minSize = 40;
        const maxSize = 60;
        const size = minSize + Math.random() * (maxSize - minSize);

        const meteorite = {
            x: startX,
            y: startY,
            speedX: speedX,
            speedY: speedY,
            size: size,
            rotation: 0,
            id: Date.now() + Math.random()
        };

        // Reproducir sonido de meteorito
        playMeteoriteSound();

        setGameState(prev => ({
            ...prev,
            meteorites: [...prev.meteorites, meteorite]
        }));
    }, [gameState.isPlaying, gameState.isPaused, gameState.currentStage, getCannonCenterCoordinates, playMeteoriteSound]);

    // Función para activar el campo de fuerza
    const activateForceField = useCallback(() => {
        if (!gameState.isPlaying || gameState.isPaused || gameState.forceField?.isActive) return;

        setGameState(prev => ({
            ...prev,
            forceField: {
                isActive: true,
                startTime: Date.now(),
                duration: 1000 // 1 segundo
            }
        }));

        // Desactivar el campo de fuerza después de 1 segundo
        setTimeout(() => {
            setGameState(prev => ({
                ...prev,
                forceField: null
            }));
        }, 1000);
    }, [gameState.isPlaying, gameState.isPaused]);

    // Función para verificar colisiones entre meteoritos y campo de fuerza
    const checkMeteoriteCollisions = useCallback(() => {
        if (!gameState.forceField?.isActive) return;

        setGameState(prev => {
            const destroyedMeteoriteIds: number[] = [];
            const { x: cannonX, y: cannonY } = getCannonCenterCoordinates();
            const forceFieldRadius = FORCE_FIELD_RADIUS; // 200px
            
            prev.meteorites.forEach(meteorite => {
                // Calcular el centro exacto del meteorito basado en su posición relativa
                const meteoriteCenterX = meteorite.x + (meteorite.size / 2);
                const meteoriteCenterY = meteorite.y + (meteorite.size / 2);
                
                // Calcular distancia entre centros usando coordenadas relativas del game-area
                const deltaX = meteoriteCenterX - cannonX;
                const deltaY = meteoriteCenterY - cannonY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                
                // Radio efectivo del meteorito para colisión
                const meteoriteRadius = meteorite.size / 2;
                
                // Colisión si la distancia entre centros es menor que la suma de los radios
                if (distance <= (forceFieldRadius + meteoriteRadius)) {
                    destroyedMeteoriteIds.push(meteorite.id);
                    // Crear explosión usando coordenadas absolutas para el efecto visual
                    const gameAreaRect = gameAreaRef.current?.getBoundingClientRect();
                    if (gameAreaRect) {
                        const explosionX = gameAreaRect.left + meteoriteCenterX;
                        const explosionY = gameAreaRect.top + meteoriteCenterY;
                        createExplosion(explosionX, explosionY);
                    }
                    playExplosionSound();
                }
            });

            return {
                ...prev,
                meteorites: prev.meteorites.filter(m => !destroyedMeteoriteIds.includes(m.id)),
                score: prev.score + (destroyedMeteoriteIds.length * 5) // 5 puntos por meteorito destruido
            };
        });
    }, [gameState.forceField, getCannonCenterCoordinates, createExplosion, playExplosionSound]);

    // Función para verificar colisiones entre meteoritos y el cañón
    const checkMeteoriteCannonCollisions = useCallback(() => {
        const { x: cannonX, y: cannonY } = getCannonCenterCoordinates();
        const cannonRadius = CANNON_RADIUS; // 50px

        setGameState(prev => {
            const hitMeteoriteIds: number[] = [];
            
            prev.meteorites.forEach(meteorite => {
                // Calcular el centro exacto del meteorito basado en su posición relativa
                const meteoriteCenterX = meteorite.x + (meteorite.size / 2);
                const meteoriteCenterY = meteorite.y + (meteorite.size / 2);
                
                // Calcular distancia entre centros usando coordenadas relativas del game-area
                const deltaX = meteoriteCenterX - cannonX;
                const deltaY = meteoriteCenterY - cannonY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                
                // Radio efectivo del meteorito para colisión
                const meteoriteRadius = meteorite.size / 2;
                
                // Colisión si la distancia entre centros es menor que la suma de los radios
                if (distance <= (cannonRadius + meteoriteRadius)) {
                    hitMeteoriteIds.push(meteorite.id);
                }
            });

            if (hitMeteoriteIds.length > 0) {
                const newLives = prev.lives - 1; // Solo quitar una vida por frame
                if (newLives <= 0) {
                    endGame();
                    return prev;
                }
                
                // Crear explosiones usando coordenadas absolutas para el efecto visual
                const gameAreaRect = gameAreaRef.current?.getBoundingClientRect();
                hitMeteoriteIds.forEach(id => {
                    const meteorite = prev.meteorites.find(m => m.id === id);
                    if (meteorite && gameAreaRect) {
                        const meteoriteCenterX = gameAreaRect.left + meteorite.x + (meteorite.size / 2);
                        const meteoriteCenterY = gameAreaRect.top + meteorite.y + (meteorite.size / 2);
                        createExplosion(meteoriteCenterX, meteoriteCenterY);
                    }
                });
                
                playLifeLostSound();
                startLifeLostCountdown();
                
                return {
                    ...prev,
                    lives: newLives,
                    meteorites: [], // Limpiar todos los meteoritos cuando se pierde vida
                    fallingLetters: [] // Limpiar letras cuando se pierde vida
                };
            }

            return prev;
        });
    }, [getCannonCenterCoordinates, endGame, createExplosion, playLifeLostSound, startLifeLostCountdown]);

    // Efecto para iniciar el spawn de letras cuando isPlaying cambia a true
    useEffect(() => {
        if (gameState.isPlaying) {
            spawnLetters();
        }
    }, [gameState.isPlaying, spawnLetters]);

    // Efecto para el game loop
    useEffect(() => {
        const gameLoop = () => {
            if (!gameState.isPlaying || gameState.isPaused) return;
            
            setGameState(prev => {
                const updatedLetters = prev.fallingLetters.map(letter => ({
                    ...letter,
                    y: letter.y + letter.speed
                }));

                // Actualizar meteoritos
                const updatedMeteoritos = prev.meteorites.map(meteorite => ({
                    ...meteorite,
                    x: meteorite.x + meteorite.speedX,
                    y: meteorite.y + meteorite.speedY,
                    rotation: meteorite.rotation + 2
                }));

                // Filtrar meteoritos que salieron del área de juego
                const gameArea = gameAreaRef.current;
                const gameAreaHeight = gameArea ? gameArea.offsetHeight : window.innerHeight;
                const gameAreaWidth = gameArea ? gameArea.offsetWidth : window.innerWidth;
                
                const meteoritosEnPantalla = updatedMeteoritos.filter(meteorite => 
                    meteorite.y < gameAreaHeight + 100 && // No han salido por abajo del game-area
                    meteorite.y > -200 && // No están demasiado arriba
                    meteorite.x > -100 && meteorite.x < gameAreaWidth + 100 // No han salido por los lados del game-area
                );

                const lettersAtBottom = updatedLetters.filter(letter => letter.y > window.innerHeight);
                if (lettersAtBottom.length > 0) {
                    const newLives = prev.lives - lettersAtBottom.length;
                    if (newLives <= 0) {
                        endGame();
                        return prev;
                    }
                    // Cuando se pierde una vida, limpiar todas las letras y meteoritos, e iniciar cuenta regresiva
                    startLifeLostCountdown();
                    return {
                        ...prev,
                        lives: newLives,
                        fallingLetters: [], // Limpiar todas las letras cuando se pierde una vida
                        meteorites: [] // También limpiar meteoritos
                    };
                }

                return {
                    ...prev,
                    fallingLetters: updatedLetters,
                    meteorites: meteoritosEnPantalla
                };
            });
            
            // Verificar colisiones de meteoritos
            checkMeteoriteCollisions();
            checkMeteoriteCannonCollisions();
            
            gameLoopRef.current = requestAnimationFrame(gameLoop);
        };

        if (gameState.isPlaying && !gameState.isPaused) {
            gameLoopRef.current = requestAnimationFrame(gameLoop);
        }

        return () => {
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
            }
        };
    }, [gameState.isPlaying, gameState.isPaused, endGame, startLifeLostCountdown, checkMeteoriteCollisions, checkMeteoriteCannonCollisions]);

    // Efecto para spawn de meteoritos
    useEffect(() => {
        if (!gameState.isPlaying || gameState.isPaused) return;
        
        // Solo generar meteoritos a partir de la tercera etapa
        if (gameState.currentStage < 2) return;

        const meteoriteInterval = setInterval(() => {
            // Spawn meteorito con mucha menos frecuencia
            if (Math.random() < 0.15) { // Reducido significativamente de 0.4 a 0.15
                spawnMeteorite();
            }
        }, 2500); // Aumentado significativamente de 1200ms a 2500ms

        return () => clearInterval(meteoriteInterval);
    }, [gameState.isPlaying, gameState.isPaused, gameState.currentStage, spawnMeteorite]);

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

    // Efecto para mostrar mensajes de estado solo cuando cambian
    useEffect(() => {
        if (gameState.isPlaying && !gameState.isPaused) {
            if (gameState.isPenalized && gameState.penaltyTime > 0) {
                // Mostrar mensaje de recarga directamente sin timeout
                setGameState(prev => ({
                    ...prev,
                    centralMessage: `Recalibrando... ${gameState.penaltyTime}s`,
                    showCentralMessage: true
                }));
            }
        }
    }, [gameState.penaltyTime, gameState.isPenalized, gameState.isPlaying, gameState.isPaused]);

    // Efecto para mostrar mensaje de listo al inicio del juego
    useEffect(() => {
        if (gameState.isPlaying && !gameState.isPaused && !gameState.isPenalized && 
            !gameState.showCentralMessage && gameState.score === 0 && 
            gameState.fallingLetters.length === 0) {
            showCentralMessage('¡Listo para disparar!', 2000);
        }
    }, [gameState.isPlaying, gameState.isPaused, gameState.isPenalized, gameState.showCentralMessage, gameState.score, gameState.fallingLetters.length, showCentralMessage]);

    // Efecto para ocultar mensaje central cuando el usuario interactúa
    useEffect(() => {
        if (gameState.pressedKey && gameState.showCentralMessage) {
            setGameState(prev => ({ ...prev, showCentralMessage: false, centralMessage: '' }));
        }
    }, [gameState.pressedKey, gameState.showCentralMessage]);

    // Efecto para manejar la música de fondo durante el juego
    useEffect(() => {
        if (gameState.isPlaying && !gameState.isPaused) {
            if (!isMuted) {
                // Solo iniciar si no está sonando ya
                startBackgroundMusic();
            } else {
                stopBackgroundMusic();
            }
        } else {
            // Detener música cuando el juego no está activo
            stopBackgroundMusic();
        }
    }, [gameState.isPlaying, gameState.isPaused, isMuted, startBackgroundMusic, stopBackgroundMusic]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!gameState.isPlaying || gameState.isPenalized) return;
            
            // Manejar pausa con Escape o P
            if (event.key === 'Escape') {
                event.preventDefault();
                setGameState(prev => ({
                    ...prev,
                    isPaused: !prev.isPaused
                }));
                return;
            }
            
            if (gameState.isPaused) return; // No procesar otras teclas si está pausado
            
            const key = event.key.toUpperCase();
            if (LETTERS.includes(key)) {
                setGameState(prev => ({ ...prev, pressedKey: key }));
                shootBullet(key);
            } else if (event.code === 'Space') {
                event.preventDefault(); // Prevenir scroll de la página
                activateForceField();
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            const key = event.key.toUpperCase();
            if (LETTERS.includes(key)) {
                setGameState(prev => ({ ...prev, pressedKey: null }));
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState.isPlaying, gameState.isPenalized, gameState.isPaused, shootBullet, activateForceField]);

    // Efecto para mostrar mensaje de pausa
    useEffect(() => {
        if (gameState.isPlaying && gameState.isPaused) {
            setGameState(prev => ({
                ...prev,
                showCentralMessage: true,
                centralMessage: 'PAUSADO - Presiona ESC para continuar'
            }));
        } else if (gameState.isPlaying && !gameState.isPaused && gameState.centralMessage === 'PAUSADO - Presiona ESC para continuar') {
            setGameState(prev => ({
                ...prev,
                showCentralMessage: false,
                centralMessage: null
            }));
        }
    }, [gameState.isPaused, gameState.isPlaying]);

    return (
        <div className="game-container">
            <div className="bg-grid"></div>
            
            {/* Botón de sonido */}
            <SoundToggle isMuted={isMuted} onToggle={toggleMute} />
            
            {/* Mapas de manos */}
            {gameState.isPlaying && (
                <div className="hand-maps-container">
                    <HandMap side="left" highlightedKey={gameState.pressedKey || undefined} />
                    <HandMap side="right" highlightedKey={gameState.pressedKey || undefined} />
                </div>
            )}
            
            {/* Mensaje central */}
            <CentralMessage 
                message={gameState.centralMessage}
                countdown={gameState.countdown}
                show={gameState.showCentralMessage}
            />
            
            <HUD
                score={gameState.score}
                lives={gameState.lives}
                isPenalized={gameState.isPenalized}
                stage={TYPING_STAGES[gameState.currentStage]}
                forceField={gameState.forceField}
            />

            <div className="game-area" ref={gameAreaRef} style={{ 
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <Cannon isReloading={gameState.isPenalized} angle={cannonAngle} />
                
                {/* Punto de debug para el centro del cañón */}
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: '150px', // Coincide con el CSS del cañón
                    width: '8px',
                    height: '8px',
                    background: '#ff0000',
                    borderRadius: '50%',
                    transform: 'translate(-50%, 50%)',
                    zIndex: 15,
                    pointerEvents: 'none'
                }} />
                
                {/* Campo de fuerza */}
                {gameState.forceField?.isActive && (
                    <div
                        className="force-field"
                        style={{
                            position: 'absolute',
                            left: '50%',
                            bottom: '150px', // Alineado exactamente con el cañón
                            transform: 'translate(-50%, 50%)',
                            width: `${FORCE_FIELD_RADIUS * 2}px`,
                            height: `${FORCE_FIELD_RADIUS * 2}px`,
                            borderRadius: '50%',
                            border: '3px solid #00ffff',
                            background: 'radial-gradient(circle, rgba(0, 255, 255, 0.1) 0%, rgba(0, 255, 255, 0.05) 50%, transparent 100%)',
                            boxShadow: '0 0 50px #00ffff, inset 0 0 50px rgba(0, 255, 255, 0.2)',
                            animation: 'forceFieldPulse 0.5s ease-in-out infinite alternate',
                            pointerEvents: 'none',
                            zIndex: 10
                        }}
                    />
                )}
                
                {/* Meteoritos */}
                {gameState.meteorites.map(meteorite => (
                    <div
                        key={meteorite.id}
                        className="meteorite"
                        style={{
                            left: meteorite.x + 'px',
                            top: meteorite.y + 'px',
                            position: 'absolute',
                            width: meteorite.size + 'px',
                            height: meteorite.size + 'px',
                            background: 'radial-gradient(circle, #ff4500 0%, #8b0000 50%, #2f1b14 100%)',
                            borderRadius: '50%',
                            border: '2px solid #ff6600',
                            boxShadow: '0 0 20px #ff4500, inset 0 0 10px rgba(255, 69, 0, 0.5)',
                            transform: `rotate(${meteorite.rotation}deg)`,
                            zIndex: 5,
                            pointerEvents: 'none'
                        }}
                    >
                        {/* Punto central para debug de colisiones */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: '4px',
                            height: '4px',
                            background: '#00ffff',
                            borderRadius: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 10
                        }} />
                        
                        {/* Detalles del meteorito */}
                        <div style={{
                            position: 'absolute',
                            top: '20%',
                            left: '30%',
                            width: '15%',
                            height: '15%',
                            background: '#2f1b14',
                            borderRadius: '50%'
                        }} />
                        <div style={{
                            position: 'absolute',
                            top: '60%',
                            left: '70%',
                            width: '10%',
                            height: '10%',
                            background: '#2f1b14',
                            borderRadius: '50%'
                        }} />
                        <div style={{
                            position: 'absolute',
                            top: '40%',
                            left: '15%',
                            width: '8%',
                            height: '8%',
                            background: '#2f1b14',
                            borderRadius: '50%'
                        }} />
                    </div>
                ))}
                
                {/* Letras que caen */}
                {gameState.fallingLetters.map(letter => {
                    const row = getLetterRow(letter.letter);
                    const isHomeRow = row === 'home';
                    const letterImage = LETTER_IMAGES[letter.letter];
                    const isHighlighted = gameState.pressedKey === letter.letter;
                    
                    return (
                        <div
                            key={letter.id}
                            className={`falling-letter ${isHighlighted ? 'highlighted' : ''}`}
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
                            }}
                        >
                            {isHomeRow && letterImage ? (
                                <img 
                                    src={letterImage} 
                                    alt={letter.letter}
                                    style={{
                                        width: '45px',
                                        height: '45px',
                                        objectFit: 'contain',
                                        filter: `drop-shadow(0 0 8px ${LETTER_COLORS[letter.letter] || '#00ffff'})`
                                    }}
                                />
                            ) : (
                                letter.letter
                            )}
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