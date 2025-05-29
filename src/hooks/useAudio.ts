import { useRef, useCallback, useEffect, useState } from 'react';
import mainThemeUrl from '../assets/sound/main-theme.mp3';

export const useAudio = () => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
    const [isMuted, setIsMuted] = useState(false);
    const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);

    // Inicializar AudioContext
    const initAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        }
        return audioContextRef.current;
    }, []);

    // Crear audio sintético más complejo para efectos 16-bit
    const createComplexSound = useCallback((config: {
        frequencies: number[];
        durations: number[];
        types: OscillatorType[];
        volumes: number[];
        delays: number[];
        effects?: {
            distortion?: boolean;
            reverb?: boolean;
            filter?: { frequency: number; type: BiquadFilterType };
        };
    }) => {
        if (isMuted) return;
        
        const audioContext = initAudioContext();
        
        config.frequencies.forEach((freq, index) => {
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                let finalNode: AudioNode = gainNode;

                // Aplicar filtros si se especifican
                if (config.effects?.filter) {
                    const filter = audioContext.createBiquadFilter();
                    filter.type = config.effects.filter.type;
                    filter.frequency.setValueAtTime(config.effects.filter.frequency, audioContext.currentTime);
                    oscillator.connect(filter);
                    filter.connect(gainNode);
                } else {
                    oscillator.connect(gainNode);
                }

                // Aplicar distorsión si se especifica
                if (config.effects?.distortion) {
                    const waveshaper = audioContext.createWaveShaper();
                    const samples = 44100;
                    const curve = new Float32Array(samples);
                    const deg = Math.PI / 180;
                    for (let i = 0; i < samples; i++) {
                        const x = (i * 2) / samples - 1;
                        curve[i] = ((3 + 20) * x * 20 * deg) / (Math.PI + 20 * Math.abs(x));
                    }
                    waveshaper.curve = curve;
                    waveshaper.oversample = '4x';
                    
                    gainNode.connect(waveshaper);
                    finalNode = waveshaper;
                }

                finalNode.connect(audioContext.destination);

                oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
                oscillator.type = config.types[index] || 'square';

                const volume = config.volumes[index] || 0.1;
                const duration = config.durations[index] || 0.1;
                
                gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + duration);
            }, config.delays[index] || 0);
        });
    }, [initAudioContext, isMuted]);

    // Sonido de disparo techno mejorado
    const playShootSound = useCallback(() => {
        createComplexSound({
            frequencies: [1200, 800, 1600, 600],
            durations: [0.05, 0.08, 0.03, 0.1],
            types: ['sawtooth', 'square', 'triangle', 'sawtooth'],
            volumes: [0.15, 0.12, 0.08, 0.1],
            delays: [0, 20, 40, 60],
            effects: {
                filter: { frequency: 2000, type: 'lowpass' },
                distortion: true
            }
        });
    }, [createComplexSound]);

    // Sonido de explosión techno mejorado
    const playExplosionSound = useCallback(() => {
        createComplexSound({
            frequencies: [300, 150, 75, 200, 100, 50],
            durations: [0.2, 0.3, 0.4, 0.25, 0.35, 0.5],
            types: ['sawtooth', 'square', 'triangle', 'sawtooth', 'square', 'triangle'],
            volumes: [0.2, 0.18, 0.15, 0.12, 0.1, 0.08],
            delays: [0, 50, 100, 150, 200, 250],
            effects: {
                distortion: true,
                filter: { frequency: 800, type: 'lowpass' }
            }
        });
    }, [createComplexSound]);

    // Sonido de fallo techno mejorado
    const playMissSound = useCallback(() => {
        createComplexSound({
            frequencies: [400, 300, 200, 150],
            durations: [0.15, 0.2, 0.25, 0.3],
            types: ['sawtooth', 'square', 'sawtooth', 'triangle'],
            volumes: [0.15, 0.12, 0.1, 0.08],
            delays: [0, 80, 160, 240],
            effects: {
                filter: { frequency: 600, type: 'lowpass' },
                distortion: true
            }
        });
    }, [createComplexSound]);

    // Sonido de vida perdida techno mejorado
    const playLifeLostSound = useCallback(() => {
        createComplexSound({
            frequencies: [523, 440, 349, 293, 220],
            durations: [0.3, 0.4, 0.5, 0.6, 0.8],
            types: ['sine', 'triangle', 'sawtooth', 'square', 'triangle'],
            volumes: [0.15, 0.13, 0.11, 0.09, 0.07],
            delays: [0, 200, 400, 600, 800],
            effects: {
                filter: { frequency: 1000, type: 'lowpass' }
            }
        });
    }, [createComplexSound]);

    // Sonido de game over techno mejorado
    const playGameOverSound = useCallback(() => {
        createComplexSound({
            frequencies: [659, 554, 440, 349, 293, 220, 175],
            durations: [0.4, 0.4, 0.4, 0.4, 0.4, 0.6, 1.0],
            types: ['sine', 'triangle', 'sawtooth', 'square', 'triangle', 'sawtooth', 'sine'],
            volumes: [0.12, 0.11, 0.1, 0.09, 0.08, 0.07, 0.05],
            delays: [0, 300, 600, 900, 1200, 1500, 1800],
            effects: {
                filter: { frequency: 800, type: 'lowpass' }
            }
        });
    }, [createComplexSound]);

    // Sonido de level up techno mejorado
    const playLevelUpSound = useCallback(() => {
        createComplexSound({
            frequencies: [523, 659, 784, 1047, 1319],
            durations: [0.2, 0.2, 0.2, 0.3, 0.4],
            types: ['sine', 'triangle', 'sawtooth', 'square', 'sine'],
            volumes: [0.1, 0.12, 0.14, 0.16, 0.18],
            delays: [0, 150, 300, 450, 600],
            effects: {
                filter: { frequency: 3000, type: 'highpass' },
                distortion: false
            }
        });
    }, [createComplexSound]);

    // Sonido de meteorito apareciendo
    const playMeteoriteSound = useCallback(() => {
        createComplexSound({
            frequencies: [200, 150, 100, 80],
            durations: [0.3, 0.4, 0.5, 0.6],
            types: ['sawtooth', 'triangle', 'sawtooth', 'sine'],
            volumes: [0.08, 0.06, 0.05, 0.04],
            delays: [0, 100, 200, 300],
            effects: {
                filter: { frequency: 400, type: 'lowpass' },
                distortion: true
            }
        });
    }, [createComplexSound]);

    // Iniciar música de fondo desde archivo MP3
    const startBackgroundMusic = useCallback(() => {
        if (isMuted) return;
        
        // Si ya existe y está reproduciéndose, no hacer nada
        if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
            return;
        }
        
        // Detener y limpiar música anterior si existe
        if (backgroundMusicRef.current) {
            backgroundMusicRef.current.pause();
            backgroundMusicRef.current.removeEventListener('canplaythrough', () => {});
            backgroundMusicRef.current.removeEventListener('error', () => {});
            backgroundMusicRef.current.src = '';
            backgroundMusicRef.current = null;
        }

        // Crear nuevo elemento de audio
        const audio = new Audio(mainThemeUrl);
        audio.loop = true;
        audio.volume = 0.3; // Volumen moderado para no opacar los efectos
        audio.preload = 'auto';
        
        // Configurar eventos
        const canPlayHandler = () => {
            if (!isMuted && backgroundMusicRef.current === audio) {
                audio.play().catch(console.error);
            }
        };
        
        const errorHandler = (e: Event) => {
            console.error('Error cargando música de fondo:', e);
        };
        
        audio.addEventListener('canplaythrough', canPlayHandler, { once: true });
        audio.addEventListener('error', errorHandler);

        backgroundMusicRef.current = audio;
        
        // Cargar el archivo
        audio.load();
    }, [isMuted]);

    // Detener música de fondo
    const stopBackgroundMusic = useCallback(() => {
        if (backgroundMusicRef.current) {
            backgroundMusicRef.current.pause();
            backgroundMusicRef.current.currentTime = 0;
            // No limpiar completamente aquí para permitir reanudar
        }
    }, []);

    // Toggle mute/unmute
    const toggleMute = useCallback(() => {
        setIsMuted(prev => {
            const newMuted = !prev;
            
            if (backgroundMusicRef.current) {
                if (newMuted) {
                    backgroundMusicRef.current.pause();
                } else {
                    backgroundMusicRef.current.play().catch(console.error);
                }
            }
            
            return newMuted;
        });
    }, []);

    // Limpiar recursos al desmontar
    useEffect(() => {
        return () => {
            if (backgroundMusicRef.current) {
                backgroundMusicRef.current.pause();
                backgroundMusicRef.current.src = '';
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            audioElementsRef.current.forEach(audio => {
                audio.pause();
                audio.src = '';
            });
            audioElementsRef.current.clear();
        };
    }, []);

    return {
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
    };
}; 