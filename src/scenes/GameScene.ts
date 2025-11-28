import Phaser from 'phaser';
import { TYPING_STAGES, KEYBOARD_POSITIONS, type GameState, type FallingLetter } from '../types/game';

// Import assets
import naveImg from '../assets/images/nave.svg';
import enemyImg from '../assets/images/enemy.svg';

export interface GameSceneCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void;
    onLetterHit: (letterObj: FallingLetter) => { points: number; totalScore: number };
    onLetterMiss: () => void;
    onLetterEscaped: () => void;
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

    // Spawning logic
    private lastSpawnTime: number = 0;

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
    }

    update(time: number, delta: number) {
        // Safety check if init failed or not ready
        if (!this.gameState || !this.lettersGroup) return;

        // Update Ship Rotation and thruster positions (ALWAYS - even when paused)
        if (this.ship) {
            const rotation = Phaser.Math.DegToRad(this.shipAngle);
            this.ship.setRotation(rotation);

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

        // Game logic only runs when playing
        if (!this.gameState.isPlaying || this.gameState.isPaused || this.gameState.isPenalized) {
            return;
        }

        // Spawning
        if (time - this.lastSpawnTime > this.gameState.gameSpeed) {
            this.spawnLetter(time);
            this.lastSpawnTime = time;
        }

        // Update Letters with perspective movement
        const height = this.scale.height;
        const dangerZone = height * 0.6;
        const turnaroundPoint = height * 0.55; // Point where enemies reach "front" and start rising (55%)
        let hasDanger = false;

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

                // Check danger zone during approach
                if (letterContainer.y > dangerZone) {
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

                // Danger zone is more critical when rising
                hasDanger = true;
            }
        });

        this.callbacks.onProximityWarning(hasDanger);
    }

    private spawnLetter(time: number) {
        const stage = TYPING_STAGES[this.gameState.currentStage];
        if (!stage || !stage.letters.length) return;

        // Filter out last spawned if possible (simple random for now)
        const letterChar = stage.letters[Math.floor(Math.random() * stage.letters.length)];

        // Calculate target horizontal position (where letter will end up)
        const position = KEYBOARD_POSITIONS[letterChar];
        let targetX = Math.random() * (this.scale.width - 60);

        if (position) {
            const gameAreaWidth = this.scale.width;
            const keyboardMargin = Math.min(50, gameAreaWidth * 0.05);
            const availableWidth = gameAreaWidth - (keyboardMargin * 2);
            const maxColumns = 10;
            const columnWidth = availableWidth / maxColumns;
            targetX = keyboardMargin + (position.col * columnWidth);
            targetX = Math.max(30, Math.min(targetX, gameAreaWidth - 30));
        }

        // Calculate spawn X position (near center for perspective)
        const centerX = this.scale.width / 2;
        const displacementFromCenter = targetX - centerX;
        const spawnX = centerX + (displacementFromCenter * 0.05); // Start at 5% of displacement from center

        // Start from middle of screen (50% Y) with scale 0.1 (tiny but visible)
        const startY = this.scale.height * 0.5; // 50% from top
        const container = this.add.container(spawnX, startY);
        container.setScale(0.1); // Start tiny but visible

        // Add Enemy Image with random neon color
        const enemyColors = [0xFF10F0, 0x39FF14, 0x00FFFF, 0xFFFF00, 0xFF6600, 0xBF00FF];
        const enemyColor = enemyColors[Math.floor(Math.random() * enemyColors.length)];
        const sprite = this.add.image(0, 0, 'enemy');
        sprite.setDisplaySize(60, 60);
        sprite.setTint(enemyColor);

        // Add Text (30% below enemy center)
        const enemySize = 60;
        const letterOffset = enemySize * 0.3;
        const text = this.add.text(0, letterOffset, letterChar, {
            fontSize: '32px',
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

    private handleLetterEscaped(letterContainer: Phaser.GameObjects.Container) {
        letterContainer.destroy();
        this.callbacks.onLetterEscaped();
    }

    // Public method called from React
    public shootBullet(targetLetter: string) {
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

    public updateGameState(newState: GameState) {
        this.gameState = newState;
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
}
