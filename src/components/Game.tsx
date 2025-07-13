import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Cannon } from './Cannon';
import { HUD } from './HUD';
import { Instructions } from './Instructions';
import { GameOver } from './GameOver';
import { HandMap } from './HandMap';
import { CentralMessage } from './CentralMessage';
import { MissileLetterComponent } from './MissileLetterComponent';
import { useAudio } from '../hooks/useAudio';
import type { GameState, FallingLetter } from '../types/game';
import { TYPING_STAGES, KEYBOARD_POSITIONS } from '../types/game';



const LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
const MAX_LETTERS_ON_SCREEN = 10000;
const INITIAL_LETTER_SPEED = 0.4;
const INITIAL_GAME_SPEED = 2200;

// Constantes para la progresión de dificultad
const SPEED_INCREMENT = 0.05; // Incremento más pequeño de velocidad
const GAME_SPEED_DECREMENT = 50; // Reducción más gradual del tiempo entre letras
const MIN_GAME_SPEED = 800; // Velocidad mínima entre letras

// Umbrales de puntuación para cada nivel
const SCORE_THRESHOLDS = [
    75,    // Sector 1
    175,   // Sector 2
    500,   // Sector 3
    1500,   // Sector 4
    3000,   // Sector 5
    5000,  // Sector 6
    7000,  // Sector 7
    9500,  // Sector 8
    20000,  // Sector 9
    30000, // Sector 10
    40000  // Juego completado
];

// Constantes de tamaños para colisiones precisas
const LETTER_SIZE = 72;          // Tamaño de las letras que caen
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



