import Phaser from 'phaser';
import { TYPING_STAGES, KEYBOARD_POSITIONS, type GameState, type FallingLetter } from '../types/game';

// Import assets
import naveImg from '../assets/images/nave.svg';
import enemyImg from '../assets/images/enemy.svg';
import enemyBImg from '../assets/images/enemy-b.svg';
import enemy2Img from '../assets/images/enemy_2.svg';
import enemy2BImg from '../assets/images/enemy_2b.svg';
import enemy3Img from '../assets/images/enemy_3.svg';
import enemy3BImg from '../assets/images/enemy_3b.svg';
import asteroid1Img from '../assets/images/asteroid-01_40px.png';
import asteroid2Img from '../assets/images/asteroid-02_40px.png';
import asteroid3Img from '../assets/images/asteroid-03_40px.png';
import asteroid4Img from '../assets/images/asteroid-04_40px.png';
import asteroid5Img from '../assets/images/asteroid-05_40px.png';
import asteroid6Img from '../assets/images/asteroid-06_40px.png';

import bossHeadImg from '../assets/images/centipede_head.svg';
import bossSegmentImg from '../assets/images/segmento.svg';
import bossSegmentEmptyImg from '../assets/images/segmento_empty.svg';

export interface GameSceneCallbacks {
    onScoreChange: (score: number) => void;
    onScoreUpdateOnly: (scoreToAdd: number) => void; // New callback for score only (no progression)
    onLivesChange: (lives: number) => void;
    onLetterHit: (letterObj: FallingLetter) => { points: number; totalScore: number };
    onLetterMiss: () => void;
    onLetterEscaped: () => void;
    onShipDestroyed: (reason?: string) => void; // New callback for ship destroyed by meteorite
    onWrongKey: () => void;
    onMeteoriteHit: () => void;
    onStageAdvance: (stage: number) => void;
    onGameOver: () => void;
    onProximityWarning: (hasWarning: boolean) => void;
    onCombo: (count: number, multiplier: number) => void;
    onSequentialBonus: (bonus: number) => void;
    onBossShot: () => void;
    onForceFieldHit: () => void;
    onSegmentExplosion: () => void;
    onBossSpawn: () => void;
    onBossMusicStart: () => void;
    onBossLaugh: () => void;
    onMassiveExplosion: () => void;
}

export class GameScene extends Phaser.Scene {
    private callbacks!: GameSceneCallbacks;
    private gameState!: GameState;
    private ship!: Phaser.GameObjects.Sprite;
    private shipAngle: number = 0;
    private shipAngleTween: Phaser.Tweens.Tween | null = null; // Tween para animar la inclinación

    // Groups
    private lettersGroup!: Phaser.GameObjects.Group;
    private meteoritesGroup!: Phaser.GameObjects.Group;
    private bossGroup!: Phaser.GameObjects.Group;
    private bossProjectilesGroup!: Phaser.GameObjects.Group;

    // Force Field
    private forceField!: Phaser.GameObjects.Arc | null;
    private forceFieldActive: boolean = false;
    private forceFieldDuration: number = 1000;
    private forceFieldStartTime: number = 0;
    private forceFieldPulseEvent: Phaser.Time.TimerEvent | null = null;

    // Spawning logic
    private lastSpawnTime: number = 0;
    private lastMeteoriteSpawnTime: number = 0;
    private meteoriteSpawnInterval: number = 4000; // Spawn meteorite every 4 seconds

