import { useRef, useCallback, useEffect, useState } from 'react';
import mainThemeUrl from '../assets/sound/mecanogame_main-theme.mp3';
import menuThemeUrl from '../assets/sound/mecanogame_menu-theme.mp3';
import laserUrl from '../assets/sound/mecanogame_laser.mp3';
import blastUrl from '../assets/sound/mecanogame_blast.mp3';
import lostLifeUrl from '../assets/sound/mecanogame_lost-life.mp3';
import lostLife2Url from '../assets/sound/mecanogame_lost-life-2.mp3';
import gameOverUrl from '../assets/sound/mecanogame_game-over.mp3';
import scoringUrl from '../assets/sound/mecanogame_scoring.mp3';
import pointUrl from '../assets/sound/mecanogame_point.mp3';
import bossSongUrl from '../assets/sound/mecanogame_boss-song.mp3';
import bossSpawnUrl from '../assets/sound/mecanogame_boss.mp3';
import centipedeShotUrl from '../assets/sound/mecanogame_centipede-shot.mp3';
import fieldForceUrl from '../assets/sound/mecanogame_field-force.mp3';
import segmentBoomUrl from '../assets/sound/mecanogame_segment-boom.mp3';
import bossLaughUrl from '../assets/sound/mecanogame_boss-laugh.mp3';
import enemyDeathUrl from '../assets/sound/mecanogame_enemy-death.mp3';

