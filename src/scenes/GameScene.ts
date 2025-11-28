import Phaser from 'phaser';
import { TYPING_STAGES, KEYBOARD_POSITIONS, type GameState, type FallingLetter } from '../types/game';

// Import assets
import naveImg from '../assets/images/nave.svg';
import enemyImg from '../assets/images/enemy.svg';

export interface GameSceneCallbacks {
    onScoreChange: (score: number) => void;
    onLivesChange: (lives: number) => void;
    onLetterHit: (letterObj: FallingLetter) => void;
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
        graphics.fillStyle(0xffff00, 1); // Yellow
        graphics.fillRect(0, 0, 8, 8);
        graphics.generateTexture('particle', 8, 8);
    }

    create() {
        const { width, height } = this.scale;

        // Create Ship (100% higher up)
        this.ship = this.add.sprite(width / 2, height - 200, 'nave');
        this.ship.setScale(0.2);
        this.ship.setDepth(10);

        // Groups
        this.lettersGroup = this.add.group();
    }

    update(time: number, delta: number) {
        // Safety check if init failed or not ready
        if (!this.gameState || !this.lettersGroup) return;

        if (!this.gameState.isPlaying || this.gameState.isPaused || this.gameState.isPenalized) {
            return;
        }

        // Spawning
        if (time - this.lastSpawnTime > this.gameState.gameSpeed) {
            this.spawnLetter(time);
            this.lastSpawnTime = time;
        }

        // Update Letters
        const height = this.scale.height;
        const dangerZone = height * 0.6;
        let hasDanger = false;

        this.lettersGroup.getChildren().forEach((child: any) => {
            const letterContainer = child as Phaser.GameObjects.Container;
            if (!letterContainer.active) return;

            // Skip if letter has been hit
            if (letterContainer.getData('hit')) return;

            const speed = letterContainer.getData('speed');

            // Move down
            letterContainer.y += speed * (delta / 16.66); // Normalize to 60fps

            // Check bounds
            if (letterContainer.y > height) {
                this.handleLetterEscaped(letterContainer);
            }

            // Check danger zone
            if (letterContainer.y > dangerZone) {
                hasDanger = true;
            }
        });

        this.callbacks.onProximityWarning(hasDanger);

        // Update Ship Rotation
        if (this.ship) {
            this.ship.setRotation(Phaser.Math.DegToRad(this.shipAngle));
        }
    }

    private spawnLetter(time: number) {
        const stage = TYPING_STAGES[this.gameState.currentStage];
        if (!stage || !stage.letters.length) return;

        // Filter out last spawned if possible (simple random for now)
        const letterChar = stage.letters[Math.floor(Math.random() * stage.letters.length)];

        // Calculate Position
        const position = KEYBOARD_POSITIONS[letterChar];
        let x = Math.random() * (this.scale.width - 60);

        if (position) {
            const gameAreaWidth = this.scale.width;
            const keyboardMargin = Math.min(50, gameAreaWidth * 0.05);
            const availableWidth = gameAreaWidth - (keyboardMargin * 2);
            const maxColumns = 10;
            const columnWidth = availableWidth / maxColumns;
            x = keyboardMargin + (position.col * columnWidth);
            x = Math.max(30, Math.min(x, gameAreaWidth - 30));
        }

        // Create Container
        const container = this.add.container(x, -50);

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
        container.setData('color', enemyColor);

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

        // Target the lowest one (highest Y)
        targets.sort((a, b) => b.y - a.y);
        const target = targets[0];

        // Calculate angle for ship rotation
        const angle = Phaser.Math.Angle.Between(this.ship.x, this.ship.y, target.x, target.y);
        this.shipAngle = Phaser.Math.RadToDeg(angle) + 90;

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
        const enemyRadius = 50; // Half of enemy size (60/2)
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

        // Notify React
        const letterObj: FallingLetter = {
            letter: target.getData('letter'),
            x: target.x,
            y: target.y,
            speed: target.getData('speed'),
            id: target.getData('id')
        };
        this.callbacks.onLetterHit(letterObj);

        // Wait 500ms, then absorb only the letter into ship
        this.time.delayedCall(500, () => {
            if (!target.active) return; // Already destroyed

            // Make letter bigger and brighter while being absorbed
            this.tweens.add({
                targets: letterText,
                scale: 1.5,
                duration: 100
            });

            // Animate letter container moving to ship
            this.tweens.add({
                targets: target,
                x: this.ship.x,
                y: this.ship.y,
                duration: 300,
                ease: 'Power2',
                onComplete: () => {
                    target.destroy();
                }
            });

            // Fade out letter as it gets closer
            this.tweens.add({
                targets: letterText,
                alpha: 0,
                duration: 300,
                delay: 200
            });
        });
    }

    private createExplosion(x: number, y: number, color: number) {
        // Colored particle explosion - fewer, faster, spread farther
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
