import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Phaser from 'phaser';
import { GameScene, type GameSceneCallbacks } from '../scenes/GameScene';
import type { GameState } from '../types/game';

interface PhaserGameProps {
    gameState: GameState;
    callbacks: GameSceneCallbacks;
    onGameReady?: (game: Phaser.Game) => void;
}

export interface PhaserGameRef {
    shootBullet: (targetLetter: string) => void;
    activateForceField: () => void;
}

export const PhaserGame = forwardRef<PhaserGameRef, PhaserGameProps>(({
    gameState,
    callbacks,
    onGameReady
}, ref) => {
    const gameRef = useRef<HTMLDivElement>(null);
    const phaserGameRef = useRef<Phaser.Game | null>(null);

    useImperativeHandle(ref, () => ({
        shootBullet: (targetLetter: string) => {
            if (phaserGameRef.current) {
                const scene = phaserGameRef.current.scene.getScene('GameScene') as GameScene;
                if (scene) {
                    scene.shootBullet(targetLetter);
                }
            }
        },
        activateForceField: () => {
            if (phaserGameRef.current) {
                const scene = phaserGameRef.current.scene.getScene('GameScene') as GameScene;
                if (scene) {
                    scene.activateForceField();
                }
            }
        }
    }));

    useEffect(() => {
        if (!gameRef.current || phaserGameRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width: window.innerWidth,
            height: window.innerHeight,
            parent: gameRef.current,
            scene: undefined, // Don't add scene here, we add it manually below
            transparent: true, // Make canvas transparent so React background shows if needed
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0, x: 0 },
                    debug: false
                }
            },
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH
            }
        };

        const game = new Phaser.Game(config);
        phaserGameRef.current = game;

        // Manually add and start the scene with data
        game.scene.add('GameScene', GameScene);
        game.scene.start('GameScene', { gameState, callbacks });


        if (onGameReady) {
            onGameReady(game);
        }

        return () => {
            if (phaserGameRef.current) {
                phaserGameRef.current.destroy(true);
                phaserGameRef.current = null;
            }
        };
    }, []);

    // Actualizar el estado del juego cuando cambie
    useEffect(() => {
        if (phaserGameRef.current) {
            const scene = phaserGameRef.current.scene.getScene('GameScene') as GameScene;
            if (scene && scene.updateGameState) {
                // Actualizar el estado en la escena
                scene.updateGameState(gameState);

                // Pausar/reanudar según el estado (pausa tradicional o pausa por pérdida de vida)
                if (gameState.isPaused || gameState.isLifeLostPaused) {
                    scene.setPaused(true);
                } else {
                    scene.setPaused(false);
                }
            }
        }
    }, [gameState]);

    return <div ref={gameRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0, pointerEvents: gameState.isPaused ? 'none' : 'auto' }} />;
});