    // Boss Snake
    private bossActive: boolean = false;
    private bossHead!: Phaser.GameObjects.Container;
    private bossSegments: Phaser.GameObjects.Container[] = [];
    private bossTrail: Array<{ x: number; y: number; rotation: number }> = [];
    private bossHealth: number = 0;
    private bossMaxHealth: number = 0;
    private bossPhase: number = 1; // 1, 2, or 3
    private bossAttackPattern: string = 'idle'; // 'idle', 'shooting', 'zigzag', 'dash'
    private bossAttackTimer: number = 0;
    private bossLastShotTime: number = 0;
    private bossWaveTime: number = 0;
    private previousStage: number = -1;
    private bossHasExited: boolean | null = null; // null = never spawned, true = exited after collision, false = needs to exit
    private bossDefeatedForCurrentStage: boolean = false; // Track if boss was defeated for current stage
    private lastSpawnedLetters: string[] = []; // Track last spawned letters to avoid duplicates

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { gameState: GameState; callbacks: GameSceneCallbacks }) {
        if (!data.gameState || !data.callbacks) {
            console.error('GameScene initialized without data!');
            return;
        }
        this.gameState = data.gameState;
        this.callbacks = data.callbacks;
    }

    preload() {
        this.load.image('nave', naveImg);
        this.load.image('enemy', enemyImg);
        this.load.image('enemy_b', enemyBImg);
        this.load.image('enemy_2', enemy2Img);
        this.load.image('enemy_2b', enemy2BImg);
        this.load.image('enemy_3', enemy3Img);
        this.load.image('enemy_3b', enemy3BImg);
        this.load.image('asteroid1', asteroid1Img);
        this.load.image('asteroid2', asteroid2Img);
        this.load.image('asteroid3', asteroid3Img);
        this.load.image('asteroid1', asteroid4Img);
        this.load.image('asteroid2', asteroid5Img);
        this.load.image('asteroid3', asteroid6Img);
        this.load.image('boss_head', bossHeadImg);
        this.load.image('boss_segment', bossSegmentImg);
        this.load.image('boss_segment_empty', bossSegmentEmptyImg);

        // Create particle texture programmatically (square)
        const graphics = this.make.graphics({ x: 0, y: 0 }, false);
        graphics.fillStyle(0xffff00, 1);
        graphics.fillRect(0, 0, 8, 8);
        graphics.generateTexture('particle', 8, 8);
    }

    create() {
        const { width, height } = this.scale;

        // Create Ship
        // Mobile check: width <= 800 (virtual resolution)
        const isMobile = width <= 800;
        const shipY = isMobile ? height * 0.9 : height - 200;

        this.ship = this.add.sprite(width / 2, shipY, 'nave');
        this.ship.setScale(0.2);
        this.ship.setDepth(10);

        // Create plasma thrusters on wings (neon style, positioned at bottom)
        const thrusterOffsetX = 13; // Distance from center to each wing
        const thrusterOffsetY = 40; // More to the bottom

        // Left thruster - with realistic physics and inertia
        const leftThruster = this.add.particles(
            this.ship.x - thrusterOffsetX,
            this.ship.y + thrusterOffsetY,
            'particle',
            {
                speed: { min: 150, max: 250 },
                scale: { start: 1.5, end: 0.3 },
                lifespan: { min: 300, max: 500 }, // Variable lifespan for more realism
                blendMode: 'ADD',
                frequency: 20, // Slightly more frequent for smoother effect
                tint: [0x00FFFF, 0x00FFAA, 0x66FFFF, 0x88FFFF], // Bright cyan/neon plasma colors with variation
                angle: { min: 85, max: 95 }, // Downward direction (will rotate with ship)
                alpha: { start: 1, end: 0 },
                quantity: 2,
                // Physics for realistic inertia
                gravityY: 50, // Gravity pulls particles down (realistic effect)
                bounce: 0, // No bouncing
                // Friction/acceleration for more realistic movement
                accelerationY: 0, // Will be set dynamically
                // Add some randomness for natural variation
                rotate: { min: 0, max: 360 },
                // Particles maintain their initial velocity (inertia is automatic in Phaser)
            }
        );
        leftThruster.setDepth(5);

        // Right thruster - with realistic physics and inertia
        const rightThruster = this.add.particles(
            this.ship.x + thrusterOffsetX,
            this.ship.y + thrusterOffsetY,
            'particle',
            {
                speed: { min: 150, max: 250 },
                scale: { start: 1.5, end: 0.3 },
                lifespan: { min: 300, max: 500 }, // Variable lifespan for more realism
                blendMode: 'ADD',
                frequency: 20, // Slightly more frequent for smoother effect
                tint: [0x00FFFF, 0x00FFAA, 0x66FFFF, 0x88FFFF], // Bright cyan/neon plasma colors with variation
                angle: { min: 85, max: 95 }, // Downward direction (will rotate with ship)
                alpha: { start: 1, end: 0 },
                quantity: 2,
                // Physics for realistic inertia
                gravityY: 50, // Gravity pulls particles down (realistic effect)
                bounce: 0, // No bouncing
                // Friction/acceleration for more realistic movement
                accelerationY: 0, // Will be set dynamically
                // Add some randomness for natural variation
                rotate: { min: 0, max: 360 },
                // Particles maintain their initial velocity (inertia is automatic in Phaser)
            }
        );
        rightThruster.setDepth(5);

        // Store thrusters for position updates
        (this.ship as any).leftThruster = leftThruster;
        (this.ship as any).rightThruster = rightThruster;
        (this.ship as any).thrusterOffsetX = thrusterOffsetX;
        (this.ship as any).thrusterOffsetY = thrusterOffsetY;

        // Groups
        this.lettersGroup = this.add.group();
        this.meteoritesGroup = this.add.group();
        this.bossGroup = this.add.group();
        this.bossProjectilesGroup = this.add.group();

        // Initialize force field (hidden)
        this.forceField = null;
        this.forceFieldActive = false;

        // Initialize force field (hidden)
        this.forceField = null;
        this.forceFieldActive = false;
    }

    update(time: number, delta: number) {
        // Safety check if init failed or not ready
        if (!this.gameState || !this.lettersGroup || !this.meteoritesGroup) return;

        // Update Ship Rotation and thruster positions (ALWAYS - even when paused)
        if (this.ship) {
            const rotation = Phaser.Math.DegToRad(this.shipAngle);
            this.ship.setRotation(rotation);

            // Update force field position if active
            if (this.forceFieldActive && this.forceField) {
                this.forceField.setPosition(this.ship.x, this.ship.y);

                // Check if duration expired
                if (this.time.now - this.forceFieldStartTime >= this.forceFieldDuration) {
                    this.deactivateForceField();
                }
            }

            // Update thruster positions and rotation to follow ship
            const thrusterOffsetX = (this.ship as any).thrusterOffsetX || 30;
            const thrusterOffsetY = (this.ship as any).thrusterOffsetY || 20;
            const leftThruster = (this.ship as any).leftThruster;
            const rightThruster = (this.ship as any).rightThruster;

            if (leftThruster) {
                // Calculate rotated position for left thruster
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                const localX = -thrusterOffsetX;
                const localY = thrusterOffsetY;
                const rotatedX = localX * cos - localY * sin;
                const rotatedY = localX * sin + localY * cos;

                leftThruster.setPosition(this.ship.x + rotatedX, this.ship.y + rotatedY);

                // Update particle physics based on ship angle
                // Thrusters emit opposite to ship direction (180° offset)
                // In Phaser: angles are in degrees, 0° = right, 90° = down, 180° = left, 270° = up
                // Calculate emit angle: opposite direction to ship
                let emitAngle = this.shipAngle + 180;
                // Normalize to 0-360 range
                while (emitAngle < 0) emitAngle += 360;
                while (emitAngle >= 360) emitAngle -= 360;

                // Debug: Log angle to verify it's changing
                // console.log('Ship angle:', this.shipAngle, 'Emit angle:', emitAngle);

                // Update emitter physics - access the emitter manager's emitters
                // this.add.particles() returns a ParticleEmitterManager, which contains emitters
                const emitterManager = leftThruster as any;
                if (emitterManager && emitterManager.emitters) {
                    // Get the first (and only) emitter from the manager
                    const emitterList = emitterManager.emitters.list;
                    if (emitterList && emitterList.length > 0) {
                        const particleEmitter = emitterList[0];

                        // Calculate speed adjustment based on ship angle for more realistic physics
                        const angleRad = Phaser.Math.DegToRad(this.shipAngle);
                        const verticalComponent = Math.abs(Math.sin(angleRad));
                        const baseSpeed = 200;
                        const speedVariation = 50;
                        const adjustedSpeed = baseSpeed + (speedVariation * verticalComponent);

                        // Calculate gravity component based on ship angle for realistic inertia
                        const gravityX = Math.sin(angleRad) * 30;
                        const gravityY = Math.cos(angleRad) * 50 + 50;

                        // CRITICAL: Update angle - particles must emit opposite to ship direction
                        // Try multiple methods to ensure the angle updates
                        try {
                            // Method 1: Direct setAngle call (preferred)
                            if (particleEmitter.setAngle) {
                                particleEmitter.setAngle({ min: emitAngle - 8, max: emitAngle + 8 });
                            }
                            // Method 2: Update config object directly
                            if (particleEmitter.config) {
                                particleEmitter.config.angle = { min: emitAngle - 8, max: emitAngle + 8 };
                            }
                            // Method 3: Use setConfig as fallback
                            if (particleEmitter.setConfig) {
                                particleEmitter.setConfig({ angle: { min: emitAngle - 8, max: emitAngle + 8 } });
                            }
                        } catch (e) {
                            console.warn('Error updating particle angle:', e, 'emitAngle:', emitAngle, 'shipAngle:', this.shipAngle);
                        }

                        // Update speed
                        try {
                            if (particleEmitter.setSpeed) {
                                particleEmitter.setSpeed(adjustedSpeed - 50, adjustedSpeed + 50);
                            } else if (particleEmitter.speed) {
                                particleEmitter.speed = { min: adjustedSpeed - 50, max: adjustedSpeed + 50 };
                            }
                        } catch (e) {
                            console.warn('Error updating particle speed:', e);
                        }

                        // Update gravity
                        try {
                            if (particleEmitter.setGravity) {
                                particleEmitter.setGravity(gravityX, gravityY);
                            } else if (particleEmitter.setGravityX && particleEmitter.setGravityY) {
                                particleEmitter.setGravityX(gravityX);
                                particleEmitter.setGravityY(gravityY);
                            } else if (particleEmitter.gravityX !== undefined) {
                                particleEmitter.gravityX = gravityX;
                                particleEmitter.gravityY = gravityY;
                            }
                        } catch (e) {
                            console.warn('Error updating particle gravity:', e);
                        }
                    }
                }
            }
            if (rightThruster) {
                // Calculate rotated position for right thruster
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                const localX = thrusterOffsetX;
                const localY = thrusterOffsetY;
                const rotatedX = localX * cos - localY * sin;
                const rotatedY = localX * sin + localY * cos;

                rightThruster.setPosition(this.ship.x + rotatedX, this.ship.y + rotatedY);

                // Update particle physics based on ship angle
                // Thrusters emit opposite to ship direction (180° offset)
                let emitAngle = this.shipAngle + 180;
                // Normalize to 0-360 range
                while (emitAngle < 0) emitAngle += 360;
                while (emitAngle >= 360) emitAngle -= 360;

                // Update emitter physics - access the emitter manager's emitters
                const emitterManager = rightThruster as any;
                if (emitterManager && emitterManager.emitters) {
                    // Get the first (and only) emitter from the manager
                    const emitterList = emitterManager.emitters.list;
                    if (emitterList && emitterList.length > 0) {
                        const particleEmitter = emitterList[0];

                        // Calculate speed adjustment based on ship angle for more realistic physics
                        const angleRad = Phaser.Math.DegToRad(this.shipAngle);
                        const verticalComponent = Math.abs(Math.sin(angleRad));
                        const baseSpeed = 200;
                        const speedVariation = 50;
                        const adjustedSpeed = baseSpeed + (speedVariation * verticalComponent);

                        // Calculate gravity component based on ship angle for realistic inertia
                        const gravityX = Math.sin(angleRad) * 30;
                        const gravityY = Math.cos(angleRad) * 50 + 50;

                        // CRITICAL: Update angle - particles must emit opposite to ship direction
                        // Try multiple methods to ensure the angle updates
                        try {
                            // Method 1: Direct setAngle call (preferred)
                            if (particleEmitter.setAngle) {
                                particleEmitter.setAngle({ min: emitAngle - 8, max: emitAngle + 8 });
                            }
                            // Method 2: Update config object directly
                            if (particleEmitter.config) {
                                particleEmitter.config.angle = { min: emitAngle - 8, max: emitAngle + 8 };
                            }
                            // Method 3: Use setConfig as fallback
                            if (particleEmitter.setConfig) {
                                particleEmitter.setConfig({ angle: { min: emitAngle - 8, max: emitAngle + 8 } });
                            }
                        } catch (e) {
                            console.warn('Error updating particle angle:', e, 'emitAngle:', emitAngle, 'shipAngle:', this.shipAngle);
                        }

                        // Update speed
                        try {
                            if (particleEmitter.setSpeed) {
                                particleEmitter.setSpeed(adjustedSpeed - 50, adjustedSpeed + 50);
                            } else if (particleEmitter.speed) {
                                particleEmitter.speed = { min: adjustedSpeed - 50, max: adjustedSpeed + 50 };
                            }
                        } catch (e) {
                            console.warn('Error updating particle speed:', e);
                        }

                        // Update gravity
                        try {
                            if (particleEmitter.setGravity) {
                                particleEmitter.setGravity(gravityX, gravityY);
                            } else if (particleEmitter.setGravityX && particleEmitter.setGravityY) {
                                particleEmitter.setGravityX(gravityX);
                                particleEmitter.setGravityY(gravityY);
                            } else if (particleEmitter.gravityX !== undefined) {
                                particleEmitter.gravityX = gravityX;
                                particleEmitter.gravityY = gravityY;
                            }
                        } catch (e) {
                            console.warn('Error updating particle gravity:', e);
                        }
                    }
                }
            }
        }

        // Update Letters with perspective movement (ALWAYS - except when life lost countdown)
        const height = this.scale.height;
        const dangerZone = height * 0.6;
        const turnaroundPoint = height * 0.55; // Point where enemies reach "front" and start rising (55%)
        let hasDanger = false;

        // Update Letters with perspective movement (Only when playing and not life lost paused)
        if (this.gameState.isPlaying && !this.gameState.isLifeLostPaused) {
            this.lettersGroup.getChildren().forEach((child: any) => {
                const letterContainer = child as Phaser.GameObjects.Container;
                if (!letterContainer.active) return;

                // Skip if letter has been hit
                if (letterContainer.getData('hit')) return;

                const speed = letterContainer.getData('speed');
                const phase = letterContainer.getData('phase');

                if (phase === 'approaching') {
                    // Phase 1: Move down (approaching from horizon) and scale up to 0.7
                    letterContainer.y += speed * (delta / 16.66);

                    // Scale from 0.1 to 0.7 as it approaches
                    const startY = height * 0.5;
                    const progress = (letterContainer.y - startY) / (turnaroundPoint - startY);
                    const currentScale = 0.1 + (progress * 0.6); // 0.1 -> 0.7
                    letterContainer.setScale(Math.min(currentScale, 0.7));

                    // Interpolate X position for perspective (from near center to target position)
                    const spawnX = letterContainer.getData('spawnX');
                    const targetX = letterContainer.getData('targetX');
                    if (spawnX !== undefined && targetX !== undefined) {
                        const currentX = spawnX + (progress * (targetX - spawnX));
                        letterContainer.x = currentX;
                    }

                    // Check if reached turnaround point
                    if (letterContainer.y >= turnaroundPoint) {
                        letterContainer.setData('phase', 'rising');
                        letterContainer.setData('risingStartY', letterContainer.y);
                    }

                    // Check danger zone during approach (only when playing)
                    if (!this.gameState.isPaused && !this.gameState.isPenalized && letterContainer.y > dangerZone) {
                        hasDanger = true;
                    }
                } else if (phase === 'rising') {
                    // Phase 2: Move up (rising toward player) and scale up to 1.0
                    letterContainer.y -= speed * (delta / 16.66);

                    // Scale from 0.7 to 1.0 as it rises
                    const risingStartY = letterContainer.getData('risingStartY') || turnaroundPoint;
                    const risingDistance = risingStartY - 0;
                    const risingProgress = (risingStartY - letterContainer.y) / risingDistance;
                    const currentScale = 0.7 + (risingProgress * 0.3); // 0.7 -> 1.0
                    letterContainer.setScale(Math.min(currentScale, 1.0));

                    // Letter escapes when it goes off the TOP of screen
                    if (letterContainer.y < 0) {
                        this.handleLetterEscaped(letterContainer);
                    }

                    // Danger zone is more critical when rising (only when playing)
                    if (!this.gameState.isPaused && !this.gameState.isPenalized) {
                        hasDanger = true;
                    }
                }
            });
        }

        // Update meteorites (Only when playing and not life lost paused)
        if (this.gameState.isPlaying && !this.gameState.isLifeLostPaused) {
            this.updateMeteorites(delta);
        }

        // Only check proximity warning when playing
        if (this.gameState.isPlaying && !this.gameState.isPaused && !this.gameState.isPenalized) {
            this.callbacks.onProximityWarning(hasDanger);
        }

        // Check if we should spawn boss (when threshold is reached but boss not active)
        // Boss spawns when lettersDestroyed reaches threshold for current stage
        // IMPORTANT: Boss must have completely exited screen before respawning (only if it collided before)
        // If bossHasExited is null, it means boss never spawned, so allow first spawn
        // If bossHasExited is true, it means boss exited after collision, so allow respawn
        // If bossHasExited is false, it means boss is still exiting OR was just defeated, so wait
        // Also check that boss hasn't been defeated for current stage yet
        const canSpawnBoss = (this.bossHasExited === null || this.bossHasExited === true) && !this.bossDefeatedForCurrentStage;
        if (!this.bossActive && canSpawnBoss && this.gameState.isPlaying && !this.gameState.isPaused && !this.gameState.isPenalized && !this.gameState.isLifeLostPaused) {
            const currentThreshold = this.getThresholdForStage(this.gameState.currentStage);
            if (this.gameState.lettersDestroyed >= currentThreshold && this.gameState.currentStage + 1 < TYPING_STAGES.length) {
                // Spawn boss before advancing stage
                this.spawnBoss();
            }
        }

        // Check for stage change (after boss is defeated)
        if (this.gameState.currentStage !== this.previousStage) {
            this.previousStage = this.gameState.currentStage;
            // Reset boss flags for the new stage
            this.bossDefeatedForCurrentStage = false;
            this.bossHasExited = null;
        }

        // Update boss if active (only when not paused)
        if (this.bossActive && !this.gameState.isPaused && !this.gameState.isLifeLostPaused) {
            this.updateBoss(time, delta);
        }

        // Game logic only runs when playing (spawning, etc.)
        // Also pause if life lost countdown is active
        // FIX: Allow update if isLifeLostPaused to play animations (boss exit, ship fall)
        if (!this.gameState.isPlaying || this.gameState.isPaused || this.gameState.isPenalized) {
            return;
        }

        // If life lost paused, ONLY update boss (for victory exit) and tweens (automatic)
        // Skip spawning and other logic
        if (this.gameState.isLifeLostPaused) {
            if (this.bossActive) {
                this.updateBoss(time, delta);
            }
            return;
        }

        // Spawning letters (not during boss fight and not after boss defeat)
        if (!this.bossActive && !this.bossDefeatedForCurrentStage) {
            // Dynamic Spawn Rate Logic
            // Calculate progress within current level
            const currentThreshold = this.getThresholdForStage(this.gameState.currentStage);
            const previousThreshold = this.gameState.currentStage > 0 ? this.getThresholdForStage(this.gameState.currentStage - 1) : 0;
            const lettersInLevel = Math.max(0, this.gameState.lettersDestroyed - previousThreshold);
            const totalLettersInLevel = Math.max(1, currentThreshold - previousThreshold);
            const levelProgress = Math.min(1, lettersInLevel / totalLettersInLevel);

            // "las letras progresivamente spwaneen mas rapido una de otras"
            // Start at 1.0 and go down to 0.3 (clamped)
            const spawnMultiplier = Math.max(0.3, 1.0 - (levelProgress * 0.8));
            const currentSpawnInterval = this.gameState.gameSpeed * spawnMultiplier;


            if (time - this.lastSpawnTime > currentSpawnInterval) {
                this.spawnLetter(time);
                this.lastSpawnTime = time;
            }
        }

        // Spawning meteorites (only from sector 2 onwards, and not during boss)
        if (!this.bossActive && !this.bossDefeatedForCurrentStage && this.gameState.currentStage >= 2 && time - this.lastMeteoriteSpawnTime > this.meteoriteSpawnInterval) {
            this.spawnMeteorite(time);
            this.lastMeteoriteSpawnTime = time;
        }
    }

    private spawnLetter(time: number) {
        const stage = TYPING_STAGES[this.gameState.currentStage];
        if (!stage || !stage.letters.length) return;

        // Filter out last spawned if possible (simple random for now)
        // Avoid duplicates: Try to pick a letter that isn't in the last 2 spawned
        let letterChar = stage.letters[Math.floor(Math.random() * stage.letters.length)];
        let attempts = 0;
        while (this.lastSpawnedLetters.includes(letterChar) && attempts < 10) {
            letterChar = stage.letters[Math.floor(Math.random() * stage.letters.length)];
            attempts++;
        }

        // Update history
        this.lastSpawnedLetters.push(letterChar);
        if (this.lastSpawnedLetters.length > 2) {
            this.lastSpawnedLetters.shift();
        }

        // Calculate target horizontal position (where letter will end up)
        const position = KEYBOARD_POSITIONS[letterChar];
        let targetX = Math.random() * (this.scale.width - 75);

        if (position) {
            const gameAreaWidth = this.scale.width;
            const keyboardMargin = Math.min(50, gameAreaWidth * 0.05);
            const availableWidth = gameAreaWidth - (keyboardMargin * 2);
            const maxColumns = 10;
            const columnWidth = availableWidth / maxColumns;
            targetX = keyboardMargin + (position.col * columnWidth);
            targetX = Math.max(30, Math.min(targetX, gameAreaWidth - 30));
        }

        // Calculate spawn X position (more separated from center based on final position)
        const centerX = this.scale.width / 2;
        const displacementFromCenter = targetX - centerX;
        const maxDisplacement = this.scale.width / 2; // Maximum possible displacement
        const normalizedDisplacement = Math.abs(displacementFromCenter) / maxDisplacement; // 0 to 1

        // Use a curve: letters closer to center start closer (5%), letters at edges start further (40%)
        // This prevents extreme letters from having to travel too much horizontally
        const spawnFactor = 0.2 + (normalizedDisplacement * 0.8); // 5% to 40% based on distance
        const spawnX = centerX + (displacementFromCenter * spawnFactor);

        // Start from middle of screen (50% Y) with scale 0.1 (tiny but visible)
        const startY = this.scale.height * 0.5; // 50% from top
        const container = this.add.container(spawnX, startY);
        container.setScale(0.1); // Start tiny but visible

        // Determine enemy sprite based on keyboard row
        // row 0 = top row (QWERTYUIOP) → enemy_2
        // row 1 = middle row (ASDFGHJKLÑ) → enemy
        // row 2 = bottom row (ZXCVBNM) → enemy_3
        let enemyKey = 'enemy'; // Default to middle row
        let enemyBKey = 'enemy_b'; // Default B variant
        if (position) {
            if (position.row === 0) {
                enemyKey = 'enemy_2'; // Top row
                enemyBKey = 'enemy_2b';
            } else if (position.row === 2) {
                enemyKey = 'enemy_3'; // Bottom row
                enemyBKey = 'enemy_3b';
            }
            // row === 1 or no position → use default 'enemy' and 'enemy_b'
        }

        // Add Enemy Image with random neon color
        const enemyColors = [0xFF10F0, 0x39FF14, 0x00FFFF, 0xFFFF00, 0xFF6600, 0xBF00FF];
        const enemyColor = enemyColors[Math.floor(Math.random() * enemyColors.length)];
        const enemySize = 100;
        // Position enemy: 3% up, 0.5% left (relative to enemy size)
        const offsetY = -enemySize * 0.15; // 3% up (negative Y)
        const offsetX = -enemySize * 0.03; // 0.5% left (negative X)
        const sprite = this.add.image(offsetX, offsetY, enemyKey);
        sprite.setDisplaySize(enemySize, enemySize);
        sprite.setTint(enemyColor);

        // Store both sprite keys for animation
        sprite.setData('enemyKey', enemyKey);
        sprite.setData('enemyBKey', enemyBKey);

        // Create animation that alternates between normal and B variant every second
        // Old-school sprite animation effect
        let isNormalFrame = true;
        const animateEnemy = () => {
            if (!sprite.active) return; // Stop if sprite is destroyed

            const currentKey = isNormalFrame ? sprite.getData('enemyKey') : sprite.getData('enemyBKey');
            sprite.setTexture(currentKey);
            isNormalFrame = !isNormalFrame;

            // Schedule next frame change (1 second = 1000ms)
            this.time.delayedCall(1000, animateEnemy);
        };

        // Start animation after 1 second
        this.time.delayedCall(1000, animateEnemy);

        // Add Text (30% below enemy center)
        const letterOffset = enemySize * 0.3;
        const text = this.add.text(0, letterOffset, letterChar, {
            fontSize: '54px',
            fontFamily: '"Press Start 2P", monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        container.add([sprite, text]);

        // Add Color Animation (Rainbow effect)
        this.tweens.addCounter({
            from: 0,
            to: 360,
            duration: 1000,
            repeat: -1,
            onUpdate: (tween) => {
                const value = tween.getValue() || 0;
                const color = Phaser.Display.Color.HSLToColor(value / 360, 1, 0.5);
                text.setTint(color.color);
            }
        });

        // Set Data
        container.setData('letter', letterChar);
        container.setData('speed', this.gameState.letterSpeed);
        container.setData('id', time + Math.random());
        container.setData('spawnTime', time); // Guardar tiempo de creación para seleccionar la más antigua
        container.setData('color', enemyColor);
        container.setData('phase', 'approaching'); // Track movement phase
        container.setData('targetX', targetX); // Store target X for perspective movement
        container.setData('spawnX', spawnX); // Store spawn X

        this.lettersGroup.add(container);
    }

    private spawnMeteorite(time: number) {
        const { width, height } = this.scale;

        // Spawn only from top half of screen (from middle to top)
        // Random position in top half
        const x = Math.random() * width;
        const y = -50 - Math.random() * (height / 2); // From -50 to -(height/2 + 50)

        // Random asteroid image
        const asteroidKey = `asteroid${Math.floor(Math.random() * 6) + 1}`;

        // Random size
        const size = 30 + Math.random() * 20; // 30-50px

        // Target is ship position
        const targetX = this.ship.x;
        const targetY = this.ship.y;

        // Calculate speed (half speed - divide by 120 instead of 60)
        const speedX = (targetX - x) / 120; // Half speed
        const speedY = (targetY - y) / 120; // Half speed

        const meteorite = this.add.image(x, y, asteroidKey);
        meteorite.setDisplaySize(size, size);
        meteorite.setTint(0xff6600); // Orange tint
        meteorite.setDepth(8);

        // Add rotation animation
        this.tweens.add({
            targets: meteorite,
            rotation: Math.PI * 2,
            duration: 2000 + Math.random() * 1000,
            repeat: -1,
            ease: 'Linear'
        });

        // Set data
        meteorite.setData('speedX', speedX);
        meteorite.setData('speedY', speedY);
        meteorite.setData('id', time + Math.random());

        this.meteoritesGroup.add(meteorite);
    }

    private updateMeteorites(delta: number) {
        const { width, height } = this.scale;

        this.meteoritesGroup.getChildren().forEach((child: any) => {
            const meteorite = child as Phaser.GameObjects.Image;
            if (!meteorite.active) return;

            const speedX = meteorite.getData('speedX') || 0;
            const speedY = meteorite.getData('speedY') || 0;

            // Update position
            meteorite.x += speedX * (delta / 16.66);
            meteorite.y += speedY * (delta / 16.66);

            // Check collision with ship or force field
            const distance = Phaser.Math.Distance.Between(
                meteorite.x, meteorite.y,
                this.ship.x, this.ship.y
            );
            const meteoriteRadius = meteorite.displayWidth / 2;
            const shipRadius = this.ship.displayWidth / 2;
            const forceFieldRadius = 150;

            if (this.forceFieldActive) {
                // Check collision with force field
                if (distance < forceFieldRadius) {
                    // Meteorite hit force field - destroy it without damage
                    this.handleMeteoriteHit(meteorite, true);
                    return;
                }
            } else {
                // Check collision with ship (only if force field is not active)
                if (distance < meteoriteRadius + shipRadius) {
                    // Meteorite hit ship - lose a life
                    this.handleMeteoriteHit(meteorite, false);
                    return;
                }
            }

            // Remove if off screen
            if (meteorite.x < -100 || meteorite.x > width + 100 ||
                meteorite.y < -100 || meteorite.y > height + 100) {
                meteorite.destroy();
            }
        });
    }

    private handleMeteoriteHit(meteorite: Phaser.GameObjects.Image, hitForceField: boolean = false) {
        if (hitForceField) {
            // Force field protects - destroy meteorite without damage
            // More impressive explosion for shield
            this.createForceFieldExplosion(meteorite.x, meteorite.y);
            meteorite.destroy();
            return;
        }

        // Meteorite hit ship - lose a life
        // Create reduced explosion (10% of force field particles)
        this.createShipHitExplosion(meteorite.x, meteorite.y);
        meteorite.destroy();

        // Destroy ship animation (similar to enemies)
        this.destroyShip();

        // Notify React to lose a life with ship destroyed message
        this.callbacks.onShipDestroyed();
    }

    private handleLetterEscaped(letterContainer: Phaser.GameObjects.Container) {
        letterContainer.destroy();
        this.callbacks.onLetterEscaped();
    }

    // Public method called from React
    public shootBullet(targetLetter: string) {
        // Don't shoot if game is paused, penalized, life lost countdown, OR force field is active
        if (!this.gameState.isPlaying || this.gameState.isPaused || this.gameState.isPenalized || this.gameState.isLifeLostPaused || this.forceFieldActive) {
            return;
        }

        // First check if boss is active and has this letter
        if (this.bossActive) {
            const hitSegment = this.hitBossSegment(targetLetter);
            if (hitSegment) {
                // Hit boss segment - create laser effect
                // Improved Laser Visibility
                // Core white/cyan line
                const laser = this.add.line(0, 0, this.ship.x, this.ship.y, hitSegment.x, hitSegment.y, 0x00ffff);
                laser.setLineWidth(6);
                laser.setOrigin(0, 0);
                laser.setDepth(200); // Increased depth to be visible over boss (was 20)
                laser.setBlendMode(Phaser.BlendModes.ADD);

                // Outer glow (red)
                const laserGlow = this.add.line(0, 0, this.ship.x, this.ship.y, hitSegment.x, hitSegment.y, 0xff0000);
                laserGlow.setLineWidth(12);
                laserGlow.setOrigin(0, 0);
                laserGlow.setDepth(199); // Increased depth (was 19)
                laserGlow.setAlpha(0.6);
                laserGlow.setBlendMode(Phaser.BlendModes.ADD);

                this.tweens.add({
                    targets: [laser, laserGlow],
                    alpha: 0,
                    duration: 250,
                    onComplete: () => {
                        laser.destroy();
                        laserGlow.destroy();
                    }
                });
                return;
            }
        }

        // Find target (exclude already hit letters)
        const targets = this.lettersGroup.getChildren().filter((child: any) => {
            const container = child as Phaser.GameObjects.Container;
            return container.getData('letter') === targetLetter && !container.getData('hit');
        }) as Phaser.GameObjects.Container[];

        if (targets.length === 0) {
            this.callbacks.onWrongKey();
            return;
        }

        // Target the oldest one (lowest spawnTime = created first)
        targets.sort((a, b) => {
            const timeA = a.getData('spawnTime') || 0;
            const timeB = b.getData('spawnTime') || 0;
            return timeA - timeB; // Menor tiempo = más antigua
        });
        const target = targets[0];

        // Calculate angle for ship rotation
        const angle = Phaser.Math.Angle.Between(this.ship.x, this.ship.y, target.x, target.y);
        const targetAngle = Phaser.Math.RadToDeg(angle) + 90;

        // Cancel any existing tween
        if (this.shipAngleTween) {
            this.shipAngleTween.stop();
            this.shipAngleTween = null;
        }

        // Animate ship angle quickly to target (fast tilt when shooting)
        this.shipAngleTween = this.tweens.addCounter({
            from: this.shipAngle,
            to: targetAngle,
            duration: 100, // Fast animation when shooting (100ms)
            ease: 'Power2',
            onUpdate: (tween) => {
                this.shipAngle = tween.getValue() as number;
            },
            onComplete: () => {
                // After reaching target, animate back to vertical (much slower)
                this.shipAngleTween = this.tweens.addCounter({
                    from: this.shipAngle,
                    to: 0, // Return to vertical (0 degrees)
                    duration: 600, // Much slower return animation (600ms, was 300ms)
                    ease: 'Power1',
                    onUpdate: (returnTween) => {
                        this.shipAngle = returnTween.getValue() as number;
                    },
                    onComplete: () => {
                        this.shipAngleTween = null;
                    }
                });
            }
        });

        // Draw Laser
        const laser = this.add.line(0, 0, this.ship.x, this.ship.y, target.x, target.y, 0xff0000);
        laser.setLineWidth(4);
        laser.setOrigin(0, 0);
        laser.setDepth(5);

        // Fade out laser
        this.tweens.add({
            targets: laser,
            alpha: 0,
            duration: 150,
            onComplete: () => {
                laser.destroy();
            }
        });

        // Instant Hit
        this.hitLetter(target);
    }

    private hitLetter(target: Phaser.GameObjects.Container) {
        if (!target.active) return; // Already hit

        // Mark as hit to prevent further updates
        target.setData('hit', true);

        // Get the enemy sprite and letter text from container
        const enemySprite = target.getAt(0) as Phaser.GameObjects.Image;
        const letterText = target.getAt(1) as Phaser.GameObjects.Text;

        // Create explosion with enemy color
        const enemyColor = target.getData('color') || 0xffff00;
        this.createExplosion(target.x, target.y, enemyColor);

        // Create enemy disintegration effect (pixelated squares from circle area)
        const enemyRadius = 50;
        const circle = new Phaser.Geom.Circle(0, 0, enemyRadius);
        const pixelParticles = this.add.particles(target.x, target.y, 'particle', {
            speed: { min: 0, max: 0 },
            scale: { start: 0.5, end: 0.5 },
            lifespan: 1,
            blendMode: 'ADD',
            quantity: 2,
            tint: enemyColor,
            angle: { min: 0, max: 360 },
            gravityY: 0,
            emitZone: {
                type: 'random',
                source: circle,
                quantity: 2
            }
        });

        // Auto destroy pixel particles
        this.time.delayedCall(350, () => {
            pixelParticles.destroy();
        });

        // Make enemy explode and disappear
        this.tweens.add({
            targets: enemySprite,
            scale: 2,
            alpha: 0,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                enemySprite.destroy();
            }
        });

        // Notify React to calculate points (but don't update score yet)
        const letterObj: FallingLetter = {
            letter: target.getData('letter'),
            x: target.x,
            y: target.y,
            speed: target.getData('speed'),
            id: target.getData('id')
        };

        // Callback calculates points and combo, returns points but doesn't update score yet
        const result = this.callbacks.onLetterHit(letterObj);
        const pointsEarned = result?.points || 10;
        const totalScoreToAdd = result?.totalScore || 10;

        // Store points for display and score for later update
        target.setData('points', pointsEarned);
        target.setData('scoreToAdd', totalScoreToAdd);

        // Wait 500ms, then absorb only the letter into ship
        this.time.delayedCall(500, () => {
            if (!target.active) return; // Already destroyed

            // Make letter bigger and brighter while being absorbed
            this.tweens.add({
                targets: letterText,
                scale: 1.5,
                duration: 100
            });

            // Fade out letter gradually as it moves to ship (starts immediately, lasts entire movement)
            this.tweens.add({
                targets: letterText,
                alpha: 0,
                duration: 300, // Same duration as movement, starts immediately
                ease: 'Linear' // Linear fade for smooth transparency
            });

            // Animate letter container moving to ship
            this.tweens.add({
                targets: target,
                x: this.ship.x,
                y: this.ship.y,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    // Create points text when letter reaches ship
                    // Get points from target data
                    const points = target.getData('points') || 10;
                    const scoreToAdd = target.getData('scoreToAdd') || points;

                    // Update score when points text appears (when letter reaches ship)
                    const currentScore = this.gameState.score;
                    const newScore = currentScore + scoreToAdd;
                    this.callbacks.onScoreChange(newScore);

                    const pointsText = this.add.text(
                        this.ship.x,
                        this.ship.y - 30, // Start slightly above ship
                        `+${points}`,
                        {
                            fontSize: '24px',
                            fontFamily: '"Press Start 2P", monospace',
                            color: '#00ffff',
                            stroke: '#000000',
                            strokeThickness: 3,
                            shadow: {
                                offsetX: 0,
                                offsetY: 0,
                                color: '#00ffff',
                                blur: 10,
                                stroke: true,
                                fill: true
                            }
                        }
                    ).setOrigin(0.5).setDepth(15);

                    // Animate points text: move up and fade out
                    this.tweens.add({
                        targets: pointsText,
                        y: this.ship.y - 80, // Move up
                        alpha: 0, // Fade out
                        duration: 800,
                        ease: 'Power1',
                        onComplete: () => {
                            pointsText.destroy();
                        }
                    });

                    target.destroy();
                }
            });
        });
    }

    private createExplosion(x: number, y: number, color: number) {
        // Colored particle explosion
        const particles = this.add.particles(x, y, 'particle', {
            speed: { min: 100, max: 300 },
            scale: { start: 2, end: 0 },
            lifespan: 300,
            blendMode: 'ADD',
            quantity: 1,
            tint: color
        });

        // Auto destroy emitter after use
        this.time.delayedCall(100, () => {
            particles.destroy();
        });
    }

    private createForceFieldExplosion(x: number, y: number) {
        // Minimal explosion for force field - reduced to 10% size/quantity
        const cyanColor = 0x00ffff;
        const blueColor = 0x0088ff;
        const whiteColor = 0xffffff;

        // Layer 1: Fast outward particles (cyan) - 10% of original
        const fastParticles = this.add.particles(x, y, 'particle', {
            speed: { min: 0, max: 300 },
            scale: { start: 1, end: 0 }, // Was 2.0
            lifespan: 300,
            blendMode: 'ADD',
            quantity: 2, // Was 15
            tint: cyanColor,
            angle: { min: 0, max: 360 },
            alpha: { start: 1, end: 0 }
        });

        // Layer 2: Medium speed particles (blue) - 10% of original
        const mediumParticles = this.add.particles(x, y, 'particle', {
            speed: { min: 50, max: 300 },
            scale: { start: 1.2, end: 0 }, // Was 1.5
            lifespan: 300,
            blendMode: 'ADD',
            quantity: 2, // Was 10
            tint: blueColor,
            angle: { min: 0, max: 360 },
            alpha: { start: 0.8, end: 0 }
        });

        // Layer 3: Slow bright particles (white/cyan mix) - 10% of original
        const slowParticles = this.add.particles(x, y, 'particle', {
            speed: { min: 200, max: 300 },
            scale: { start: 1.5, end: 0 }, // Was 1.8
            lifespan: 300,
            blendMode: 'ADD',
            quantity: 2, // Was 8
            tint: [cyanColor, whiteColor],
            angle: { min: 0, max: 360 },
            alpha: { start: 1, end: 0 }
        });

        // Create expanding circle effect - 10% size
        const circle = this.add.circle(x, y, 0, cyanColor, 0.5);
        circle.setStrokeStyle(1, cyanColor, 1); // Was 3
        circle.setBlendMode(Phaser.BlendModes.ADD);
        circle.setDepth(10);

        // Expand and fade circle - 10% of original radius
        this.tweens.add({
            targets: circle,
            radius: 100, // Was 200
            alpha: 0,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                circle.destroy();
            }
        });

        // Auto destroy emitters after use
        this.time.delayedCall(1200, () => {
            fastParticles.destroy();
            mediumParticles.destroy();
            slowParticles.destroy();
        });
    }

    private createShipHitExplosion(x: number, y: number) {
        // Reduced explosion when meteorite hits ship (10x less particles, 5x less duration)
        // Original: 4 particles total (2+1+1), now: 1 particle (4/10 = 0.4, rounded to 1 for visibility)
        // Original duration: 800-1200ms, now: 160-240ms (5x less)
        const orangeColor = 0xff6600;

        // Single layer with minimal particles (10x less than original)
        const particles = this.add.particles(x, y, 'particle', {
            speed: { min: 200, max: 500 },
            scale: { start: 2.0, end: 0 },
            lifespan: 160, // 800 / 5 = 160ms (5x less duration)
            blendMode: 'ADD',
            quantity: 1, // 4 / 10 = 0.4, but using 1 for minimal visibility
            tint: orangeColor,
            angle: { min: 0, max: 360 },
            alpha: { start: 1, end: 0 }
        });

        // Auto destroy emitter after use (5x less duration: 1200 / 5 = 240ms)
        this.time.delayedCall(240, () => {
            particles.destroy();
        });
    }

    private destroyShip() {
        // Destroy ship animation (similar to enemies)
        if (!this.ship || !this.ship.active) return;

        // Stop thrusters
        const leftThruster = (this.ship as any).leftThruster;
        const rightThruster = (this.ship as any).rightThruster;
        if (leftThruster) leftThruster.stop();
        if (rightThruster) rightThruster.stop();

        // Make ship spin and fall off screen IMMEDIATELY
        // Cancel any existing rotation tween
        if (this.shipAngleTween) {
            this.shipAngleTween.stop();
            this.shipAngleTween = null;
        }

        // Immediately rotate ship to a falling angle (45 degrees)
        this.shipAngle = 45;
        this.ship.setRotation(Phaser.Math.DegToRad(45));

        // Continuous rotation animation (spins while falling)
        // Create rotation tween first so it can be referenced in fall tween
        const rotationTween = this.tweens.add({
            targets: this.ship,
            rotation: this.ship.rotation + Math.PI * 8, // Spin 4 full rotations
            duration: 1500, // Same duration as fall
            ease: 'Linear', // Constant rotation speed
            repeat: 0 // No repeat, but we'll make it spin enough
        });

        // Make ship fall off screen with continuous rotation
        this.tweens.add({
            targets: this.ship,
            y: this.scale.height + 100, // Fall off screen
            duration: 1500, // Faster fall
            ease: 'Quad.easeIn', // Accelerate falling
            onComplete: () => {
                // Ship will be recreated when game resumes, so we don't destroy it
                // Just hide it temporarily
                this.ship.setVisible(false);
                // Stop rotation when ship is hidden
                if (rotationTween) {
                    rotationTween.stop();
                }
            }
        });
    }

    public updateGameState(newState: GameState) {
        const wasLifeLostPaused = this.gameState?.isLifeLostPaused || false;
        this.gameState = newState;

        // Restore ship visibility when game resumes after destruction
        if (this.ship && wasLifeLostPaused && !newState.isLifeLostPaused && !this.ship.visible) {
            this.ship.setVisible(true);
            this.ship.setAlpha(1);
            this.ship.setScale(0.2); // Restore original scale

            // Reset ship angle to neutral (pointing up/center)
            this.shipAngle = 0;
            if (this.shipAngleTween) {
                this.shipAngleTween.stop();
                this.shipAngleTween = null;
            }
            this.ship.setRotation(0); // Upright

            // Respawn Animation: Rise from bottom to neutral position
            const { width, height } = this.scale;
            this.ship.x = width / 2; // Center horizontally
            this.ship.y = height + 100; // Start off-screen bottom

            // Restore to neutral position (height - 200, same as initial spawn)
            this.tweens.add({
                targets: this.ship,
                y: height - 200, // Neutral position (same as initial spawn)
                duration: 1000,
                ease: 'Power2.easeOut'
            });

            // Restart thrusters
            const leftThruster = (this.ship as any).leftThruster;
            const rightThruster = (this.ship as any).rightThruster;
            if (leftThruster) leftThruster.start();
            if (rightThruster) rightThruster.start();

            // Resume boss attack pattern if boss is active and in victory pattern
            if (this.bossActive && this.bossAttackPattern === 'victory' && this.bossHead && this.bossHead.active) {
                // Simply resume idle pattern (advancing)
                // The boss will start advancing from its current position (retreatTargetY)
                this.bossAttackPattern = 'idle';
                this.bossAttackTimer = 0;
            }
        }
    }

    public setShipAngle(angle: number) {
        // Cancel any existing tween when setting angle externally
        if (this.shipAngleTween) {
            this.shipAngleTween.stop();
            this.shipAngleTween = null;
        }
        this.shipAngle = angle;
    }

    public setPaused(paused: boolean) {
        if (paused) {
            this.scene.pause();
        } else {
            this.scene.resume();
        }
    }

    private shakeShip() {
        if (!this.ship || !this.ship.active) return;

        // Store original position
        const originalX = this.ship.x;
        const originalY = this.ship.y;

        // Create shake effect over 1 second
        const shakeIntensity = 8;
        const shakeDuration = 1000;
        const shakeSteps = 20;
        const stepDuration = shakeDuration / shakeSteps;

        let currentStep = 0;

        const shakeInterval = setInterval(() => {
            currentStep++;

            if (currentStep >= shakeSteps) {
                // Return to original position
                clearInterval(shakeInterval);
                this.ship.setPosition(originalX, originalY);
            } else {
                // Random offset decreasing over time
                const progress = currentStep / shakeSteps;
                const currentIntensity = shakeIntensity * (1 - progress);
                const offsetX = (Math.random() - 0.5) * currentIntensity * 2;
                const offsetY = (Math.random() - 0.5) * currentIntensity * 2;
                this.ship.setPosition(originalX + offsetX, originalY + offsetY);
            }
        }, stepDuration);
    }


    public activateForceField() {
        // Don't activate if game is not playing, paused, penalized, or in life lost countdown
        if (!this.gameState.isPlaying || this.gameState.isPaused || this.gameState.isPenalized || this.gameState.isLifeLostPaused) {
            return;
        }

        if (this.forceFieldActive) return; // Already active

        this.forceFieldActive = true;
        this.forceFieldStartTime = this.time.now;

        // Create force field circle around ship - RED/ORANGE theme
        this.forceField = this.add.circle(
            this.ship.x,
            this.ship.y,
            150, // radius
            0xff4400, // orange-red color
            0.2 // alpha
        );
        this.forceField.setStrokeStyle(4, 0xff0000, 1); // Red stroke
        this.forceField.setDepth(9);
        this.forceField.setBlendMode(Phaser.BlendModes.ADD);

        // Red glow pulse animation
        this.tweens.add({
            targets: this.forceField,
            scaleX: 1.15,
            scaleY: 1.15,
            alpha: 0.4,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Yellow ring pulses emanating outward every 500ms
        const createYellowPulse = () => {
            if (!this.forceFieldActive || !this.forceField) return;

            const pulse = this.add.circle(this.ship.x, this.ship.y, 50, 0xffff00, 0);
            pulse.setStrokeStyle(2, 0xffff00, 0.8);
            pulse.setBlendMode(Phaser.BlendModes.ADD);
            pulse.setDepth(8);

            this.tweens.add({
                targets: pulse,
                radius: 170,
                alpha: 0,
                duration: 600,
                ease: 'Cubic.easeOut',
                onComplete: () => pulse.destroy()
            });
        };

        // Initial pulse
        createYellowPulse();

        // Recurring pulses
        this.forceFieldPulseEvent = this.time.addEvent({
            delay: 500,
            callback: createYellowPulse,
            loop: true
        });

        // Auto deactivate after duration
        this.time.delayedCall(this.forceFieldDuration, () => {
            this.deactivateForceField();
        });
    }

    private deactivateForceField() {
        // Stop pulse event
        if (this.forceFieldPulseEvent) {
            this.forceFieldPulseEvent.destroy();
            this.forceFieldPulseEvent = null;
        }

        if (this.forceField) {
            // Fade out animation
            this.tweens.add({
                targets: this.forceField,
                alpha: 0,
                scaleX: 0,
                scaleY: 0,
                duration: 300,
                onComplete: () => {
                    if (this.forceField) {
                        this.forceField.destroy();
                        this.forceField = null;
                    }
                }
            });
        }
        this.forceFieldActive = false;
    }

    // ========== BOSS SNAKE METHODS ==========

    private spawnBoss() {
        if (this.bossActive) return; // Boss already active

        const stage = TYPING_STAGES[this.gameState.currentStage];
        if (!stage || !stage.letters.length) return;

        // Get learned letters from current and previous stages
        let learnedLetters: string[] = [];
        for (let i = 0; i <= this.gameState.currentStage; i++) {
            const prevStage = TYPING_STAGES[i];
            if (prevStage) {
                prevStage.letters.forEach(letter => {
                    if (!learnedLetters.includes(letter)) {
                        learnedLetters.push(letter);
                    }
                });
            }
        }

        // Ensure at least 10 segments by repeating letters if necessary
        if (learnedLetters.length > 0) {
            while (learnedLetters.length < 10) {
                // Add random letters from the learned set to reach 10
                const randomLetter = learnedLetters[Math.floor(Math.random() * learnedLetters.length)];
                learnedLetters.push(randomLetter);
            }
        }

        if (learnedLetters.length === 0) return;

        // Clear existing enemies
        this.lettersGroup.clear(true, true);

        // Create boss snake with learned letters
        this.bossActive = true;
        this.bossHasExited = false; // Set to false when boss spawns (will be set to true when it exits after collision)
        this.bossDefeatedForCurrentStage = false; // Reset defeat flag when boss spawns
        this.callbacks.onBossSpawn(); // Play boss spawn sound
        console.log('Starting boss music...'); // Debug log
        this.callbacks.onBossMusicStart(); // Start boss music
        this.bossSegments = [];
        this.bossTrail = [];
        this.bossMaxHealth = learnedLetters.length * 2; // 2 HP per segment
        this.bossHealth = this.bossMaxHealth;
        this.bossPhase = 1;
        this.bossAttackPattern = 'idle';
        this.bossAttackTimer = 0;
        this.bossLastShotTime = 0;
        this.bossWaveTime = 0;

        const { width } = this.scale;

        // Initialize trail with starting positions
        for (let i = 0; i < 2000; i++) { // Increased trail length for safety (more segments now)
            this.bossTrail.push({
                x: width / 2,
                y: -100,
                rotation: 0
            });
        }

        // Create all segments (including the first one which acts as visual head)
        const segmentDelay = 8; // Reduced from 15 for even tighter spacing

        // 1. Create HEAD (Square, no letter)
        const headSegment = this.createBossHead(width / 2, -100);
        headSegment.setDepth(100); // Head on top
        headSegment.setData('trailOffset', 0);
        this.bossHead = headSegment;
        this.bossSegments.push(headSegment);
        this.bossGroup.add(headSegment);

        // 2. Create BODY segments (Interleaved: Empty -> Empty -> Letter)
        let currentTrailOffset = segmentDelay; // Start after head

        for (let i = 0; i < learnedLetters.length; i++) {
            // A. Create EMPTY segment 1
            const emptySegment1 = this.createBossSegment(null, width / 2, -100);
            emptySegment1.setDepth(90 - (i * 3));
            emptySegment1.setData('trailOffset', currentTrailOffset);
            this.bossSegments.push(emptySegment1);
            this.bossGroup.add(emptySegment1);

            currentTrailOffset += segmentDelay;

            // B. Create EMPTY segment 2
            const emptySegment2 = this.createBossSegment(null, width / 2, -100);
            emptySegment2.setDepth(90 - (i * 3) - 1);
            emptySegment2.setData('trailOffset', currentTrailOffset);
            this.bossSegments.push(emptySegment2);
            this.bossGroup.add(emptySegment2);

            currentTrailOffset += segmentDelay;

            // C. Create LETTER segment
            const letterSegment = this.createBossSegment(learnedLetters[i], width / 2, -100);
            letterSegment.setDepth(90 - (i * 3) - 2);
            letterSegment.setData('trailOffset', currentTrailOffset);
            this.bossSegments.push(letterSegment);
            this.bossGroup.add(letterSegment);

            currentTrailOffset += segmentDelay;
        }

        // 3. Create TAIL (10 empty segments, tapering size)
        for (let i = 0; i < 10; i++) {
            const tailSegment = this.createBossSegment(null, width / 2, -100);

            // Lower depth than body
            tailSegment.setDepth(10 - i);
            tailSegment.setData('trailOffset', currentTrailOffset);

            // Tapering logic
            // Pivot at top to shrink upwards
            const sprite = tailSegment.getAt(0) as Phaser.GameObjects.Sprite;
            if (sprite) {
                // Set origin to Top Center
                sprite.setOrigin(0.5, 0);
                // Align top with the top of regular segments (-70)
                // Regular segments are centered at -30 with height 80, so top is -70.
                sprite.y = -70;

                // Scale down
                // FIX: Use setDisplaySize to respect the base size of 80x80
                // Original image might be huge, so setScale(0.9) makes it huge.
                // We want it to be 80 * 0.9, 80 * 0.8, etc.
                const scaleFactor = 1.0 - (i * 0.08); // Start at 1.0, then 0.92, etc.
                const targetSize = 80 * Math.max(0.2, scaleFactor);

                sprite.setDisplaySize(targetSize, targetSize);
            }

            this.bossSegments.push(tailSegment);
            this.bossGroup.add(tailSegment);

            // Scale the distance between segments based on their size
            // As segments get smaller, they should be closer together
            const scaleFactor = 1.0 - (i * 0.08);
            const scaledDelay = Math.max(3, Math.floor(segmentDelay * scaleFactor));
            currentTrailOffset += scaledDelay;
        }
    }

    private createBossHead(x: number, y: number): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);

        // Use Sprite for head
        const headSprite = this.add.sprite(0, 0, 'boss_head');
        headSprite.setDisplaySize(100, 100); // Adjust size as needed

        // Offset head sprite position (100% down/up?)
        // User said "por debajo un 100% de su propia altura mas arriba" -> "100% of its height higher"
        // Previous was y=30. Height is 100. So move up by 100?
        // Or set to -70 as planned?
        // Let's set to -70 to move it UP relative to the container center.
        // UPDATE: User said "quedo muy arriba, hay que bajarla un 50" -> -70 + 50 = -20.
        headSprite.y = -20;

        // No glow effect
        container.add(headSprite);

        // Store data
        container.setData('isHead', true);
        container.setData('health', 9999); // Indestructible by normal means
        container.setData('index', 0);

        // Spawn animation: Scale from 0.8 to 1.2
        container.setScale(0.8);
        this.tweens.add({
            targets: container,
            scale: 1.2,
            duration: 2000,
            ease: 'Sine.easeOut'
        });

        return container;
    }

    private createBossSegment(letter: string | null, x: number, y: number): Phaser.GameObjects.Container {
        const container = this.add.container(x, y);
        const isSpacer = (letter === null);

        // Use Sprite for segment
        // Use 'boss_segment_empty' for spacers, 'boss_segment' for letters
        const texture = isSpacer ? 'boss_segment_empty' : 'boss_segment';
        const segmentSprite = this.add.sprite(0, 0, texture);
        segmentSprite.setDisplaySize(80, 80); // Adjust size as needed

        // Offset upwards as requested
        // "bastante desplazado segun 'y' para arriba"
        segmentSprite.y = -30;

        if (!isSpacer && letter) {
            // Create letter text - Positioned relative to the sprite
            // User requested "100% of its height lower"
            // Previous: -30. Height: ~32-40px. New: ~10.
            const text = this.add.text(0, 10, letter, {
                fontSize: '32px',
                fontFamily: '"Press Start 2P", monospace',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);

            container.add(text);
        }

        // Add to container (Order: Sprite, [Text])
        container.addAt(segmentSprite, 0);

        // Store data
        container.setData('letter', letter); // null for spacers
        container.setData('isHead', false);
        container.setData('isSpacer', isSpacer);
        container.setData('health', 2);
        container.setData('index', this.bossSegments.length);

        // Spawn animation: Scale from 0.8 to 1.2
        container.setScale(0.8);
        this.tweens.add({
            targets: container,
            scale: 1.2,
            duration: 2000,
            ease: 'Sine.easeOut'
        });

        return container;
    }

    private createSpectacularExplosion(x: number, y: number, color: number | number[]) {
        // More particles, higher speed
        // Reduced scale (50% of previous)
        // Multicolor: color can be array

        const particles = this.add.particles(x, y, 'particle', {
            speed: { min: 200, max: 600 },
            scale: { start: 0.4, end: 0 }, // Reduced from 0.75 to 0.4 (User said "mas pequeño")
            lifespan: 800,
            blendMode: 'ADD',
            quantity: 30, // More particles
            tint: color, // Can be array
            angle: { min: 0, max: 360 },
            gravityY: 100
        });

        // NO RING EFFECT as requested
        /*
        const ring = this.add.circle(x, y, 10, color as number, 0);
        ring.setStrokeStyle(4, color as number, 1);
        this.tweens.add({
            targets: ring,
            radius: 50,
            alpha: 0,
            duration: 500,
            onComplete: () => ring.destroy()
        });
        */

        // Auto destroy emitter
        this.time.delayedCall(1000, () => {
            particles.destroy();
        });
    }

    private updateBoss(time: number, delta: number) {
        if (!this.bossActive) {
            return;
        }

        // Check if only head remains (all letter segments destroyed)
        // Filter out head and spacers, only check letter segments
        const activeLetterSegments = this.bossSegments.filter(s =>
            s.active &&
            !s.getData('isHead') &&
            !s.getData('isSpacer') &&
            !s.getData('letterAbsorbed')
        );
        if (activeLetterSegments.length === 0 && this.bossSegments.length > 1) {
            this.defeatBoss();
            return;
        }

        // If boss is in victory pattern, let updateBossAttackPattern handle all movement
        if (this.bossAttackPattern === 'victory') {
            this.updateBossAttackPattern(time, delta);
            return;
        }

        const { width, height } = this.scale;
        this.bossWaveTime += delta * 0.001;

        // Update boss phase based on health
        const healthPercent = this.bossHealth / this.bossMaxHealth;
        if (healthPercent <= 0.2 && this.bossPhase !== 3) {
            this.bossPhase = 3;
        } else if (healthPercent <= 0.5 && this.bossPhase === 1) {
            this.bossPhase = 2;
        }

        // Calculate Virtual Head position with wave movement
        // Speed increased significantly (3x faster) -> User requested even faster/wider
        const waveSpeed = 0.01 + (this.bossPhase - 1) * 0.005; // Increased speed
        const waveAmplitude = 250 + (this.bossPhase - 1) * 50; // Increased amplitude (was 150)

        // Horizontal wave movement
        const baseX = width / 2;
        const waveX = baseX + Math.sin(this.bossWaveTime * waveSpeed * 100) * waveAmplitude;

        // Vertical movement (approaching player)
        // Linear approach instead of wave
        const approachSpeed = 40; // Increased from 20 to 40
        const currentY = this.bossHead.y;
        const approachY = currentY + (approachSpeed * (delta / 1000));

        // Keep within bounds (allow going off screen to hit ship)
        const maxY = height + 100;
        const finalY = Math.min(approachY, maxY);

        // Add current position to trail
        this.bossTrail.unshift({
            x: waveX,
            y: finalY,
            rotation: 0 // Always 0 rotation
        });

        // Limit trail length
        if (this.bossTrail.length > 1000) {
            this.bossTrail.pop();
        }

        // Update ALL segments to follow trail based on their offset
        this.bossSegments.forEach((segment) => {
            if (!segment.active) return;

            const trailOffset = segment.getData('trailOffset') || 0;

            if (trailOffset < this.bossTrail.length) {
                const trailPos = this.bossTrail[trailOffset];
                segment.x = trailPos.x;
                segment.y = trailPos.y;
                segment.setRotation(0); // Always horizontal/fixed orientation

                // Check collision with ship (only if not in victory pattern)
                // Improved Collision Detection
                // Only check if segment is actually on screen and close enough to matter
                if (segment.y > 0 && segment.y < height) {
                    const isHead = segment.getData('isHead');

                    // ONLY THE HEAD CAN KILL THE SHIP
                    if (!isHead) return;

                    const hitRadius = 25; // Reduced from 40
                    const shipRadius = 20; // Approx ship body radius

                    // For the head, we need to account for the visual offset
                    const collisionX = segment.x;
                    const collisionY = segment.y + 20;

                    const distance = Phaser.Math.Distance.Between(collisionX, collisionY, this.ship.x, this.ship.y);

                    // NOTE: Force field does NOT protect against boss collision
                    // It only blocks projectiles (handled in updateBossProjectiles)

                    if (distance < hitRadius + shipRadius) {
                        this.handleBossCollision();
                        return;
                    }
                }
            }
        });

        // Update attack patterns
        this.bossAttackTimer += delta;
        this.updateBossAttackPattern(time, delta);

        // Update boss projectiles
        this.updateBossProjectiles(delta);

        // Check collision with ship bullets
        this.checkBossCollisions();

        // Check if boss is defeated (Health check is secondary now, mainly checking segments)
        if (this.bossHealth <= 0) {
            // this.defeatBoss(); // Handled by segment count check at start
        }
    }

    private updateBossAttackPattern(time: number, delta?: number) {
        const phaseSpeed = this.bossPhase === 3 ? 2000 : this.bossPhase === 2 ? 3000 : 4000;

        if (this.bossAttackPattern === 'idle') {
            if (this.bossAttackTimer > phaseSpeed) {
                // Choose attack pattern
                const rand = Math.random();
                if (rand < 0.4) {
                    this.bossAttackPattern = 'shooting';
                    this.bossAttackTimer = 0;
                } else if (rand < 0.7 && this.bossPhase >= 2) {
                    this.bossAttackPattern = 'zigzag';
                    this.bossAttackTimer = 0;
                } else if (rand < 1.0 && this.bossPhase >= 3) {
                    this.bossAttackPattern = 'dash';
                    this.bossAttackTimer = 0;
                }
            }
        } else if (this.bossAttackPattern === 'shooting') {
            // Shoot in bursts
            const burstInterval = 600;
            const shotsPerBurst = 3;
            const burstPause = 1000;

            if (time - this.bossLastShotTime > burstInterval) {
                this.bossShoot();
                this.bossLastShotTime = time;

                // Check if burst is complete
                const shotsInBurst = Math.floor((time - (this.bossAttackTimer - burstPause)) / burstInterval);
                if (shotsInBurst >= shotsPerBurst) {
                    this.bossAttackPattern = 'idle';
                    this.bossAttackTimer = 0;
                }
            }
        } else if (this.bossAttackPattern === 'zigzag') {
            // Aggressive zigzag movement
            const zigzagDuration = 3000;
            if (this.bossAttackTimer > zigzagDuration) {
                this.bossAttackPattern = 'idle';
                this.bossAttackTimer = 0;
            }
        } else if (this.bossAttackPattern === 'dash') {
            // Dash towards player
            const dashDuration = 2000;
            if (this.bossAttackTimer > dashDuration) {
                this.bossAttackPattern = 'idle';
                this.bossAttackTimer = 0;
            }
        } else if (this.bossAttackPattern === 'victory') {
            // Partial retreat pattern - move to upper screen and hover
            const { width, height } = this.scale;

            // Match updateBoss parameters for continuity (Smooth undulating movement)
            const waveSpeed = 0.01 + (this.bossPhase - 1) * 0.005;
            const waveAmplitude = 250 + (this.bossPhase - 1) * 50;

            const retreatTargetY = height * 0.15; // Retreat to 15% (higher up)
            const upwardSpeed = 300; // Pixels per second (smooth retreat)

            // Update wave time for zigzag animation
            if (delta !== undefined) {
                this.bossWaveTime += delta * 0.001; // Use actual delta for smooth animation
            } else {
                this.bossWaveTime += 16 * 0.001; // Fallback
            }

            // Move head in undulating pattern away from player
            if (this.bossHead && this.bossHead.active) {
                // Calculate wave position (Same formula as updateBoss for continuity)
                const waveX = width / 2 + Math.sin(this.bossWaveTime * waveSpeed * 100) * waveAmplitude;

                // Calculate Y position (Retreating upwards)
                let nextY = this.bossHead.y;

                if (nextY > retreatTargetY) {
                    // Move up smoothly
                    nextY -= upwardSpeed * (delta ? delta / 1000 : 0.016);
                } else {
                    // Reached retreat position - hover with subtle vertical wave
                    nextY = retreatTargetY + Math.sin(this.bossWaveTime * 3) * 10;
                }

                this.bossHead.x = waveX;
                this.bossHead.y = nextY;

                // Update trail
                this.bossTrail.unshift({
                    x: waveX,
                    y: nextY,
                    rotation: 0
                });

                // Limit trail length
                if (this.bossTrail.length > 1000) {
                    this.bossTrail.pop();
                }

                // Update all segments to follow the trail
                this.bossSegments.forEach((segment) => {
                    if (!segment.active) return;
                    const trailOffset = segment.getData('trailOffset') || 0;
                    if (trailOffset < this.bossTrail.length) {
                        const trailPos = this.bossTrail[trailOffset];
                        segment.x = trailPos.x;
                        segment.y = trailPos.y;
                        segment.setRotation(0); // Keep horizontal orientation
                    }
                });
            }
        }
    }

    private bossShoot() {
        // Use the HEAD segment as the shooting point
        if (!this.bossHead || !this.bossHead.active) return;

        const shooter = this.bossHead;

        // Shoot from the visual center (offset by 30)
        // User requested "mouth", which is at the bottom of the head
        const shootY = shooter.y + 40;

        const angle = Phaser.Math.Angle.Between(
            shooter.x, shootY,
            this.ship.x, this.ship.y
        );

        // Create a SPHERE projectile (Green/Yellow plasma ball)
        const projectile = this.add.circle(shooter.x, shootY, 12, 0x00ff00, 1);
        projectile.setStrokeStyle(3, 0xffff00, 1);
        projectile.setBlendMode(Phaser.BlendModes.ADD);
        projectile.setDepth(10);

        // Add a glow/trail effect
        // We can't easily add a trail to a raw shape without a container or particles, 
        // but let's just make it look "energetic"

        const speed = 7.29; // ~48x slower than original (350/48 ≈ 7.29)
        const velocityX = Math.cos(angle) * speed;
        const velocityY = Math.sin(angle) * speed;

        projectile.setData('velocityX', velocityX);
        projectile.setData('velocityY', velocityY);
        projectile.setData('isBossProjectile', true); // Mark as boss projectile

        this.bossProjectilesGroup.add(projectile);
        this.callbacks.onBossShot(); // Play shot sound
    }

    private updateBossProjectiles(delta: number) {
        const { width, height } = this.scale;

        this.bossProjectilesGroup.getChildren().forEach((child: any) => {
            const projectile = child as Phaser.GameObjects.Arc;
            if (!projectile.active) return;

            const velocityX = projectile.getData('velocityX') || 0;
            const velocityY = projectile.getData('velocityY') || 0;

            projectile.x += velocityX * (delta / 16.66);
            projectile.y += velocityY * (delta / 16.66);

            // Check collision with ship
            const distance = Phaser.Math.Distance.Between(
                projectile.x, projectile.y,
                this.ship.x, this.ship.y
            );

            // Force Field Interaction
            if (this.forceFieldActive && distance < 150) { // Match visual force field radius
                // Bounce/Destroy on shield
                projectile.destroy();
                this.callbacks.onForceFieldHit(); // Play shield sound

                // Play shield hit sound/effect (visual feedback)
                const shieldHit = this.add.circle(this.ship.x, this.ship.y, 55, 0x00ffff, 0.5);
                this.tweens.add({
                    targets: shieldHit,
                    alpha: 0,
                    scale: 1.2,
                    duration: 200,
                    onComplete: () => shieldHit.destroy()
                });
                return;
            }

            if (distance < 30) {
                // Hit ship - penalize like wrong key (not destroy)
                projectile.destroy();

                // Shake ship for 1 second
                this.shakeShip();

                this.callbacks.onWrongKey();
                return;
            }

            // Remove if off screen
            if (projectile.x < -50 || projectile.x > width + 50 ||
                projectile.y < -50 || projectile.y > height + 50) {
                projectile.destroy();
            }
        });
    }

    private checkBossCollisions() {
        // Check if player bullets hit boss segments
        // This would need to be implemented with actual bullet tracking
        // For now, we'll handle it when player shoots at boss letters
    }

    // Modified to return the actual segment hit, not just boolean
    public hitBossSegment(letter: string): Phaser.GameObjects.Container | null {
        if (!this.bossActive) return null;

        // Find the FIRST segment that matches the letter AND has a letter visible
        // Exclude the head (isHead=true)
        const segment = this.bossSegments.find(s =>
            s.active &&
            !s.getData('isHead') &&
            s.getData('letter') === letter &&
            !s.getData('letterAbsorbed')
        );

        if (segment) {
            // Mark letter as absorbed
            segment.setData('letterAbsorbed', true);

            // Absorb the letter (visuals)
            this.absorbBossLetter(segment);

            // Check if all body segments are gone
            // FIX: Filter out spacers (isSpacer=true) or check if letter is present
            const remainingLetters = this.bossSegments.filter(s =>
                s.active &&
                !s.getData('isHead') &&
                !s.getData('isSpacer') && // Ignore spacers
                !s.getData('letterAbsorbed')
            ).length;

            if (remainingLetters === 0) {
                this.defeatBoss();
            }
            return segment;
        }

        return null;
    }

    private absorbBossLetter(segment: Phaser.GameObjects.Container) {
        // Get the text object (index 1 now, since glow removed)
        const letterText = segment.getAt(1) as Phaser.GameObjects.Text;

        if (!letterText) return;

        // Clone the text to animate it separately (so segment keeps moving)
        // Offset +10 to match new text position
        const flyingText = this.add.text(segment.x, segment.y + 10, letterText.text, {
            fontSize: letterText.style.fontSize,
            fontFamily: letterText.style.fontFamily,
            color: letterText.style.color,
            stroke: letterText.style.stroke,
            strokeThickness: letterText.style.strokeThickness
        }).setOrigin(0.5).setDepth(20);

        // Hide original text
        letterText.setVisible(false);

        // Change segment appearance to show it's "dead" but still there
        // FIX: segment.getAt(0) is now the Sprite (since glow was removed)
        // Previous order: Glow (0), Sprite (1), Text (2)
        // New order: Sprite (0), Text (1)

        const sprite = segment.getAt(0) as Phaser.GameObjects.Sprite;
        if (sprite && sprite.setTint) {
            sprite.setTint(0x555555); // Grey out
        }

        // Chain Extinction Logic
        const currentIndex = this.bossSegments.indexOf(segment);
        if (currentIndex !== -1) {
            // 1. Always dim the next 2 spacers (Standard behavior)
            // 2. If it's the LAST letter, dim EVERYTHING until the end (Tail)

            // Check if there are any more letters after this one
            const hasMoreLetters = this.bossSegments.slice(currentIndex + 1).some(s =>
                s.active && !s.getData('isSpacer') && !s.getData('letterAbsorbed')
            );

            let dimCount = 2; // Default: dim next 2 spacers
            if (!hasMoreLetters) {
                // Last letter: Dim everything until the end (Tail)
                dimCount = this.bossSegments.length - 1 - currentIndex;
            }

            // Apply dimming forward
            for (let i = 1; i <= dimCount; i++) {
                const nextSegment = this.bossSegments[currentIndex + i];
                if (nextSegment && nextSegment.active) {
                    const spacerSprite = nextSegment.getAt(0) as Phaser.GameObjects.Sprite;
                    if (spacerSprite && spacerSprite.setTint) {
                        spacerSprite.setTint(0x555555);
                    }
                }
            }

            // 3. First Letter Check (Index 3: Head=0, S=1, S=2, L=3)
            // If this is the first letter, dim the 2 preceding segments (spacers behind head)
            if (currentIndex === 3) {
                for (let i = 1; i <= 2; i++) {
                    const prevSegment = this.bossSegments[currentIndex - i];
                    if (prevSegment && prevSegment.active) {
                        const spacerSprite = prevSegment.getAt(0) as Phaser.GameObjects.Sprite;
                        if (spacerSprite && spacerSprite.setTint) {
                            spacerSprite.setTint(0x555555);
                        }
                    }
                }
            }
        }

        // Animate flying text
        this.tweens.add({
            targets: flyingText,
            scale: 1.5,
            duration: 100
        });

        this.tweens.add({
            targets: flyingText,
            alpha: 0,
            duration: 300,
            ease: 'Linear'
        });

        this.tweens.add({
            targets: flyingText,
            x: this.ship.x,
            y: this.ship.y,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                // Add score using the new callback that DOES NOT increment lettersDestroyed
                const points = 50; // Boss segment points
                this.callbacks.onScoreUpdateOnly(points);

                // Points text
                const pointsText = this.add.text(
                    this.ship.x,
                    this.ship.y - 30,
                    `+${points}`,
                    {
                        fontSize: '24px',
                        fontFamily: '"Press Start 2P", monospace',
                        color: '#ff00ff',
                        stroke: '#000000',
                        strokeThickness: 3
                    }
                ).setOrigin(0.5).setDepth(15);

                this.tweens.add({
                    targets: pointsText,
                    y: this.ship.y - 80,
                    alpha: 0,
                    ease: 'Power1',
                    duration: 800,
                    onComplete: () => pointsText.destroy()
                });

                flyingText.destroy();

                // DO NOT Destroy the segment here anymore
                // this.createExplosion(segment.x, segment.y, 0xff00aa);
                // segment.destroy();
            }
        });
    }

    private handleBossCollision() {
        // Player loses a life
        this.destroyShip(); // Trigger ship destruction animation (spin and fall immediately)
        this.callbacks.onShipDestroyed();

        // Boss Victory Dance (Large wave upwards)
        this.bossAttackPattern = 'victory';
        this.bossAttackTimer = 0;
        // Do NOT reset bossWaveTime to ensure continuous movement
        // this.bossWaveTime = 0;

        // Clear projectiles but keep boss
        this.bossProjectilesGroup.clear(true, true);

        // Stop normal boss movement updates (victory pattern will handle movement)
        // The victory pattern in updateBossAttackPattern will handle the wave movement
    }

    private defeatBoss() {
        if (!this.bossActive) return;

        // Prevent multiple calls
        this.bossActive = false;
        // Mark that boss was defeated for current stage to prevent respawn
        this.bossDefeatedForCurrentStage = true;
        // When boss is defeated, prevent spawning another boss until stage advances
        // Set to false to prevent respawn until stage advance completes
        this.bossHasExited = false; // Prevent respawn until stage advances

        this.bossProjectilesGroup.clear(true, true);

        // Stop all movement
        this.bossSegments.forEach(s => this.tweens.killTweensOf(s));
        if (this.bossHead) this.tweens.killTweensOf(this.bossHead);

        // Chain Reaction: Explode from Head to Tail
        this.bossSegments.forEach((segment, index) => {
            if (segment.active) {
                // Delay increases with index (Head is 0)
                // Much faster now because we have 3x segments
                this.time.delayedCall(index * 50, () => {
                    if (segment.active) {
                        // Different color for head vs body
                        const isHead = segment.getData('isHead');
                        // Random color for explosion
                        // Red, Yellow, Orange, White
                        const colors = [0xff0000, 0xffff00, 0xffa500, 0xffffff, 0x0000ff, 0x00ff00];

                        // Create SPECTACULAR explosion
                        this.createSpectacularExplosion(segment.x, segment.y, colors);
                        this.callbacks.onSegmentExplosion(); // Play segment boom sound

                        // If head, maybe a bit more flair but not blinding
                        if (isHead) {
                            this.cameras.main.shake(200, 0.01); // Subtle shake
                        }

                        segment.destroy();
                    }
                });
            }
        });

        // 2. Massive Flash AFTER Chain Reaction
        // Wait for chain reaction to finish
        // Total time = segments * delay + buffer
        const totalDuration = this.bossSegments.length * 50 + 1000;

        this.time.delayedCall(totalDuration, () => {
            // Create massive flash
            this.callbacks.onMassiveExplosion(); // Play massive blast sound
            this.createMassiveFlash();

            // Clean up
            this.bossSegments = [];
            this.bossTrail = [];
            this.bossGroup.clear(true, true);

            // Calculate next stage
            const nextStage = this.gameState.currentStage + 1;

            // Notify React to advance stage
            if (nextStage < TYPING_STAGES.length) {
                // Delay slightly more to let flash fade
                this.time.delayedCall(1000, () => {
                    // Reset boss exit flag when advancing stage to allow boss to spawn in new level
                    // MOVED TO UPDATE LOOP to avoid race condition
                    // this.bossHasExited = null; 
                    // this.bossDefeatedForCurrentStage = false; 
                    this.callbacks.onStageAdvance(nextStage);
                });
            }
        });
    }



    private createMassiveFlash() {
        const flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 1);
        flash.setOrigin(0, 0);
        flash.setBlendMode(Phaser.BlendModes.ADD);
        flash.setAlpha(0);

        this.tweens.add({
            targets: flash,
            alpha: { from: 1, to: 0 },
            duration: 1500,
            onComplete: () => flash.destroy()
        });

        this.cameras.main.shake(500, 0.03);
    }

    private getThresholdForStage(stage: number): number {
        // Use thresholds passed from Game.tsx
        if (this.gameState && this.gameState.thresholds) {
            return this.gameState.thresholds[stage] || this.gameState.thresholds[this.gameState.thresholds.length - 1];
        }
        return 999999; // Fallback safe value
    }
}