export const useAudio = () => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const [isMuted, setIsMuted] = useState(() => {
        const saved = localStorage.getItem('mecanogame_muted');
        return saved !== null ? JSON.parse(saved) : true; // Default to true if not saved
    });
    const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
    const bossMusicRef = useRef<HTMLAudioElement | null>(null);
    const menuMusicRef = useRef<HTMLAudioElement | null>(null);
    const bossLaughRef = useRef<HTMLAudioElement | null>(null);
    const normalVolumeRef = useRef<number>(0.3);

    // Initialize AudioContext (kept for legacy or specific needs, but mostly using HTML5 Audio now)
    const initAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        }
        return audioContextRef.current;
    }, []);

    // Helper to play a sound file
    const playSound = useCallback((url: string, volume: number = 0.5) => {
        if (isMuted) return;
        const audio = new Audio(url);
        audio.volume = volume;
        audio.play().catch(e => console.error("Error playing sound:", url, e));
    }, [isMuted]);

    // --- Sound Effects ---

    const playShootSound = useCallback(() => {
        playSound(laserUrl, 0.15);
    }, [playSound]);

    const playExplosionSound = useCallback(() => {
        playSound(blastUrl, 0.2);
    }, [playSound]);

    const playMissSound = useCallback(() => {
        playSound(lostLife2Url, 0.2); // Using lost-life-2 as "miss/error" sound
    }, [playSound]);

    const playLifeLostSound = useCallback(() => {
        playSound(lostLifeUrl, 0.3);
    }, [playSound]);

    const playGameOverSound = useCallback(() => {
        playSound(gameOverUrl, 0.4);
    }, [playSound]);

    const playLevelUpSound = useCallback(() => {
        playSound(scoringUrl, 0.3);
    }, [playSound]);

    const playComboSuccessSound = useCallback(() => {
        playSound(pointUrl, 0.2);
    }, [playSound]);

    const playScoringSound = useCallback(() => {
        playSound(scoringUrl, 0.25);
    }, [playSound]);

    const playBlastSound = useCallback(() => {
        playSound(blastUrl, 0.4); // Louder blast for massive explosion
    }, [playSound]);

    const playEnemyDeathSound = useCallback(() => {
        playSound(enemyDeathUrl, 0.25);
    }, [playSound]);

    const playMeteoriteSound = useCallback(() => {
        // Keep synthetic or find a file?
        // Using a low pitch blast for now or synthetic if preferred.
        // Let's stick to synthetic for meteorite to keep it distinct if no specific file
        // Or re-use blast with lower volume?
        // Let's use blastUrl but quieter
        playSound(blastUrl, 0.1);
    }, [playSound]);

    const playProximityBeep = useCallback(() => {
        // Keep synthetic beep as it's functional
        if (isMuted) return;
        const ctx = initAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    }, [isMuted, initAudioContext]);

    const playCountdownSound = useCallback((number: number) => {
        // Keep synthetic for countdown clarity
        if (isMuted) return;
        const ctx = initAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const freq = number === 0 ? 1200 : (number === 1 ? 1000 : 800);
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.type = 'square';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    }, [isMuted, initAudioContext]);

    // --- New Boss Sounds ---

    const playBossShot = useCallback(() => {
        playSound(centipedeShotUrl, 0.25);
    }, [playSound]);

    const playForceFieldHit = useCallback(() => {
        playSound(fieldForceUrl, 0.3);
    }, [playSound]);

    const playSegmentExplosion = useCallback(() => {
        playSound(segmentBoomUrl, 0.2);
    }, [playSound]);

    const playBossSpawn = useCallback(() => {
        // playSound(bossSpawnUrl, 0.35); // Disabled as per user request
    }, []);

    const playBossLaugh = useCallback(() => {
        // Stop previous laugh if any
        if (bossLaughRef.current) {
            bossLaughRef.current.pause();
            bossLaughRef.current = null;
        }
        const audio = new Audio(bossLaughUrl);
        audio.volume = 0.35;
        audio.play().catch(console.error);
        bossLaughRef.current = audio;
    }, []);

    const stopBossLaugh = useCallback(() => {
        if (bossLaughRef.current) {
            bossLaughRef.current.pause();
            bossLaughRef.current = null;
        }
    }, []);

    // --- Music Control ---

    const musicTypeRef = useRef<'menu' | 'background' | 'boss' | 'none'>('none');
    const gameOverMusicRef = useRef<HTMLAudioElement | null>(null);

    const fadeIntervalRef = useRef<number | null>(null);

    const stopAllMusic = useCallback(() => {
        if (menuMusicRef.current) {
            menuMusicRef.current.pause();
            menuMusicRef.current = null;
        }
        if (backgroundMusicRef.current) {
            backgroundMusicRef.current.pause();
            // Don't null background music ref if we want to resume it later, 
            // but for strict exclusivity we pause it.
        }
        if (bossMusicRef.current) {
            bossMusicRef.current.pause();
            bossMusicRef.current = null;
        }
        // Clear fade interval
        if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
        }
    }, []);

    const startMenuMusic = useCallback(() => {
        musicTypeRef.current = 'menu';
        if (isMuted) return;

        // Stop all other music first
        stopAllMusic();

        if (menuMusicRef.current && !menuMusicRef.current.paused) return;

        const audio = new Audio(menuThemeUrl);
        audio.loop = true;
        audio.volume = normalVolumeRef.current;
        audio.play().catch(console.error);
        menuMusicRef.current = audio;
    }, [isMuted, stopAllMusic]);

    const stopMenuMusic = useCallback(() => {
        if (menuMusicRef.current) {
            menuMusicRef.current.pause();
            menuMusicRef.current = null;
        }
    }, []);

    const startBackgroundMusic = useCallback(() => {
        musicTypeRef.current = 'background';
        if (isMuted) return;

        // Stop menu music and boss music explicitly
        if (menuMusicRef.current) {
            menuMusicRef.current.pause();
            menuMusicRef.current = null;
        }
        if (bossMusicRef.current) {
            bossMusicRef.current.pause();
            bossMusicRef.current = null;
        }

        // Clear fade interval if any
        if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
        }

        if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) return;

        if (backgroundMusicRef.current) {
            backgroundMusicRef.current.volume = normalVolumeRef.current; // Ensure volume is reset
            backgroundMusicRef.current.play().catch(console.error);
        } else {
            const audio = new Audio(mainThemeUrl);
            audio.loop = true;
            audio.volume = normalVolumeRef.current;
            audio.play().catch(console.error);
            backgroundMusicRef.current = audio;
        }
    }, [isMuted]);

    const startBossMusic = useCallback(() => {
        musicTypeRef.current = 'boss';
        if (isMuted) return;

        // Stop menu music immediately
        if (menuMusicRef.current) {
            menuMusicRef.current.pause();
            menuMusicRef.current = null;
        }

        // Clear any existing fade interval
        if (fadeIntervalRef.current) {
            clearInterval(fadeIntervalRef.current);
            fadeIntervalRef.current = null;
        }

        // Fade out background music and then pause
        if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
            const bgAudio = backgroundMusicRef.current;
            const startVolume = bgAudio.volume;
            const fadeDuration = 800; // 0.8 second fade (faster)
            const steps = 10;
            const stepTime = fadeDuration / steps;
            const volStep = startVolume / steps;

            let currentStep = 0;
            fadeIntervalRef.current = window.setInterval(() => {
                currentStep++;
                const newVol = Math.max(0, startVolume - (volStep * currentStep));
                bgAudio.volume = newVol;

                if (currentStep >= steps) {
                    if (fadeIntervalRef.current) {
                        clearInterval(fadeIntervalRef.current);
                        fadeIntervalRef.current = null;
                    }
                    bgAudio.pause();
                    bgAudio.volume = normalVolumeRef.current; // Reset volume for when it resumes
                }
            }, stepTime);
        }

        if (bossMusicRef.current && !bossMusicRef.current.paused) return;

        const audio = new Audio(bossSongUrl);
        audio.loop = true;
        audio.volume = normalVolumeRef.current;
        audio.play().catch(console.error);
        bossMusicRef.current = audio;
    }, [isMuted]);

    const stopBackgroundMusic = useCallback(() => {
        if (backgroundMusicRef.current) {
            backgroundMusicRef.current.pause();
        }
        if (bossMusicRef.current) {
            bossMusicRef.current.pause();
            bossMusicRef.current = null; // Reset boss music so it restarts next time
        }
    }, []);

    const lowerBackgroundVolume = useCallback(() => {
        if (backgroundMusicRef.current) backgroundMusicRef.current.volume = normalVolumeRef.current * 0.3;
        if (bossMusicRef.current) bossMusicRef.current.volume = normalVolumeRef.current * 0.3;
        if (menuMusicRef.current) menuMusicRef.current.volume = normalVolumeRef.current * 0.3;
    }, []);

    const restoreBackgroundVolume = useCallback(() => {
        if (backgroundMusicRef.current) backgroundMusicRef.current.volume = normalVolumeRef.current;
        if (bossMusicRef.current) bossMusicRef.current.volume = normalVolumeRef.current;
        if (menuMusicRef.current) menuMusicRef.current.volume = normalVolumeRef.current;
    }, []);

    const startGameOverMusic = useCallback(() => {
        if (isMuted) return;

        // Stop all other music
        if (backgroundMusicRef.current) {
            backgroundMusicRef.current.pause();
        }
        if (bossMusicRef.current) {
            bossMusicRef.current.pause();
            bossMusicRef.current = null;
        }
        if (menuMusicRef.current) {
            menuMusicRef.current.pause();
            menuMusicRef.current = null;
        }

        // Play Game Over music (mecanogame_boss.mp3)
        if (!gameOverMusicRef.current || gameOverMusicRef.current.paused) {
            const audio = new Audio(bossSpawnUrl);
            audio.loop = true;
            audio.volume = normalVolumeRef.current;
            audio.play().catch(console.error);
            gameOverMusicRef.current = audio;
        }
    }, [isMuted]);

    const stopGameOverMusic = useCallback(() => {
        if (gameOverMusicRef.current) {
            gameOverMusicRef.current.pause();
            gameOverMusicRef.current = null;
        }
    }, []);

    const toggleMute = useCallback(() => {
        setIsMuted((prev: boolean) => {
            const newMuted = !prev;
            localStorage.setItem('mecanogame_muted', JSON.stringify(newMuted));

            if (newMuted) {
                // Mute all
                if (backgroundMusicRef.current) backgroundMusicRef.current.pause();
                if (bossMusicRef.current) bossMusicRef.current.pause();
                if (menuMusicRef.current) menuMusicRef.current.pause();

                // Clear any fade interval
                if (fadeIntervalRef.current) {
                    clearInterval(fadeIntervalRef.current);
                    fadeIntervalRef.current = null;
                }
            } else {
                // Resume based on active music type
                const type = musicTypeRef.current;

                if (type === 'boss') {
                    if (!bossMusicRef.current) {
                        const audio = new Audio(bossSongUrl);
                        audio.loop = true;
                        audio.volume = normalVolumeRef.current;
                        bossMusicRef.current = audio;
                    }
                    bossMusicRef.current.play().catch(console.error);
                    // Ensure background is paused
                    if (backgroundMusicRef.current) backgroundMusicRef.current.pause();

                } else if (type === 'background') {
                    if (!backgroundMusicRef.current) {
                        const audio = new Audio(mainThemeUrl);
                        audio.loop = true;
                        audio.volume = normalVolumeRef.current;
                        backgroundMusicRef.current = audio;
                    }
                    backgroundMusicRef.current.volume = normalVolumeRef.current;
                    backgroundMusicRef.current.play().catch(console.error);
                    // Ensure boss is paused
                    if (bossMusicRef.current) bossMusicRef.current.pause();

                } else if (type === 'menu') {
                    if (!menuMusicRef.current) {
                        const audio = new Audio(menuThemeUrl);
                        audio.loop = true;
                        audio.volume = normalVolumeRef.current;
                        menuMusicRef.current = audio;
                    }
                    menuMusicRef.current.play().catch(console.error);
                }
            }
            return newMuted;
        });
    }, []);

    useEffect(() => {
        return () => {
            if (backgroundMusicRef.current) backgroundMusicRef.current.pause();
            if (bossMusicRef.current) bossMusicRef.current.pause();
            if (menuMusicRef.current) menuMusicRef.current.pause();
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, []);

    return {
        playShootSound,
        playEnemyDeathSound,
        playExplosionSound,
        playMissSound,
        playLifeLostSound,
        playGameOverSound,
        playLevelUpSound,
        playComboSuccessSound,
        playScoringSound,
        playBlastSound,
        playMeteoriteSound,
        playProximityBeep,
        playCountdownSound,
        playBossShot,
        playForceFieldHit,
        playSegmentExplosion,
        playBossSpawn,
        playBossLaugh,
        startBackgroundMusic,
        startBossMusic,
        startMenuMusic,
        stopMenuMusic,
        stopBackgroundMusic,
        startGameOverMusic,
        stopGameOverMusic,
        lowerBackgroundVolume,
        restoreBackgroundVolume,
        initAudioContext,
        toggleMute,
        isMuted,
        stopBossLaugh
    };
}; 