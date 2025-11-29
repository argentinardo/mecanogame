import Phaser from 'phaser';
import { TYPING_STAGES, KEYBOARD_POSITIONS, type GameState, type FallingLetter } from '../types/game';

// Import assets
import naveImg from '../assets/images/nave.svg';
import enemyImg from '../assets/images/enemy.svg';
import asteroid1Img from '../assets/images/asteroid-01_40px.png';
import asteroid2Img from '../assets/images/asteroid-02-40px.png';
import asteroid3Img from '../assets/images/asteroid-03_40px.png';

export interface GameSceneCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void;
    onLetterHit: (letterObj: FallingLetter) => { points: number; totalScore: number };
    onLetterMiss: () => void;
    onLetterEscaped: () => void;
    onShipDestroyed: () => void; // New callback for ship destroyed by meteorite
    onWrongKey: () => void;
    onMeteoriteHit: () => void;
    onStageAdvance: (stage: number) => void;
    onGameOver: () => void;
    onProximityWarning: (hasWarning: boolean) => void;
    onCombo: (count: number, multiplier: number) => void;
    onSequentialBonus: (bonus: number) => void;
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

    // Force Field
    private forceField!: Phaser.GameObjects.Arc | null;
    private forceFieldActive: boolean = false;
    private forceFieldDuration: number = 3000; // 3 seconds
    private forceFieldStartTime: number = 0;

    // Spawning logic
    private lastSpawnTime: number = 0;
    private lastMeteoriteSpawnTime: number = 0;
    private meteoriteSpawnInterval: number = 8000; // Spawn meteorite every 8 seconds

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
        this.load.image('asteroid1', asteroid1Img);
        this.load.image('asteroid2', asteroid2Img);
        this.load.image('asteroid3', asteroid3Img);

        // Create particle texture programmatically (square)
        const graphics = this.make.graphics({ x: 0, y: 0 }, false);
        graphics.fillStyle(0xffff00, 1);
        graphics.fillRect(0, 0, 8, 8);
        graphics.generateTexture('particle', 8, 8);
    }

    create() {
        const { width, height } = this.scale;

        // Create Ship
        this.ship = this.add.sprite(width / 2, height - 200, 'nave');
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

        // Don't update letters during life lost countdown
        if (!this.gameState.isLifeLostPaused) {
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

        // Update meteorites (ALWAYS - except when life lost countdown)
        if (!this.gameState.isLifeLostPaused) {
            this.updateMeteorites(delta);
        }

        // Only check proximity warning when playing
        if (this.gameState.isPlaying && !this.gameState.isPaused && !this.gameState.isPenalized) {
            this.callbacks.onProximityWarning(hasDanger);
        }

        // Game logic only runs when playing (spawning, etc.)
        // Also pause if life lost countdown is active
        if (!this.gameState.isPlaying || this.gameState.isPaused || this.gameState.isPenalized || this.gameState.isLifeLostPaused) {
            return;
        }

        // Spawning letters
        if (time - this.lastSpawnTime > this.gameState.gameSpeed) {
            this.spawnLetter(time);
            this.lastSpawnTime = time;
        }

        // Spawning meteorites (only from sector 3 onwards)
        if (this.gameState.currentStage >= 3 && time - this.lastMeteoriteSpawnTime > this.meteoriteSpawnInterval) {
            this.spawnMeteorite(time);
            this.lastMeteoriteSpawnTime = time;
        }
    }

    private spawnLetter(time: number) {
        const stage = TYPING_STAGES[this.gameState.currentStage];
        if (!stage || !stage.letters.length) return;

        // Filter out last spawned if possible (simple random for now)
        const letterChar = stage.letters[Math.floor(Math.random() * stage.letters.length)];

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

        // Add Enemy Image with random neon color
        const enemyColors = [0xFF10F0, 0x39FF14, 0x00FFFF, 0xFFFF00, 0xFF6600, 0xBF00FF];
        const enemyColor = enemyColors[Math.floor(Math.random() * enemyColors.length)];
        const enemySize = 100;
        // Position enemy: 3% up, 0.5% left (relative to enemy size)
        const offsetY = -enemySize * 0.15; // 3% up (negative Y)
        const offsetX = -enemySize * 0.03; // 0.5% left (negative X)
        const sprite = this.add.image(offsetX, offsetY, 'enemy');
        sprite.setDisplaySize(enemySize, enemySize);
        sprite.setTint(enemyColor);

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
        const asteroidKey = `asteroid${Math.floor(Math.random() * 3) + 1}`;
        
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
        // Don't shoot if game is paused, penalized, or in life lost countdown
        if (!this.gameState.isPlaying || this.gameState.isPaused || this.gameState.isPenalized || this.gameState.isLifeLostPaused) {
            return;
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
            emitZone: { source: circle }
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
            scale: { start: 1.2, end: 0 },
            lifespan: 10000,
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
        // More impressive explosion for force field - multiple layers
        const cyanColor = 0x00ffff;
        const blueColor = 0x0088ff;
        const whiteColor = 0xffffff;

        // Layer 1: Fast outward particles (cyan)
        const fastParticles = this.add.particles(x, y, 'particle', {
            speed: { min: 200, max: 500 },
            scale: { start: 2.0, end: 0 },
            lifespan: 800,
            blendMode: 'ADD',
            quantity: 15,
            tint: cyanColor,
            angle: { min: 0, max: 360 },
            alpha: { start: 1, end: 0 }
        });

        // Layer 2: Medium speed particles (blue)
        const mediumParticles = this.add.particles(x, y, 'particle', {
            speed: { min: 150, max: 350 },
            scale: { start: 1.5, end: 0 },
            lifespan: 1000,
            blendMode: 'ADD',
            quantity: 10,
            tint: blueColor,
            angle: { min: 0, max: 360 },
            alpha: { start: 0.8, end: 0 }
        });

        // Layer 3: Slow bright particles (white/cyan mix)
        const slowParticles = this.add.particles(x, y, 'particle', {
            speed: { min: 50, max: 200 },
            scale: { start: 1.8, end: 0 },
            lifespan: 1200,
            blendMode: 'ADD',
            quantity: 8,
            tint: [cyanColor, whiteColor],
            angle: { min: 0, max: 360 },
            alpha: { start: 1, end: 0 }
        });

        // Create expanding circle effect
        const circle = this.add.circle(x, y, 0, cyanColor, 0.5);
        circle.setStrokeStyle(3, cyanColor, 1);
        circle.setBlendMode(Phaser.BlendModes.ADD);
        circle.setDepth(10);

        // Expand and fade circle
        this.tweens.add({
            targets: circle,
            radius: 200,
            alpha: 0,
            duration: 400,
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
        // Reduced explosion (10% of force field particles) when meteorite hits ship
        const orangeColor = 0xff6600;
        const redColor = 0xff0000;
        const yellowColor = 0xffff00;

        // Layer 1: Fast outward particles (10% = 1.5 -> 2 particles)
        const fastParticles = this.add.particles(x, y, 'particle', {
            speed: { min: 200, max: 500 },
            scale: { start: 2.0, end: 0 },
            lifespan: 800,
            blendMode: 'ADD',
            quantity: 2, // 10% of 15
            tint: orangeColor,
            angle: { min: 0, max: 360 },
            alpha: { start: 1, end: 0 }
        });

        // Layer 2: Medium speed particles (10% = 1 particle)
        const mediumParticles = this.add.particles(x, y, 'particle', {
            speed: { min: 150, max: 350 },
            scale: { start: 1.5, end: 0 },
            lifespan: 1000,
            blendMode: 'ADD',
            quantity: 1, // 10% of 10
            tint: redColor,
            angle: { min: 0, max: 360 },
            alpha: { start: 0.8, end: 0 }
        });

        // Layer 3: Slow bright particles (10% = 1 particle)
        const slowParticles = this.add.particles(x, y, 'particle', {
            speed: { min: 50, max: 200 },
            scale: { start: 1.8, end: 0 },
            lifespan: 1200,
            blendMode: 'ADD',
            quantity: 1, // 10% of 8
            tint: [orangeColor, yellowColor],
            angle: { min: 0, max: 360 },
            alpha: { start: 1, end: 0 }
        });

        // Auto destroy emitters after use
        this.time.delayedCall(1200, () => {
            fastParticles.destroy();
            mediumParticles.destroy();
            slowParticles.destroy();
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

        // Make ship explode and disappear (similar to enemy destruction)
        this.tweens.add({
            targets: this.ship,
            scaleX: this.ship.scaleX * 2,
            scaleY: this.ship.scaleY * 2,
            alpha: 0,
            rotation: this.ship.rotation + Math.PI * 2,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                // Ship will be recreated when game resumes, so we don't destroy it
                // Just hide it temporarily
                this.ship.setVisible(false);
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
            
            // Restart thrusters
            const leftThruster = (this.ship as any).leftThruster;
            const rightThruster = (this.ship as any).rightThruster;
            if (leftThruster) leftThruster.start();
            if (rightThruster) rightThruster.start();
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

    public activateForceField() {
        // Don't activate if game is not playing, paused, penalized, or in life lost countdown
        if (!this.gameState.isPlaying || this.gameState.isPaused || this.gameState.isPenalized || this.gameState.isLifeLostPaused) {
            return;
        }

        if (this.forceFieldActive) return; // Already active

        this.forceFieldActive = true;
        this.forceFieldStartTime = this.time.now;

        // Create force field circle around ship
        this.forceField = this.add.circle(
            this.ship.x,
            this.ship.y,
            150, // radius
            0x00ffff, // cyan color
            0.3 // alpha
        );
        this.forceField.setStrokeStyle(4, 0x00ffff, 1);
        this.forceField.setDepth(9);
        this.forceField.setBlendMode(Phaser.BlendModes.ADD);

        // Pulse animation
        this.tweens.add({
            targets: this.forceField,
            scaleX: 1.2,
            scaleY: 1.2,
            alpha: 0.5,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Auto deactivate after duration
        this.time.delayedCall(this.forceFieldDuration, () => {
            this.deactivateForceField();
        });
    }

    private deactivateForceField() {
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
}
