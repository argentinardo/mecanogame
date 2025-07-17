import React, { useEffect, useRef } from 'react';

interface Star {
    x: number; // posición X relativa al centro (de -1 a 1)
    y: number; // posición Y relativa al centro (de -1 a 1)
    z: number; // profundidad (0 = cerca, 1 = lejos)
    speed: number;
}

const STAR_COUNT = 30;

export const Starfield: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | undefined>(undefined);
    const starsRef = useRef<Star[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Ajustar tamaño: 100% del ancho, 50% del alto del contenedor padre
        const resizeCanvas = () => {
            if (!canvas.parentElement) return;
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width; // 100% del ancho
            canvas.height = rect.height// 50% del alto
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Inicializar estrellas
        const resetStar = (): Star => {
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random();
            return {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius, // Ahora en todo el canvas
                z: Math.random(),
                speed: 0.0006 + Math.random() * 0.006 // Velocidad reducida
            };
        };
        starsRef.current = Array.from({ length: STAR_COUNT }, resetStar);

        // Animación
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const cx = canvas.width / 2; // 50% del ancho
            const cy = canvas.height; // Horizonte en la parte inferior (final del grid)
            for (const star of starsRef.current) {
                // Simular avance en Z
                star.z -= star.speed;
                if (star.z <= 0.01) {
                    Object.assign(star, resetStar());
                    star.z = 1;
                }
                // Proyección perspectiva desde el horizonte inferior
                const px = cx + star.x * (canvas.width / 2) / star.z;
                const py = cy - Math.abs(star.y) * (canvas.height / 2) / star.z; // Estrellas solo arriba del horizonte
                // Dibujar solo si está arriba del horizonte
                if (px >= 0 && px <= canvas.width && py >= 0 && py <= canvas.height) {
                    const size = Math.max(1, 2.5 - star.z * 2); // más cerca, más grande
                    ctx.beginPath();
                    ctx.arc(px, py, size, 0, 2 * Math.PI);
                    ctx.fillStyle = 'white';
                    ctx.globalAlpha = 0.7;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
            }
            animationRef.current = requestAnimationFrame(animate);
        };
        animate();
        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    return <canvas ref={canvasRef} style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '50%',
        pointerEvents: 'none',
        zIndex: 0
    }} />;
}; 