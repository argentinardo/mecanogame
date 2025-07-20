import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Cannon } from './Cannon';
import { HUD } from './HUD';
import { Instructions } from './Instructions';
import { GameOver } from './GameOver';
import { HandMap } from './HandMap';
import { CentralMessage } from './CentralMessage';
import { MissileLetterComponent } from './MissileLetterComponent';
import { Starfield } from './Starfield';
import { useAudio } from '../hooks/useAudio';
import type { GameState, FallingLetter } from '../types/game';
import { TYPING_STAGES, KEYBOARD_POSITIONS } from '../types/game';
import asteroid1 from '../assets/images/asteroid-01_40px.png';
import asteroid2 from '../assets/images/asteroid-02-40px.png';
import asteroid3 from '../assets/images/asteroid-03_40px.png';



const LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ0123456789'.split('');
const MAX_LETTERS_ON_SCREEN = 10000;
const INITIAL_LETTER_SPEED = 0.9; // Igual que sector 1
const INITIAL_GAME_SPEED = 2100; // Igual que sector 1

// Constantes para la progresión de dificultad
const SPEED_INCREMENT = 0.05; // Incremento más pequeño de velocidad
const GAME_SPEED_DECREMENT = 50; // Reducción más gradual del tiempo entre letras
const MIN_GAME_SPEED = 800; // Velocidad mínima entre letras

// Umbrales de letras destruidas para cada nivel
const LETTERS_DESTROYED_THRESHOLDS = [
    50,    // Sector 1
    150,   // Sector 2
    300,   // Sector 3
    500,   // Sector 4
    750,   // Sector 5
    1000,  // Sector 6
    1300,  // Sector 7
    1600,  // Sector 8
    2000,  // Sector 9
    2500   // Sector 10
];