export const Game: React.FC = () => {
    const {
        playShootSound,
        playExplosionSound,
        playMissSound,
        playLifeLostSound,
        playGameOverSound,
        playLevelUpSound,
        playComboSuccessSound,
        playMeteoriteSound,
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
        fallingLetters: [],
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
    const [comboMultiplier, setComboMultiplier] = useState<number>(1);
    const [sequentialHits, setSequentialHits] = useState<number>(0);
    
    // Estados separados para los mensajes de combo
    const [currentComboMessage, setCurrentComboMessage] = useState<string | null>(null);
    const [isComboMessageVisible, setIsComboMessageVisible] = useState<boolean>(false);
    
    // Estados separados para los mensajes de orden perfecto
    const [currentOrderMessage, setCurrentOrderMessage] = useState<string | null>(null);
    const [isOrderMessageVisible, setIsOrderMessageVisible] = useState<boolean>(false);
    
    // Estado para manejar la tecla especial (barra espaciadora)
    const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);

    const gameAreaRef = useRef<HTMLDivElement>(null);
    const gameLoopRef = useRef<number | undefined>(undefined);
    const spawnIntervalRef = useRef<number | undefined>(undefined);
    const lastSpawnTimeRef = useRef<number>(0);
    const lastSpawnedLetterRef = useRef<string | null>(null);
    const comboTimeoutRef = useRef<number | undefined>(undefined);

    // Referencia para controlar las partículas activas
    const activeParticlesRef = useRef<HTMLDivElement[]>([]);

    // Referencias para acceder al estado actual sin dependencias
    const gameStateRef = useRef(gameState);
    gameStateRef.current = gameState;

    // Estado para las explosiones

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
        const currentGameState = gameStateRef.current;

        if (!currentGameState.isPlaying || currentGameState.isPaused) {
            return;
        }

        const now = Date.now();
        if (now - lastSpawnTimeRef.current < currentGameState.gameSpeed) {
            return;
        }

        if (currentGameState.fallingLetters.length >= MAX_LETTERS_ON_SCREEN) {
            return;
        }

        // Verificar que currentStage esté dentro de los límites válidos
        if (currentGameState.currentStage < 0 || currentGameState.currentStage >= TYPING_STAGES.length) {
            console.warn('Índice de etapa inválido:', currentGameState.currentStage);
            return;
        }

        const currentStage = TYPING_STAGES[currentGameState.currentStage];
        if (!currentStage || !currentStage.letters || currentStage.letters.length === 0) {
            console.warn('No hay letras disponibles para la etapa actual', currentStage);
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
        const isPositionOccupied = currentGameState.fallingLetters.some(
            existingLetter => Math.abs(existingLetter.x - x) < 60 // 60 es el ancho de la letra
        );

        if (isPositionOccupied) {
            // Si la posición está ocupada, salir y esperar al siguiente ciclo
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
    }, [getLetterPosition]); // Solo getLetterPosition como dependencia

    const shootBullet = useCallback((targetLetter: string) => {
        if (gameState.isPenalized || gameState.isPaused) return;
        
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
        
        // Aplicar retroceso temporal al cañón en dirección opuesta al disparo
        const cannonElement = document.querySelector('.cannon') as HTMLElement;
        if (cannonElement) {
            // Calcular el retroceso en dirección opuesta al láser
            const recoilIntensity = 8; // Intensidad del retroceso
            const recoilAngle = Math.atan2(deltaY, deltaX) + Math.PI; // Dirección opuesta
            const recoilX = Math.cos(recoilAngle) * recoilIntensity;
            const recoilY = Math.sin(recoilAngle) * recoilIntensity;
            
            cannonElement.style.transform = `translateX(calc(-50% + ${recoilX}px)) translateY(${recoilY}px)`;
            cannonElement.style.transition = 'transform 0.05s ease-out';
            
            // Restaurar posición normal después del retroceso
            setTimeout(() => {
                cannonElement.style.transform = `translateX(-50%) translateY(0px)`;
                cannonElement.style.transition = 'transform 0.15s ease-in-out';
            }, 80);
        }
        
        // Restablecer el ángulo del cañón después del disparo con animación rápida

        
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
    }, [gameState.isPenalized, gameState.forceField, gameState.fallingLetters, playShootSound]);

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
            
            // Mostrar el cartel de sector y pausar el juego
            const timeout = setTimeout(() => {
                setGameState(prev => ({
                    ...prev,
                    showSectorInfo: false,
                    isPaused: false,
                    sectorInfoTimeout: null
                }));
            }, nextStage === 0 ? 5000 : 15000); // 5 segundos para Sector 0, 15 segundos para los demás

            return {
                ...prev,
                currentStage: nextStage,
                gameSpeed: Math.max(INITIAL_GAME_SPEED - (nextStage * 100), MIN_GAME_SPEED),
                letterSpeed: INITIAL_LETTER_SPEED + (nextStage * 0.5),
                showSectorInfo: true,
                isPaused: true,
                sectorInfoTimeout: timeout,
                showCentralMessage: false // Ocultar el mensaje de pausa original
            };
        });
    }, [playLevelUpSound]);

    // Función para mostrar mensaje de combo independiente
    const displayComboMessage = useCallback((message: string, duration: number = 2000) => {
        setCurrentComboMessage(message);
        setIsComboMessageVisible(true);

        setTimeout(() => {
            setIsComboMessageVisible(false);
            setTimeout(() => {
                setCurrentComboMessage(null);
            }, 300); // Tiempo extra para la animación de salida
        }, duration);
    }, []);

    // Función para mostrar mensaje de orden perfecto independiente
    const displayOrderMessage = useCallback((message: string, duration: number = 2000) => {
        setCurrentOrderMessage(message);
        setIsOrderMessageVisible(true);

        setTimeout(() => {
            setIsOrderMessageVisible(false);
            setTimeout(() => {
                setCurrentOrderMessage(null);
            }, 300); // Tiempo extra para la animación de salida
        }, duration);
    }, []);

    // Función para crear efectos visuales de explosión
    const createVisualExplosion = useCallback((x: number, y: number) => {
        // Limpiar partículas viejas si hay demasiadas
        if (activeParticlesRef.current.length > 30) {
            const oldParticles = activeParticlesRef.current.splice(0, 15);
            oldParticles.forEach(particle => {
                if (particle.parentNode) {
                    particle.remove();
                }
            });
        }

        // Solo crear onda de choque circular (más eficiente)
        createShockWave(x, y);
        
        // Reducir efectos para mejor rendimiento
        createNeonSparks(x, y, 8); // Reducido de 12 a 8
        createGlowParticles(x, y, 5); // Reducido de 8 a 5
        // Eliminar arcos eléctricos y anillos para optimizar
    }, []);

    const hitLetter = useCallback((letterObj: FallingLetter) => {
        // No procesar hits durante la pausa
        if (gameState.isPaused) return;
        
        const gameArea = gameAreaRef.current?.getBoundingClientRect();
        if (!gameArea) return;

        // Calcular las coordenadas absolutas del centro de la letra
        const explosionX = gameArea.left + letterObj.x + (LETTER_SIZE / 2);
        const explosionY = gameArea.top + letterObj.y + (LETTER_SIZE / 2);
        
        // Reproducir sonido de explosión
        playExplosionSound();
        
        // Crear explosión visual
        createVisualExplosion(explosionX, explosionY);
        
        // Eliminar la letra inmediatamente
        setGameState(prev => ({
            ...prev,
            fallingLetters: prev.fallingLetters.filter(l => l.id !== letterObj.id)
        }));
        
        // Verificar si es un hit secuencial (la letra más antigua)
        const isSequentialHit = gameState.fallingLetters.length > 0 && 
            gameState.fallingLetters.reduce((oldest, current) => 
                current.id < oldest.id ? current : oldest
            ).id === letterObj.id;
        
        // Sistema de combos
        const currentTime = Date.now();
        const timeSinceLastHit = currentTime - lastHitTime;
        
        let newComboCount: number;
        let newSequentialHits = sequentialHits;
        
        if (timeSinceLastHit <= 1200 && lastHitTime > 0) {
            // Continuar combo
            newComboCount = comboCount + 1;
            setComboCount(newComboCount);
            
            // Actualizar hits secuenciales
            if (isSequentialHit) {
                newSequentialHits = sequentialHits + 1;
                setSequentialHits(newSequentialHits);
            } else {
                newSequentialHits = 0;
                setSequentialHits(0);
            }
            
            // Mostrar combo inmediatamente si es 3 o más
            if (newComboCount >= 3) {
                let adjective = '';
                if (newComboCount >= 15) adjective = 'ULTRA';
                else if (newComboCount >= 12) adjective = 'MEGA';
                else if (newComboCount >= 8) adjective = 'SUPER';
                else if (newComboCount >= 6) adjective = 'AWESOME';
                else if (newComboCount >= 4) adjective = 'GREAT';
                else if (newComboCount >= 3) adjective = 'GOOD';
                
                // Reproducir sonido de combo
                playComboSuccessSound();
                
                // Mostrar mensaje inmediatamente
                const message = `${adjective} COMBO ${newComboCount}! x${comboMultiplier}`;
                displayComboMessage(message, 1500);
            }
        } else {
            // Iniciar nuevo combo
            newComboCount = 1;
            setComboCount(newComboCount);
            
            // Resetear hits secuenciales
            if (isSequentialHit) {
                newSequentialHits = 1;
                setSequentialHits(1);
            } else {
                newSequentialHits = 0;
                setSequentialHits(0);
            }
        }
        
        // Calcular multiplicador de combo
        let currentMultiplier = 1;
        if (newComboCount >= 15) currentMultiplier = 4;
        else if (newComboCount >= 10) currentMultiplier = 3;
        else if (newComboCount >= 6) currentMultiplier = 2.5;
        else if (newComboCount >= 3) currentMultiplier = 2;
        else if (newComboCount >= 2) currentMultiplier = 1.5;
        
        setComboMultiplier(currentMultiplier);
        
        // Calcular bonus por orden secuencial
        let sequentialBonus = 0;
        if (newSequentialHits >= 5) sequentialBonus = 50;
        else if (newSequentialHits >= 3) sequentialBonus = 20;
        else if (newSequentialHits >= 2) sequentialBonus = 10;
        
        // Calcular puntaje final
        const baseScore = 10;
        const comboScore = Math.floor(baseScore * currentMultiplier);
        const totalScore = comboScore + sequentialBonus;
        
        // Mostrar mensaje de bonus secuencial si aplica
        if (sequentialBonus > 0) {
            setTimeout(() => {
                const message = `ORDEN PERFECTO +${sequentialBonus}!`;
                displayOrderMessage(message, 1500);
            }, 500);
        }
        
        setLastHitTime(currentTime);
        
        setGameState(prev => {
            // No incrementar velocidades si el juego está pausado
            if (prev.isPaused) {
                return {
                    ...prev,
                    score: prev.score + totalScore,
                    fallingLetters: prev.fallingLetters.filter(l => l.id !== letterObj.id)
                };
            }
            
            const newScore = prev.score + totalScore;
            const currentThreshold = SCORE_THRESHOLDS[prev.currentStage] || SCORE_THRESHOLDS[SCORE_THRESHOLDS.length - 1];
            const shouldIncreaseDifficulty = newScore >= currentThreshold;
            const newGameSpeed = shouldIncreaseDifficulty 
                ? Math.max(MIN_GAME_SPEED, prev.gameSpeed - GAME_SPEED_DECREMENT)
                : prev.gameSpeed;
            const newLetterSpeed = shouldIncreaseDifficulty 
                ? prev.letterSpeed + SPEED_INCREMENT
                : prev.letterSpeed;
            
            return {
                ...prev,
                score: newScore,
                gameSpeed: newGameSpeed,
                letterSpeed: newLetterSpeed,
                fallingLetters: prev.fallingLetters.filter(l => l.id !== letterObj.id)
            };
        });

        // Llamar advanceStage solo si realmente necesitamos avanzar
        const currentScore = gameState.score + totalScore;
        const currentThreshold = SCORE_THRESHOLDS[gameState.currentStage] || SCORE_THRESHOLDS[SCORE_THRESHOLDS.length - 1];
        if (currentScore >= currentThreshold && 
            gameState.currentStage + 1 < TYPING_STAGES.length) {
            // Usar setTimeout para evitar problemas de estado
            setTimeout(() => advanceStage(), 0);
        }
    }, [playExplosionSound, createVisualExplosion, gameState.isPaused, gameState.fallingLetters, lastHitTime, sequentialHits, playComboSuccessSound, playMeteoriteSound, gameState.score, gameState.currentStage, advanceStage]);

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

    // Función para resetear combo
    const resetCombo = useCallback(() => {
        // Limpiar timeout pendiente
        if (comboTimeoutRef.current) {
            clearTimeout(comboTimeoutRef.current);
            comboTimeoutRef.current = undefined;
        }
        
        setComboCount(0);
        setLastHitTime(0);
        setComboMultiplier(1);
        setSequentialHits(0);
    }, [setComboCount, setLastHitTime, setComboMultiplier, setSequentialHits]);

    const handleMiss = useCallback(() => {
        // Reproducir sonido de fallo
        playMissSound();
        
        // Resetear combo al fallar
        resetCombo();
        
        // Bajar el volumen de la música durante el recalibrado
        lowerBackgroundVolume();
        
        let countdown = 3;
        
        // Mostrar el mensaje inicial y mantenerlo visible
        setGameState(prev => ({
            ...prev,
            isPenalized: true,
            penaltyTime: countdown,
            showCentralMessage: true,
            centralMessage: `Recalibrando... ${countdown}s`
        }));

        // Programar sonidos en las transiciones
        setTimeout(() => playCountdownSound(2), 1000); // Suena al pasar de 3 a 2
        setTimeout(() => playCountdownSound(1), 2000); // Suena al pasar de 2 a 1
        setTimeout(() => playCountdownSound(0), 3000); // Suena al desaparecer el mensaje

        const penaltyInterval = setInterval(() => {
            countdown--;
            
            if (countdown > 0) {
                setGameState(prev => ({
                    ...prev,
                    penaltyTime: countdown,
                    centralMessage: `Recalibrando... ${countdown}s`
                }));
            } else {
                // Cuando llegue a 0, limpiar todo y restaurar el volumen
                clearInterval(penaltyInterval);
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
    }, [playMissSound, resetCombo, lowerBackgroundVolume, restoreBackgroundVolume, playCountdownSound]);

    // Crear onda de choque expansiva (simplificada)
    const createShockWave = (x: number, y: number) => {
        const shockWave = document.createElement('div');
        shockWave.className = 'neon-shock-wave';
        shockWave.style.position = 'fixed';
        shockWave.style.left = `${x}px`;
        shockWave.style.top = `${y}px`;
        shockWave.style.width = '10px';
        shockWave.style.height = '10px';
        shockWave.style.border = '3px solid #00ffff';
        shockWave.style.borderRadius = '50%';
        shockWave.style.transform = 'translate(-50%, -50%)';
        shockWave.style.zIndex = '15';
        shockWave.style.pointerEvents = 'none';
        shockWave.style.boxShadow = '0 0 20px #00ffff, inset 0 0 20px #00ffff';
        document.body.appendChild(shockWave);
        
        activeParticlesRef.current.push(shockWave);
        
        let scale = 1;
        let opacity = 1;
        const shockInterval = setInterval(() => {
            scale += 0.6; // Reducido de 0.8 a 0.6
            opacity -= 0.08; // Más rápido para liberar recursos
            
            shockWave.style.transform = `translate(-50%, -50%) scale(${scale})`;
            shockWave.style.opacity = String(opacity);
            shockWave.style.borderColor = `rgba(0, 255, 255, ${opacity})`;
            shockWave.style.boxShadow = `0 0 ${15 * scale}px rgba(0, 255, 255, ${opacity})`;
            
            if (opacity <= 0) {
                clearInterval(shockInterval);
                const index = activeParticlesRef.current.indexOf(shockWave);
                if (index > -1) {
                    activeParticlesRef.current.splice(index, 1);
                }
                shockWave.remove();
            }
        }, 16);
    };

    // Crear chispas neon principales (optimizadas)
    const createNeonSparks = (x: number, y: number, count: number) => {
        for (let i = 0; i < count; i++) {
            const spark = document.createElement('div');
            spark.className = 'neon-spark';
            
            // Colores neon vibrantes (reducidos)
            const colors = [
                '#00ffff', '#ff0080', '#ffff00', '#00ff00'
            ];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            const size = Math.random() * 6 + 4; // Reducido de 8+6 a 6+4
            
            spark.style.position = 'fixed';
            spark.style.left = `${x}px`;
            spark.style.top = `${y}px`;
            spark.style.width = `${size}px`;
            spark.style.height = `${size}px`;
            spark.style.background = `radial-gradient(circle, ${color} 0%, transparent 70%)`;
            spark.style.borderRadius = '50%';
            spark.style.transform = 'translate(-50%, -50%)';
            spark.style.zIndex = '10';
            spark.style.pointerEvents = 'none';
            spark.style.boxShadow = `0 0 ${size * 2}px ${color}`;
            document.body.appendChild(spark);
            
            activeParticlesRef.current.push(spark);
            
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 10 + 6; // Reducido
            const vx = Math.cos(angle) * speed;
            let vy = Math.sin(angle) * speed;
            const gravity = 0.3;
            
            let px = x, py = y;
            let opacity = 1;
            
            const sparkInterval = setInterval(() => {
                px += vx;
                vy += gravity;
                py += vy;
                
                opacity -= 0.04; // Más rápido
                
                spark.style.left = `${px}px`;
                spark.style.top = `${py}px`;
                spark.style.opacity = String(opacity);
                
                if (opacity <= 0 || py > window.innerHeight) {
                    clearInterval(sparkInterval);
                    const index = activeParticlesRef.current.indexOf(spark);
                    if (index > -1) {
                        activeParticlesRef.current.splice(index, 1);
                    }
                    spark.remove();
                }
            }, 16);
        }
    };

    // Crear partículas brillantes con estela (simplificadas)
    const createGlowParticles = (x: number, y: number, count: number) => {
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'glow-particle';
            
            const colors = ['#ffffff', '#ffff00', '#00ffff'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            particle.style.position = 'fixed';
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            particle.style.width = '4px';
            particle.style.height = '4px';
            particle.style.background = color;
            particle.style.borderRadius = '50%';
            particle.style.transform = 'translate(-50%, -50%)';
            particle.style.zIndex = '8';
            particle.style.pointerEvents = 'none';
            particle.style.boxShadow = `0 0 10px ${color}`;
            document.body.appendChild(particle);
            
            activeParticlesRef.current.push(particle);
            
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 12 + 8;
            const vx = Math.cos(angle) * speed;
            let vy = Math.sin(angle) * speed;
            const gravity = 0.2;
            
            let px = x, py = y;
            let opacity = 1;
            
            const particleInterval = setInterval(() => {
                px += vx;
                vy += gravity;
                py += vy;
                
                opacity -= 0.05; // Más rápido
                
                particle.style.left = `${px}px`;
                particle.style.top = `${py}px`;
                particle.style.opacity = String(opacity);
                
                if (opacity <= 0 || py > window.innerHeight) {
                    clearInterval(particleInterval);
                    const index = activeParticlesRef.current.indexOf(particle);
                    if (index > -1) {
                        activeParticlesRef.current.splice(index, 1);
                    }
                    particle.remove();
                }
            }, 16);
        }
    };



    // Crear onda de choque específica para meteoritos (simplificada)
    const createMeteoriteShockWave = useCallback((x: number, y: number) => {
        const shockWave = document.createElement('div');
        shockWave.className = 'meteorite-shock-wave';
        shockWave.style.position = 'fixed';
        shockWave.style.left = `${x}px`;
        shockWave.style.top = `${y}px`;
        document.body.appendChild(shockWave);

        setTimeout(() => {
            shockWave.remove();
        }, 500);
    }, []);

        // Función para crear partículas de meteorito mejoradas (simplificadas)
        const createMeteoriteParticles = useCallback((x: number, y: number) => {
            // Crear onda de choque específica para meteoritos
            createMeteoriteShockWave(x, y);
            
            // Crear menos partículas de fuego para optimizar
            for (let i = 0; i < 8; i++) { // Reducido de 15 a 8
                const particle = document.createElement('div');
                particle.className = 'meteorite-neon-particle';
                
                // Colores de fuego con efectos neon (reducidos)
                const colors = [
                    '#ff4500', '#ff6600', '#ffff00', '#ff0000'
                ];
                const color = colors[Math.floor(Math.random() * colors.length)];
                
                const size = Math.random() * 8 + 6; // Reducido de 10+8 a 8+6
                
                particle.style.position = 'fixed';
                particle.style.left = `${x}px`;
                particle.style.top = `${y}px`;
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.background = `radial-gradient(circle, ${color} 0%, transparent 70%)`;
                particle.style.borderRadius = '50%';
                particle.style.transform = 'translate(-50%, -50%)';
                particle.style.zIndex = '100';
                particle.style.pointerEvents = 'none';
                particle.style.boxShadow = `0 0 ${size * 2}px ${color}`;
                document.body.appendChild(particle);
                
                activeParticlesRef.current.push(particle);
                
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 12 + 6;
                const vx = Math.cos(angle) * speed;
                let vy = Math.sin(angle) * speed;
                const gravity = 0.35;
                
                let px = x, py = y;
                let opacity = 1;
                
                const particleInterval = setInterval(() => {
                    px += vx;
                    vy += gravity;
                    py += vy;
                    
                    opacity -= 0.04; // Más rápido
                    
                    particle.style.left = `${px}px`;
                    particle.style.top = `${py}px`;
                    particle.style.opacity = String(opacity);
                    
                    if (opacity <= 0 || py > window.innerHeight) {
                        clearInterval(particleInterval);
                        const index = activeParticlesRef.current.indexOf(particle);
                        if (index > -1) {
                            activeParticlesRef.current.splice(index, 1);
                        }
                        particle.remove();
                    }
                }, 16);
            }
        }, [createMeteoriteShockWave]);

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

    const endGame = useCallback(() => {
        // Reproducir sonido de game over
        playGameOverSound();
        
        // Detener música de fondo
        stopBackgroundMusic();
        
        // Limpiar todos los timeouts e intervalos cuando el juego termina
        if (spawnIntervalRef.current) {
            clearInterval(spawnIntervalRef.current);
            spawnIntervalRef.current = undefined;
        }
        if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
            gameLoopRef.current = undefined;
        }
        if (comboTimeoutRef.current) {
            clearTimeout(comboTimeoutRef.current);
            comboTimeoutRef.current = undefined;
        }
        
        setGameState(prev => ({
            ...prev,
            isPlaying: false,
            fallingLetters: [], // Limpiar letras al terminar el juego
            meteorites: [], // Limpiar meteoritos al terminar el juego
            isPaused: false
        }));
    }, [playGameOverSound, stopBackgroundMusic]);

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

        // Programar sonidos en las transiciones
        setTimeout(() => playCountdownSound(2), 1000); // Suena al pasar de 3 a 2
        setTimeout(() => playCountdownSound(1), 2000); // Suena al pasar de 2 a 1
        setTimeout(() => playCountdownSound(0), 3000); // Suena al desaparecer el mensaje

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
    }, [showCentralMessage, playLifeLostSound, playCountdownSound]);

    // Función para generar meteoritos
    const spawnMeteorite = useCallback(() => {
        const currentGameState = gameStateRef.current;
        if (!currentGameState.isPlaying || currentGameState.isPaused) return;
        
        // Solo generar meteoritos a partir de la tercera etapa
        if (currentGameState.currentStage < 2) return;

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

        // Velocidad aumentada significativamente
        const baseSpeed = 2.0; // Aumentado de 1.0 a 2.0 
        const speedVariation = 0.8; // Aumentado de 0.4 a 0.8
        const speed = baseSpeed + (Math.random() * speedVariation);
        
        // Normalizar la dirección y aplicar velocidad
        const speedX = (deltaX / distance) * speed;
        const speedY = (deltaY / distance) * speed;

        // Tamaño más pequeño para coincidir con la cola
        const minSize = 25; // Reducido de 40 a 25
        const maxSize = 35; // Reducido de 60 a 35
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
    }, [getCannonCenterCoordinates, playMeteoriteSound]);

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
        const currentGameState = gameStateRef.current;
        if (!currentGameState.forceField?.isActive) return;

        setGameState(prev => {
            const destroyedMeteoriteIds: number[] = [];
            const { x: cannonX, y: cannonY } = getCannonCenterCoordinates();
            const forceFieldRadius = FORCE_FIELD_RADIUS; // 200px
            
            prev.meteorites.forEach(meteorite => {
                // Calcular la posición del meteorito en el extremo delantero
                const fireAngle = Math.atan2(-meteorite.speedY, -meteorite.speedX) * (180 / Math.PI);
                const meteoriteOffsetDistance = 40;
                const meteoriteOffsetX = Math.cos((fireAngle + 180) * Math.PI / 180) * meteoriteOffsetDistance;
                const meteoriteOffsetY = Math.sin((fireAngle + 180) * Math.PI / 180) * meteoriteOffsetDistance;
                
                // Calcular el centro exacto del meteorito basado en su posición relativa
                const meteoriteCenterX = meteorite.x + meteoriteOffsetX + (meteorite.size / 2);
                const meteoriteCenterY = meteorite.y + meteoriteOffsetY + (meteorite.size / 2);
                
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
                        createMeteoriteParticles(explosionX, explosionY);
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
    }, [getCannonCenterCoordinates, createMeteoriteParticles, playExplosionSound]);

    // Función para verificar colisiones entre meteoritos y el cañón
    const checkMeteoriteCannonCollisions = useCallback(() => {
        const { x: cannonX, y: cannonY } = getCannonCenterCoordinates();
        const cannonRadius = CANNON_RADIUS; // 50px

        setGameState(prev => {
            const hitMeteoriteIds: number[] = [];
            
            prev.meteorites.forEach(meteorite => {
                // Calcular la posición del meteorito en el extremo delantero
                const fireAngle = Math.atan2(-meteorite.speedY, -meteorite.speedX) * (180 / Math.PI);
                const meteoriteOffsetDistance = 40;
                const meteoriteOffsetX = Math.cos((fireAngle + 180) * Math.PI / 180) * meteoriteOffsetDistance;
                const meteoriteOffsetY = Math.sin((fireAngle + 180) * Math.PI / 180) * meteoriteOffsetDistance;
                
                // Calcular el centro exacto del meteorito basado en su posición relativa
                const meteoriteCenterX = meteorite.x + meteoriteOffsetX + (meteorite.size / 2);
                const meteoriteCenterY = meteorite.y + meteoriteOffsetY + (meteorite.size / 2);
                
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
                        // Calcular la posición del meteorito en el extremo delantero para la explosión
                        const fireAngle = Math.atan2(-meteorite.speedY, -meteorite.speedX) * (180 / Math.PI);
                        const meteoriteOffsetDistance = 40;
                        const meteoriteOffsetX = Math.cos((fireAngle + 180) * Math.PI / 180) * meteoriteOffsetDistance;
                        const meteoriteOffsetY = Math.sin((fireAngle + 180) * Math.PI / 180) * meteoriteOffsetDistance;
                        
                        const meteoriteCenterX = gameAreaRect.left + meteorite.x + meteoriteOffsetX + (meteorite.size / 2);
                        const meteoriteCenterY = gameAreaRect.top + meteorite.y + meteoriteOffsetY + (meteorite.size / 2);
                        createMeteoriteParticles(meteoriteCenterX, meteoriteCenterY);
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
    }, [getCannonCenterCoordinates, endGame, createMeteoriteParticles, playLifeLostSound, startLifeLostCountdown]);

    // Efecto para manejar el spawn de letras con setInterval
    useEffect(() => {
        if (!gameState.isPlaying || gameState.isPaused) {
            // Limpiar cualquier intervalo anterior
            if (spawnIntervalRef.current) {
                clearInterval(spawnIntervalRef.current);
                spawnIntervalRef.current = undefined;
            }
            return;
        }

        // Crear un nuevo intervalo para el spawn de letras
        const letterSpawnInterval = setInterval(() => {
            spawnLetters();
        }, 100); // Verificar cada 100ms si es hora de spawear una letra

        spawnIntervalRef.current = letterSpawnInterval;

        return () => {
            if (spawnIntervalRef.current) {
                clearInterval(spawnIntervalRef.current);
                spawnIntervalRef.current = undefined;
            }
        };
    }, [gameState.isPlaying, gameState.isPaused, spawnLetters]);

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
        const currentGameState = gameStateRef.current;
        if (!currentGameState.isPlaying || currentGameState.isPaused) return;
        
        // Solo generar meteoritos a partir de la tercera etapa
        if (currentGameState.currentStage < 2) return;

        // Calcular frecuencia y probabilidad basada en la etapa actual
        const baseFrequency = 3000; // Frecuencia base más lenta
        const baseProbability = 0.1; // Probabilidad base más baja
        
        // Incremento progresivo basado en la etapa (currentStage - 2 porque empezamos en la etapa 2)
        const stageProgression = Math.max(0, currentGameState.currentStage - 2);
        
        // Incremento adicional basado en el puntaje (cada 500 puntos)
        const scoreProgression = Math.floor(currentGameState.score / 500);
        
        // Calcular valores finales con límites
        const frequency = Math.max(800, baseFrequency - (stageProgression * 300) - (scoreProgression * 200));
        const probability = Math.min(0.7, baseProbability + (stageProgression * 0.08) + (scoreProgression * 0.05));

        const meteoriteInterval = setInterval(() => {
            const latestGameState = gameStateRef.current;
            if (latestGameState.isPlaying && !latestGameState.isPaused && Math.random() < probability) {
                spawnMeteorite();
            }
        }, frequency);

        return () => clearInterval(meteoriteInterval);
    }, [gameState.isPlaying, gameState.isPaused, gameState.currentStage, gameState.score, spawnMeteorite]);

    // Efecto de limpieza
    useEffect(() => {
        return () => {
            if (spawnIntervalRef.current) {
                clearInterval(spawnIntervalRef.current);
                spawnIntervalRef.current = undefined;
            }
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
                gameLoopRef.current = undefined;
            }
            if (comboTimeoutRef.current) {
                clearTimeout(comboTimeoutRef.current);
                comboTimeoutRef.current = undefined;
            }
        };
    }, []);

    // Efecto para mostrar mensajes de estado solo cuando cambian
    useEffect(() => {
        if (gameState.isPlaying && !gameState.isPaused) {
            if (gameState.isPenalized && gameState.penaltyTime > 0) {
                // Solo actualizar el mensaje si no hay uno visible
                if (!gameState.showCentralMessage) {
                    setGameState(prev => ({
                        ...prev,
                        centralMessage: `Recalibrando... ${gameState.penaltyTime}s`,
                        showCentralMessage: true
                    }));
                }
            }
        }
    }, [gameState.penaltyTime, gameState.isPenalized, gameState.isPlaying, gameState.isPaused, gameState.showCentralMessage]);

    // Efecto para mostrar mensaje de listo al inicio del juego
    useEffect(() => {
        if (gameState.isPlaying && !gameState.isPaused && !gameState.isPenalized && 
            !gameState.showCentralMessage && gameState.score === 0 && 
            gameState.fallingLetters.length === 0) {
            showCentralMessage('¡PAOLO prepárate para disparar!', 2000);
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
                setIsSpacePressed(true);
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

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState.isPlaying, gameState.isPenalized, gameState.isPaused, shootBullet, activateForceField]);

    // Efecto para mostrar mensaje de pausa
    useEffect(() => {
        if (gameState.isPlaying && gameState.isPaused && !gameState.showSectorInfo) {
            // Pausar todas las actividades del juego
            if (spawnIntervalRef.current) {
                clearInterval(spawnIntervalRef.current);
                spawnIntervalRef.current = undefined;
            }
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
                gameLoopRef.current = undefined;
            }
            
            setGameState(prev => ({
                ...prev,
                showCentralMessage: true,
                centralMessage: 'PAUSADO - Presiona ESC para continuar'
            }));
        } else if (gameState.isPlaying && !gameState.isPaused) {
            // Reanudar el juego solo si estaba pausado antes
            if (gameState.centralMessage === 'PAUSADO - Presiona ESC para continuar') {
                setGameState(prev => ({
                    ...prev,
                    showCentralMessage: false,
                    centralMessage: null
                }));
                
                // El spawn se reiniciará automáticamente por el efecto anterior
                // No necesitamos llamar spawnLetters() aquí
            }
        }
    }, [gameState.isPaused, gameState.isPlaying, gameState.showSectorInfo]);

    const startGame = useCallback(() => {
        if (spawnIntervalRef.current) {
            clearInterval(spawnIntervalRef.current);
        }
        if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
        }

        lastSpawnTimeRef.current = 0;

        // Solo inicializar contexto de audio, no iniciar música aquí
        initAudioContext();

        // Resetear completamente para nuevo juego
        setComboCount(0);
        setLastHitTime(0);
        setComboMultiplier(1);
        setSequentialHits(0);
        
        // Limpiar mensajes
        setCurrentComboMessage(null);
        setIsComboMessageVisible(false);
        setCurrentOrderMessage(null);
        setIsOrderMessageVisible(false);

        setGameState({
            score: 0, // Siempre empezar desde 0 en nuevo juego
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
    }, [initAudioContext, setComboCount, setLastHitTime, setComboMultiplier, setSequentialHits, setCurrentComboMessage, setIsComboMessageVisible, setCurrentOrderMessage, setIsOrderMessageVisible]);

    const continueGame = useCallback(() => {
        // Limpiar timeouts pendientes
        if (spawnIntervalRef.current) {
            clearInterval(spawnIntervalRef.current);
            spawnIntervalRef.current = undefined;
        }
        if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
            gameLoopRef.current = undefined;
        }
        if (comboTimeoutRef.current) {
            clearTimeout(comboTimeoutRef.current);
            comboTimeoutRef.current = undefined;
        }
        
        // Resetear referencias de spawn
        lastSpawnTimeRef.current = 0;
        lastSpawnedLetterRef.current = null;
        
        // Resetear estados de combo
        setComboCount(0);
        setLastHitTime(0);
        setComboMultiplier(1);
        setSequentialHits(0);
        
        // Limpiar mensajes
        setCurrentComboMessage(null);
        setIsComboMessageVisible(false);
        setCurrentOrderMessage(null);
        setIsOrderMessageVisible(false);
        
        // Inicializar contexto de audio
        initAudioContext();
        
        // Continuar desde donde se quedó, manteniendo el sector actual
        setGameState(prev => ({
            ...prev,
            lives: 3, // Restaurar vidas
            isPlaying: true,
            isPenalized: false,
            penaltyTime: 0,
            fallingLetters: [], // Limpiar letras en pantalla
            bullets: [],
            meteorites: [], // Limpiar meteoritos en pantalla
            forceField: null,
            pressedKey: null,
            centralMessage: null,
            showCentralMessage: false,
            countdown: null,
            isPaused: false,
            // Mantener el sector actual y ajustar velocidades según el sector
            currentStage: prev.currentStage,
            gameSpeed: Math.max(INITIAL_GAME_SPEED - (prev.currentStage * 100), MIN_GAME_SPEED),
            letterSpeed: INITIAL_LETTER_SPEED + (prev.currentStage * 0.5)
            // Mantener score solamente
        }));
    }, [initAudioContext]);

    const newGame = useCallback(() => {
        // Limpiar todos los timeouts e intervalos
        if (spawnIntervalRef.current) {
            clearInterval(spawnIntervalRef.current);
            spawnIntervalRef.current = undefined;
        }
        if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
            gameLoopRef.current = undefined;
        }
        if (comboTimeoutRef.current) {
            clearTimeout(comboTimeoutRef.current);
            comboTimeoutRef.current = undefined;
        }
        
        // Resetear completamente las referencias
        lastSpawnTimeRef.current = 0;
        lastSpawnedLetterRef.current = null;
        
        // Resetear estados de combo
        setComboCount(0);
        setLastHitTime(0);
        setComboMultiplier(1);
        setSequentialHits(0);
        
        // Limpiar mensajes
        setCurrentComboMessage(null);
        setIsComboMessageVisible(false);
        setCurrentOrderMessage(null);
        setIsOrderMessageVisible(false);
        
        // Detener música de fondo
        stopBackgroundMusic();
        
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
            gameSpeed: INITIAL_GAME_SPEED, // Resetear a velocidad inicial
            letterSpeed: INITIAL_LETTER_SPEED, // Resetear a velocidad inicial
            currentStage: 0, // Comenzar desde la primera etapa
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
    }, [initAudioContext, stopBackgroundMusic, setComboCount, setLastHitTime, setComboMultiplier, setSequentialHits, setCurrentComboMessage, setIsComboMessageVisible, setCurrentOrderMessage, setIsOrderMessageVisible]);

    // Agregar manejador de teclas para cerrar el cartel
    const handleKeyPress = useCallback((event: KeyboardEvent) => {
        if (gameState.showSectorInfo && (event.key === 'Enter' || event.key === 'Escape')) {
            // Limpiar el timeout existente
            if (gameState.sectorInfoTimeout) {
                clearTimeout(gameState.sectorInfoTimeout);
            }
            
            setGameState(prev => ({
                ...prev,
                showSectorInfo: false,
                isPaused: false,
                sectorInfoTimeout: null
            }));
        }
    }, [gameState.showSectorInfo, gameState.sectorInfoTimeout]);

    // Agregar y remover el event listener
    useEffect(() => {
        window.addEventListener('keydown', handleKeyPress);
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, [handleKeyPress]);

    return (
        <div className="game-container">
            <div className="bg-grid"></div>
            
            {/* Nueva estructura de UI integrada */}
            <div className="game-ui-container">
                {/* Panel superior con información de sector */}
                <div className="sector-info">
                    <div className="sector-panel">
                        <div className="sector-label">SECTOR</div>
                        <div className="sector-name">{TYPING_STAGES[gameState.currentStage]?.name || 'N/A'}</div>
                        <div className="sector-description">{TYPING_STAGES[gameState.currentStage]?.description || '---'}</div>
                    </div>
                </div>

                {/* Cartel grande de sector */}
                {gameState.showSectorInfo && (
                    <div className="sector-info-large">
                        <div className="sector-panel-large">
                            <div className="sector-label-large">NUEVO SECTOR</div>
                            <div className="sector-name-large">{TYPING_STAGES[gameState.currentStage]?.name || 'N/A'}</div>
                            <div className="sector-description-large">{TYPING_STAGES[gameState.currentStage]?.description || '---'}</div>
                        </div>
                    </div>
                )}

                {/* Mensajes de combo y orden - posicionados independientemente */}
                {isComboMessageVisible && currentComboMessage && (
                    <div className="floating-combo-message">
                        <div className="floating-combo-content">
                            {currentComboMessage}
                        </div>
                    </div>
                )}

                {isOrderMessageVisible && currentOrderMessage && (
                    <div className="floating-order-message">
                        <div className="floating-order-content">
                            {currentOrderMessage}
                        </div>
                    </div>
                )}

                {/* Panel de control inferior integrado con manos */}
                <div className="integrated-control-panel">
                    {/* Mano izquierda integrada */}
                    <div className="control-section left-section">
                        <HandMap 
                            side="left" 
                            highlightedKey={gameState.pressedKey || undefined} 
                            isSpacePressed={isSpacePressed}
                        />
                    </div>

                    {/* Panel central de instrumentos compacto */}
                    <div className="central-instruments">
                        <HUD
                            score={gameState.score}
                            lives={gameState.lives}
                            isMuted={isMuted}
                            onToggleMute={toggleMute}
                        />
                    </div>

                    {/* Mano derecha integrada */}
                    <div className="control-section right-section">
                        <HandMap 
                            side="right" 
                            highlightedKey={gameState.pressedKey || undefined} 
                            isSpacePressed={isSpacePressed}
                        />
                    </div>
                </div>
            </div>

            {/* Mapas de manos - mantener ocultos ahora que están integrados */}
            <div className="hand-maps-container" style={{ display: 'none' }}>
                <HandMap 
                    side="left" 
                    highlightedKey={gameState.pressedKey || undefined} 
                    isSpacePressed={isSpacePressed}
                />
                <HandMap 
                    side="right" 
                    highlightedKey={gameState.pressedKey || undefined} 
                    isSpacePressed={isSpacePressed}
                />
            </div>
            
            {/* Mensaje central */}
            <CentralMessage 
                message={gameState.centralMessage}
                countdown={gameState.countdown}
                show={gameState.showCentralMessage}
            />
            
            {/* HUD original - ahora comentado porque usamos la nueva estructura */}
            <div style={{ display: 'none' }}>
                <HUD
                    score={gameState.score}
                    lives={gameState.lives}
                    isMuted={isMuted}
                    onToggleMute={toggleMute}
                />
            </div>

            <div className="game-area" ref={gameAreaRef} style={{ 
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <Cannon isReloading={gameState.isPenalized} angle={0} />
                
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
                        key={`force-field-${gameState.forceField.startTime}`}
                        className="force-field"
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '80%', // Mismo nivel que el cañón
                            width: `${FORCE_FIELD_RADIUS * 2}px`,
                            height: `${FORCE_FIELD_RADIUS * 2}px`,
                            borderRadius: '50%',
                            border: '3px solid #ff0000',
                            background: 'radial-gradient(circle, rgba(255, 0, 0, 0.1) 0%, rgba(255, 0, 0, 0.05) 50%, transparent 100%)',
                            boxShadow: '0 0 50px #ff0000, inset 0 0 50px rgba(255, 0, 0, 0.2)',
                            pointerEvents: 'none',
                            zIndex: 5
                        }}
                    />
                )}
                
                {/* Meteoritos */}
                {gameState.meteorites.map(meteorite => {
                    // Calcular el ángulo de la cola de fuego (opuesta a la dirección del movimiento)
                    const fireAngle = Math.atan2(-meteorite.speedY, -meteorite.speedX) * (180 / Math.PI);
                    
                    // Calcular la posición del meteorito en el extremo delantero de la cola
                    const meteoriteOffsetDistance = 40; // Distancia desde el centro hacia el frente
                    const meteoriteOffsetX = Math.cos((fireAngle + 180) * Math.PI / 180) * meteoriteOffsetDistance;
                    const meteoriteOffsetY = Math.sin((fireAngle + 180) * Math.PI / 180) * meteoriteOffsetDistance;
                    
                    return (
                        <div key={meteorite.id}>
                            {/* Cola de fuego principal - simplificada */}
                            <div
                                style={{
                                    position: 'absolute',
                                    left: (meteorite.x + meteorite.size / 2) + 'px',
                                    top: (meteorite.y + meteorite.size / 2) + 'px',
                                    width: '100px', // Reducido de 120px
                                    height: '18px', // Reducido de 20px
                                    background: 'linear-gradient(90deg, transparent 0%, #ff4500 20%, #ff6600 40%, #ffa500 60%, #ffff00 80%, transparent 100%)',
                                    borderRadius: '9px',
                                    transform: `translate(-50%, -50%) rotate(${fireAngle}deg)`,
                                    transformOrigin: '50% 50%',
                                    boxShadow: '0 0 15px #ff4500', // Simplificado
                                    opacity: '0.9',
                                    zIndex: 3,
                                    pointerEvents: 'none'
                                }}
                            />
                            
                            {/* Cola de fuego secundaria - simplificada */}
                            <div
                                style={{
                                    position: 'absolute',
                                    left: (meteorite.x + meteorite.size / 2) + 'px',
                                    top: (meteorite.y + meteorite.size / 2) + 'px',
                                    width: '130px', // Reducido de 160px
                                    height: '28px', // Reducido de 35px
                                    background: 'linear-gradient(90deg, transparent 0%, rgba(255, 69, 0, 0.3) 30%, rgba(255, 165, 0, 0.4) 60%, transparent 100%)',
                                    borderRadius: '14px',
                                    transform: `translate(-50%, -50%) rotate(${fireAngle}deg)`,
                                    transformOrigin: '50% 50%',
                                    boxShadow: '0 0 20px rgba(255, 69, 0, 0.4)', // Simplificado
                                    opacity: '0.6',
                                    zIndex: 2,
                                    pointerEvents: 'none'
                                }}
                            />
                            
                            {/* Partículas de la cola - reducidas */}
                            {Array.from({ length: 5 }).map((_, i) => { // Reducido de 8 a 5
                                const distance = 25 + i * 12; // Ajustado
                                const offsetX = Math.cos((fireAngle * Math.PI) / 180) * distance;
                                const offsetY = Math.sin((fireAngle * Math.PI) / 180) * distance;
                                const size = 6 - i * 0.8; // Reducido
                                
                                return (
                                    <div
                                        key={`particle-${i}`}
                                        style={{
                                            position: 'absolute',
                                            left: (meteorite.x + meteorite.size / 2 + offsetX) + 'px',
                                            top: (meteorite.y + meteorite.size / 2 + offsetY) + 'px',
                                            width: size + 'px',
                                            height: size + 'px',
                                            background: i < 2 ? '#ffff00' : i < 3 ? '#ff6600' : '#ff4500',
                                            borderRadius: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            opacity: (1 - i * 0.15),
                                            boxShadow: `0 0 ${4 - i}px ${i < 2 ? '#ffff00' : i < 3 ? '#ff6600' : '#ff4500'}`, // Simplificado
                                            zIndex: 1,
                                            pointerEvents: 'none'
                                        }}
                                    />
                                );
                            })}
                            
                            {/* Meteorito principal - posicionado en el extremo delantero */}
                            <div
                                className="meteorite"
                                style={{
                                    left: (meteorite.x + meteoriteOffsetX) + 'px', // Posición en el extremo delantero
                                    top: (meteorite.y + meteoriteOffsetY) + 'px', // Posición en el extremo delantero
                                    position: 'absolute',
                                    width: meteorite.size + 'px',
                                    height: meteorite.size + 'px',
                                    background: 'radial-gradient(circle, #ff4500 0%, #8b0000 50%, #2f1b14 100%)',
                                    borderRadius: '50%',
                                    border: '2px solid #ff6600',
                                    boxShadow: '0 0 15px #ff4500', // Simplificado
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
                                
                                {/* Detalles del meteorito - reducidos */}
                                <div style={{
                                    position: 'absolute',
                                    top: '25%',
                                    left: '35%',
                                    width: '12%',
                                    height: '12%',
                                    background: '#2f1b14',
                                    borderRadius: '50%'
                                }} />
                                <div style={{
                                    position: 'absolute',
                                    top: '65%',
                                    left: '65%',
                                    width: '8%',
                                    height: '8%',
                                    background: '#2f1b14',
                                    borderRadius: '50%'
                                }} />
                            </div>
                        </div>
                    );
                })}
                
                {/* Letras que caen como misiles con estelas de fuego */}
                {gameState.fallingLetters.map(letter => {
                    const isHighlighted = gameState.pressedKey === letter.letter;
                    const color = LETTER_COLORS[letter.letter] || '#00ffff';
                    
                    return (
                        <MissileLetterComponent
                            key={letter.id}
                            letter={letter.letter}
                            x={letter.x}
                            y={letter.y}
                            isHighlighted={isHighlighted}
                            color={color}
                        />
                    );
                })}
            </div>

            {!gameState.isPlaying && gameState.lives > 0 && (
                <Instructions 
                    onStart={startGame} 
                    onContinue={continueGame}
                    showContinue={gameState.score > 0}
                />
            )}

            {!gameState.isPlaying && gameState.lives <= 0 && (
                <GameOver 
                    score={gameState.score} 
                    onContinue={continueGame}
                    onNewGame={newGame}
                />
            )}
        </div>
    );
}; 