// Constantes de tamaños para colisiones precisas
const LETTER_SIZE = 72;          // Tamaño de las letras que caen
const CANNON_RADIUS = 50;        // Radio de colisión del cañón (punto rojo de debug)
const FORCE_FIELD_RADIUS = 200;  // Radio del campo de fuerza protector





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

    const asteroidImgs = [asteroid1, asteroid2, asteroid3];

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
    
    // Estado para el ángulo del cañón
    const [cannonAngle, setCannonAngle] = useState<number>(0);
    // Ref para mantener el último ángulo aplicado y calcular el camino más corto
    const lastAngleRef = useRef<number>(0);

    // Función helper para actualizar el ángulo evitando sobre giros (elige camino corto)
    const updateCannonAngle = useCallback((rawAngle: number) => {
        const last = lastAngleRef.current;
        let target = rawAngle;
        const delta = target - last;
        if (delta > 180) {
            target -= 360;
        } else if (delta < -180) {
            target += 360;
        }
        lastAngleRef.current = target;
        setCannonAngle(target);
    }, []);
    
    // Estado para detectar si estamos en móvil
    const [isMobile, setIsMobile] = useState<boolean>(false);
    
    // Estado para animar explosión/caída de la nave
    const [isCannonExploding, setIsCannonExploding] = useState<boolean>(false);
    const [isCannonSpawning, setIsCannonSpawning] = useState<boolean>(true);
    const [showKeyboardPrompt, setShowKeyboardPrompt] = useState<boolean>(false);
    const keyboardPromptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Referencia para controlar el beep de proximidad
    const lastProximityBeepRef = useRef<number>(0);
    const proximityBeepIntervalRef = useRef<number | undefined>(undefined);

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
        
        // Obtener las coordenadas del centro de la nave (pivote)
        const { x: cannonX, y: cannonY } = getCannonCenterCoordinates();
        const gameArea = gameAreaRef.current?.getBoundingClientRect();
        if (!gameArea) return;

        // Posición objetivo (centro de la letra)
        const targetX = targetLetterObj.x + (LETTER_SIZE / 2);
        const targetY = targetLetterObj.y + (LETTER_SIZE / 2);
        
        // Calcular la longitud y ángulo del rayo usando coordenadas relativas
        const deltaX = targetX - cannonX;
        const deltaY = targetY - cannonY;
        const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        
        // Ajustar el ángulo para que el cañón apunte correctamente
        // El cañón necesita rotar 270 grados (90 + 180) en sentido horario para alinearse
        const adjustedAngle = angle - 270;
        
        // Actualizar el ángulo del cañón usando camino corto
        updateCannonAngle(adjustedAngle);
        
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
        laser.style.position = 'absolute'; // Cambiar a absolute para posicionamiento relativo al game-area
        laser.style.left = `${cannonX}px`; // Usar coordenadas relativas al game-area
        laser.style.top = `${cannonY - 2}px`; // Ajustar para centrar verticalmente
        laser.style.width = `${length}px`;
        laser.style.height = '4px';
        laser.style.background = '#ff0000';
        laser.style.boxShadow = '0 0 15px #ff0000, 0 0 30px #ff0000';
        laser.style.transformOrigin = '0 2px'; // Centrar verticalmente el láser
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
        
        // Resetear el ángulo del cañón después de un tiempo
        setTimeout(() => {
            updateCannonAngle(0);
        }, 500);
    }, [gameState.isPenalized, gameState.forceField, gameState.fallingLetters, playShootSound, updateCannonAngle]);

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
            const newLettersDestroyed = prev.lettersDestroyed + 1;
            const currentThreshold = LETTERS_DESTROYED_THRESHOLDS[prev.currentStage] || LETTERS_DESTROYED_THRESHOLDS[LETTERS_DESTROYED_THRESHOLDS.length - 1];
            const shouldIncreaseDifficulty = newLettersDestroyed >= currentThreshold;
            const newGameSpeed = shouldIncreaseDifficulty 
                ? Math.max(MIN_GAME_SPEED, prev.gameSpeed - GAME_SPEED_DECREMENT)
                : prev.gameSpeed;
            const newLetterSpeed = shouldIncreaseDifficulty 
                ? prev.letterSpeed + SPEED_INCREMENT
                : prev.letterSpeed;
            
            return {
                ...prev,
                score: newScore,
                lettersDestroyed: newLettersDestroyed,
                gameSpeed: newGameSpeed,
                letterSpeed: newLetterSpeed,
                fallingLetters: prev.fallingLetters.filter(l => l.id !== letterObj.id)
            };
        });

        // Llamar advanceStage basado en letras destruidas
        const currentLetters = gameState.lettersDestroyed + 1;
        const currentThreshold2 = LETTERS_DESTROYED_THRESHOLDS[gameState.currentStage] || LETTERS_DESTROYED_THRESHOLDS[LETTERS_DESTROYED_THRESHOLDS.length - 1];
        if (currentLetters >= currentThreshold2 && 
            gameState.currentStage + 1 < TYPING_STAGES.length) {
            // Usar setTimeout para evitar problemas de estado
            setTimeout(() => advanceStage(), 0);
        }
    }, [playExplosionSound, createVisualExplosion, gameState.isPaused, gameState.fallingLetters, lastHitTime, sequentialHits, playComboSuccessSound, playMeteoriteSound, gameState.lettersDestroyed, gameState.currentStage, advanceStage]);

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

    // Función para detectar proximidad de letras (60% de la altura)
    const checkProximityWarning = useCallback(() => {
        if (!gameState.isPlaying || gameState.isPaused || gameState.isPenalized) return;
        
        const gameArea = gameAreaRef.current;
        if (!gameArea) return;
        
        const gameAreaHeight = gameArea.offsetHeight;
        const dangerThreshold = gameAreaHeight * 0.6; // 60% de la altura - zona de peligro
        
        // Verificar si hay letras en la zona de peligro (60% o más abajo)
        const lettersInDangerZone = gameState.fallingLetters.filter(letter => 
            letter.y >= dangerThreshold
        );
        
        // Si hay letras en la zona de peligro, mantener beep continuo
        if (lettersInDangerZone.length > 0) {
            if (!proximityBeepIntervalRef.current) {
                // Iniciar beep inmediatamente
                playProximityBeep();
                lastProximityBeepRef.current = Date.now();
                
                // Configurar beep continuo cada 500ms
                proximityBeepIntervalRef.current = window.setInterval(() => {
                    if (gameState.isPlaying && !gameState.isPaused && !gameState.isPenalized && !isMuted) {
                        playProximityBeep();
                    }
                }, 500);
            }
        } else {
            // Solo detener el beep si NO hay letras en la zona de peligro
            if (proximityBeepIntervalRef.current) {
                clearInterval(proximityBeepIntervalRef.current);
                proximityBeepIntervalRef.current = undefined;
            }
        }
    }, [gameState.isPlaying, gameState.isPaused, gameState.isPenalized, gameState.fallingLetters, playProximityBeep, isMuted]);

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
            centralMessage: `Recalibrando... ${countdown}s\n(Presiona BACKSPACE para saltear)`
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
                    centralMessage: `Recalibrando... ${countdown}s\n(Presiona BACKSPACE para saltear)`
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
        
        // Intentar obtener la posición exacta del centro del elemento .cannon en pantalla
        const cannonEl = document.querySelector('.cannon') as HTMLElement | null;
        if (cannonEl) {
            const cannonRect = cannonEl.getBoundingClientRect();
            const centerX = cannonRect.left - gameAreaRect.left + cannonRect.width / 2;
            const centerY = cannonRect.top - gameAreaRect.top + cannonRect.height / 2;
            return { x: centerX, y: centerY };
        }

        // Fallback: usar proporción aproximada
        const cannonX = gameAreaRect.width / 2;
        const cannonY = gameAreaRect.height * 0.7; // coincide con top 70%
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

        // Ocultar teclado virtual en móvil al terminar
        if (isMobile && navigator.virtualKeyboard) {
            navigator.virtualKeyboard.hide();
        }
    }, [playGameOverSound, stopBackgroundMusic, isMobile]);

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

        // Activar animación de explosión de la nave
        setIsCannonExploding(true);
        setTimeout(() => setIsCannonExploding(false), 1200);
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
        const minSize = 50; // Tamaño mínimo ampliado
        const maxSize = 70; // Tamaño máximo ampliado
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
            // Detener beep de proximidad cuando se pausa
            if (proximityBeepIntervalRef.current) {
                clearInterval(proximityBeepIntervalRef.current);
                proximityBeepIntervalRef.current = undefined;
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

    // Efecto para detectar si estamos en móvil
    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent.toLowerCase();
            const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
            const isSmallScreen = window.innerWidth <= 768;
            
            setIsMobile(isMobileDevice || isSmallScreen);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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
                    
                    // Detener el beep de proximidad cuando se pierde una vida
                    if (proximityBeepIntervalRef.current) {
                        clearInterval(proximityBeepIntervalRef.current);
                        proximityBeepIntervalRef.current = undefined;
                    }
                    
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
            
            // Verificar proximidad de letras para el beep de advertencia
            checkProximityWarning();
            
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
    }, [gameState.isPlaying, gameState.isPaused, endGame, startLifeLostCountdown, checkMeteoriteCollisions, checkMeteoriteCannonCollisions, checkProximityWarning]);

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
            if (proximityBeepIntervalRef.current) {
                clearInterval(proximityBeepIntervalRef.current);
                proximityBeepIntervalRef.current = undefined;
            }
        };
    }, []);

    // Efecto para mostrar mensajes de estado solo cuando cambian
    // Comentado porque el mensaje de recalibración se maneja directamente en handleMiss
    // useEffect(() => {
    //     if (gameState.isPlaying && !gameState.isPaused) {
    //         if (gameState.isPenalized && gameState.penaltyTime > 0) {
    //             // Solo actualizar el mensaje si no hay uno visible
    //             if (!gameState.showCentralMessage) {
    //                 setGameState(prev => ({
    //                     ...prev,
    //                     centralMessage: `Recalibrando... ${gameState.penaltyTime}s`,
    //                     showCentralMessage: true
    //                 }));
    //             }
    //         }
    //     }
    // }, [gameState.penaltyTime, gameState.isPenalized, gameState.isPlaying, gameState.isPaused, gameState.showCentralMessage]);

    // Efecto para mostrar mensaje de listo al inicio del juego
    useEffect(() => {
        if (gameState.isPlaying && !gameState.isPaused && !gameState.isPenalized && 
            !gameState.showCentralMessage && gameState.score === 0 && 
            gameState.fallingLetters.length === 0) {
            showCentralMessage('¡PAOLO prepárate para disparar!', 2000);
        }
    }, [gameState.isPlaying, gameState.isPaused, gameState.isPenalized, gameState.showCentralMessage, gameState.score, gameState.fallingLetters.length, showCentralMessage]);

    // Efecto para ocultar mensaje central cuando el usuario interactúa
    // No ocultar durante penalización para que se vea el mensaje de recalibración
    useEffect(() => {
        if (gameState.pressedKey && gameState.showCentralMessage && !gameState.isPenalized) {
            setGameState(prev => ({ ...prev, showCentralMessage: false, centralMessage: '' }));
        }
    }, [gameState.pressedKey, gameState.showCentralMessage, gameState.isPenalized]);

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

    // Efecto para manejar el beep de proximidad cuando cambia el estado de mute
    useEffect(() => {
        if (isMuted && proximityBeepIntervalRef.current) {
            // Si se activa el mute, detener el beep inmediatamente
            clearInterval(proximityBeepIntervalRef.current);
            proximityBeepIntervalRef.current = undefined;
        } else if (!isMuted && !proximityBeepIntervalRef.current) {
            // Si se desactiva el mute y no hay intervalo activo, verificar si hay letras en peligro
            const gameArea = gameAreaRef.current;
            if (gameArea && gameState.isPlaying && !gameState.isPaused && !gameState.isPenalized) {
                const gameAreaHeight = gameArea.offsetHeight;
                const dangerThreshold = gameAreaHeight * 0.6;
                const lettersInDangerZone = gameState.fallingLetters.filter(letter => 
                    letter.y >= dangerThreshold
                );
                
                if (lettersInDangerZone.length > 0) {
                    // Reiniciar el beep si hay letras en peligro
                    playProximityBeep();
                    proximityBeepIntervalRef.current = window.setInterval(() => {
                        if (gameState.isPlaying && !gameState.isPaused && !gameState.isPenalized && !isMuted) {
                            playProximityBeep();
                        }
                    }, 500);
                }
            }
        }
    }, [isMuted, gameState.isPlaying, gameState.isPaused, gameState.isPenalized, gameState.fallingLetters, playProximityBeep]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!gameState.isPlaying) return;
            
            // Manejar BACKSPACE durante penalización
            if (gameState.isPenalized && event.key === 'Backspace') {
                event.preventDefault();
                // Saltar la penalización
                setGameState(prev => ({
                    ...prev,
                    isPenalized: false,
                    penaltyTime: 0,
                    showCentralMessage: false,
                    centralMessage: null
                }));
                restoreBackgroundVolume();
                return;
            }
            
            // No procesar otras teclas si está penalizado
            if (gameState.isPenalized) return;
            
            // Manejar pausa con Escape
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

        // Event listeners para teclado físico y virtual
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        
        // En móvil, también escuchar eventos de input para el teclado virtual
        if (isMobile) {
            const handleInput = (event: Event) => {
                if (!gameState.isPlaying || gameState.isPenalized || gameState.isPaused) return;
                
                const inputEvent = event as InputEvent;
                const input = inputEvent.data;
                if (input && LETTERS.includes(input.toUpperCase())) {
                    const key = input.toUpperCase();
                    setGameState(prev => ({ ...prev, pressedKey: key }));
                    shootBullet(key);
                }
            };
            
            document.addEventListener('input', handleInput);
            
            return () => {
                document.removeEventListener('keydown', handleKeyDown);
                document.removeEventListener('keyup', handleKeyUp);
                document.removeEventListener('input', handleInput);
            };
        }
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState.isPlaying, gameState.isPenalized, gameState.isPaused, shootBullet, activateForceField, isMobile]);

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
        initAudioContext();

        if (isMobile && navigator.virtualKeyboard) {
            navigator.virtualKeyboard.show();
        }

        setGameState(prev => ({
            ...prev,
            isPlaying: true,
            score: 0,
            lives: 3,
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
        }));

        // Mostrar teclado virtual en móvil
        if (isMobile && navigator.virtualKeyboard) {
            navigator.virtualKeyboard.show();
        }

        setIsCannonSpawning(true);
        setTimeout(() => setIsCannonSpawning(false), 1000);

        // Programar prompt de teclado si es móvil
        if (isMobile) {
            if (keyboardPromptTimeoutRef.current) window.clearTimeout(keyboardPromptTimeoutRef.current);
            keyboardPromptTimeoutRef.current = window.setTimeout(() => setShowKeyboardPrompt(true), 2000) as unknown as number;
        }
    }, [initAudioContext, isMobile]);

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

        setIsCannonSpawning(true);
        setTimeout(() => setIsCannonSpawning(false), 1000);

        // Programar prompt de teclado si es móvil
        if (isMobile) {
            if (keyboardPromptTimeoutRef.current) window.clearTimeout(keyboardPromptTimeoutRef.current);
            keyboardPromptTimeoutRef.current = window.setTimeout(() => setShowKeyboardPrompt(true), 2000) as unknown as number;
        }
    }, [initAudioContext, isMobile]);

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

        setIsCannonSpawning(true);
        setTimeout(() => setIsCannonSpawning(false), 1000);

        // Programar prompt de teclado si es móvil
        if (isMobile) {
            if (keyboardPromptTimeoutRef.current) window.clearTimeout(keyboardPromptTimeoutRef.current);
            keyboardPromptTimeoutRef.current = window.setTimeout(() => setShowKeyboardPrompt(true), 2000) as unknown as number;
        }
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

    // Detección de móvil al montar el componente
    useEffect(() => {
        const checkMobile = () => {
            const isMobileDevice = /Mobi|Android/i.test(navigator.userAgent);
            setIsMobile(isMobileDevice);
        };
        checkMobile();
    }, []);

    // Ref para input oculto en móvil
    const mobileInputRef = useRef<HTMLInputElement | null>(null);

    // Mantener foco en el input oculto para teclado virtual móvil
    useEffect(() => {
        if (isMobile && mobileInputRef.current) {
            const inputEl = mobileInputRef.current;
            inputEl.focus();

            const handleBlur = () => {
                // Reenfocar tras perder el foco
                inputEl.focus();
            };
            inputEl.addEventListener('blur', handleBlur);
            return () => inputEl.removeEventListener('blur', handleBlur);
        }
    }, [isMobile]);

    // Lista de letras actualmente visibles (para iluminación sutil en los dedos)
    const subtleKeys = useMemo(() => {
        const unique = new Set<string>();
        gameState.fallingLetters.forEach(l => unique.add(l.letter));
        return Array.from(unique);
    }, [gameState.fallingLetters]);

    // Mantener el teclado virtual visible en móvil reforzando el foco periódicamente
    useEffect(() => {
        if (isMobile && gameState.isPlaying) {
            const interval = setInterval(() => {
                mobileInputRef.current?.focus();
            }, 1500);
            return () => clearInterval(interval);
        }
    }, [isMobile, gameState.isPlaying]);

    // Escuchar toques/clics para garantizar que el teclado aparezca si el usuario interactúa
    useEffect(() => {
        if (!isMobile) return;

        const forceFocus = () => {
            if (gameState.isPlaying) {
                mobileInputRef.current?.focus();
            }
        };

        document.addEventListener('touchstart', forceFocus);
        document.addEventListener('click', forceFocus);
        return () => {
            document.removeEventListener('touchstart', forceFocus);
            document.removeEventListener('click', forceFocus);
        };
    }, [isMobile, gameState.isPlaying]);

    const handleKeyboardPromptTap = () => {
        mobileInputRef.current?.focus();
        setShowKeyboardPrompt(false);
        if (keyboardPromptTimeoutRef.current) window.clearTimeout(keyboardPromptTimeoutRef.current);
    };

    return (
        <div className="game-container">
            <Starfield />
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
                            subtleKeys={subtleKeys}
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
                            subtleKeys={subtleKeys}
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
                    subtleKeys={subtleKeys}
                />
                <HandMap 
                    side="right" 
                    highlightedKey={gameState.pressedKey || undefined} 
                    isSpacePressed={isSpacePressed}
                    subtleKeys={subtleKeys}
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

            <div 
                ref={gameAreaRef} 
                className={`game-area ${isMobile ? 'is-mobile' : ''}`} 
                style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    display: 'flex',
                    justifyContent: 'center'
                }}>
                {/* Línea de horizonte */}
                <div className="horizon-line" />

                <Cannon 
                    isReloading={gameState.isPenalized} 
                    angle={cannonAngle} 
                    isExploding={isCannonExploding} 
                    isSpawning={isCannonSpawning} 
                />

                {/* Campo de fuerza rojo */}
                {gameState.forceField?.isActive && (
                    <div
                        key={`force-field-${gameState.forceField.startTime}`}
                        className="force-field"
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            width: `${FORCE_FIELD_RADIUS * 2}px`,
                            height: `${FORCE_FIELD_RADIUS * 2}px`,
                            borderRadius: '50%',
                            border: '4px solid #ff0040',
                            background: 'radial-gradient(circle, rgba(255, 0, 64, 0.25) 0%, rgba(128, 0, 32, 0.15) 50%, transparent 100%)',
                            boxShadow: '0 0 80px #ff0040, inset 0 0 60px rgba(255, 0, 64, 0.35)',
                            pointerEvents: 'none',
                            zIndex: 5
                        }}
                    />
                )}

                {/* Meteoritos */}
                {gameState.meteorites.map(meteorite => (
                    <img
                        key={meteorite.id}
                        src={asteroidImgs[Math.floor(meteorite.id) % asteroidImgs.length]}
                        className="meteorite"
                        style={{
                            position: 'absolute',
                            left: meteorite.x + 'px',
                            top: meteorite.y + 'px',
                            width: meteorite.size + 'px',
                            height: meteorite.size + 'px',
                            transform: `translate(-50%, -50%) rotate(${meteorite.rotation}deg)`,
                            pointerEvents: 'none',
                            zIndex: 4
                        }}
                        alt="m"
                    />
                ))}

                {/* Letras */}
                {gameState.fallingLetters.map(letter => {
                    const isHighlighted = gameState.pressedKey === letter.letter;
                    return (
                        <MissileLetterComponent
                            key={letter.id}
                            letter={letter.letter}
                            x={letter.x}
                            y={letter.y}
                            isHighlighted={isHighlighted}
                        />
                    );
                })}
            </div> {/* cierre de game-area */}

            {/* Overlay para activar teclado virtual en móvil */}
            {showKeyboardPrompt && isMobile && gameState.isPlaying && (
                <div className="keyboard-prompt-overlay" onClick={handleKeyboardPromptTap}>
                    <div className="keyboard-prompt-message">Toca aquí para activar el teclado virtual</div>
                </div>
            )}

            {/* Pantalla de instrucciones */}
            {!gameState.isPlaying && gameState.lives > 0 && (
                <Instructions 
                    onStart={startGame} 
                    onContinue={continueGame}
                    showContinue={gameState.score > 0}
                />
            )}

            {isMobile && (
                <input
                    ref={mobileInputRef}
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck="false"
                    placeholder="Escribe aquí..."
                    maxLength={1}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        pointerEvents: 'none'
                    }}
                />
            )}

            {/* Pantalla de Game Over */}
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

export default Game;