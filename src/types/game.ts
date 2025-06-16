export interface GameState {
    score: number;
    lives: number;
    isPlaying: boolean;
    isPenalized: boolean;
    penaltyTime: number;
    fallingLetters: FallingLetter[];
    bullets: Bullet[];
    meteorites: Meteorite[];
    forceField: ForceField | null;
    gameSpeed: number;
    letterSpeed: number;
    currentStage: number;
    pressedKey: string | null;
    centralMessage: string | null;
    showCentralMessage: boolean;
    countdown: number | null;
    isPaused: boolean;
    showSectorInfo: boolean;
    sectorInfoTimeout: number | null;
}

export interface FallingLetter {
    letter: string;
    x: number;
    y: number;
    speed: number;
    id: number;
}

export interface Bullet {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
}

export interface Meteorite {
    x: number;
    y: number;
    speedX: number;
    speedY: number;
    size: number;
    rotation: number;
    id: number;
}

export interface ForceField {
    isActive: boolean;
    startTime: number;
    duration: number; // en milisegundos
}

export interface KeyboardPosition {
    row: number;
    col: number;
}

export interface TypingStage {
    name: string;
    letters: string[];
    description: string;
}

// Posiciones optimizadas de las teclas en el teclado español
export const KEYBOARD_POSITIONS: Record<string, KeyboardPosition> = {
    // Primera fila (0-9)
    'Q': { row: 0, col: 0 }, 'W': { row: 0, col: 1 }, 'E': { row: 0, col: 2 }, 'R': { row: 0, col: 3 },
    'T': { row: 0, col: 4 }, 'Y': { row: 0, col: 5 }, 'U': { row: 0, col: 6 }, 'I': { row: 0, col: 7 },
    'O': { row: 0, col: 8 }, 'P': { row: 0, col: 9 },
    // Segunda fila (0.3-9.7) - ligeramente desplazada
    'A': { row: 1, col: 0.3 }, 'S': { row: 1, col: 1.3 }, 'D': { row: 1, col: 2.3 }, 'F': { row: 1, col: 3.3 },
    'G': { row: 1, col: 4.3 }, 'H': { row: 1, col: 5.3 }, 'J': { row: 1, col: 6.3 }, 'K': { row: 1, col: 7.3 },
    'L': { row: 1, col: 8.3 }, 'Ñ': { row: 1, col: 9.3 },
    // Tercera fila (1-7) - más compacta, centrada
    'Z': { row: 2, col: 1.5 }, 'X': { row: 2, col: 2.5 }, 'C': { row: 2, col: 3.5 }, 'V': { row: 2, col: 4.5 },
    'B': { row: 2, col: 5.5 }, 'N': { row: 2, col: 6.5 }, 'M': { row: 2, col: 7.5 }
};

// Etapas de mecanografía para teclado español
export const TYPING_STAGES: TypingStage[] = [
    {
        name: "Sector 0: Posición Base",
        letters: ['F', 'J'],
        description: "Posiciona los dedos índices sobre las marcas del teclado"
    },
    {
        name: "Sector 1: Dedos Índices Extendidos",
        letters: ['F', 'J', 'G', 'H'],
        description: "Ahora debes mover los índices para alcanzar la G y la H"
    },
    {
        name: "Sector 2: Fila Inicial Básica",
        letters: ['A', 'S', 'D', 'F', 'J', 'K', 'L'],
        description: "Mantén los índices en sus marcas y pon cada dedo en la fila del medio"
    },
    {
        name: "Sector 3: Fila Inicial Completa",
        letters: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
        description: "Ahora toda la fila, recuerda mover los índices para la G y la H"
    },
    {
        name: "Sector 4: Fila Superior Básica",
        letters: ['Q', 'W', 'E', 'I', 'O', 'P'],
        description: "Apretamos las teclas superiores y volvemos los indices a su marca"
    },
    {
        name: "Sector 5: Fila Superior Intermedia",
        letters: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        description: "Practica con más teclas de la fila superior"
    },
    {
        name: "Sector 6: Fila Inferior Básica",
        letters: ['Z', 'X', 'M', 'N'],
        description: "Practica con las teclas básicas de la fila inferior"
    },
    {
        name: "Sector 7: Fila Inferior Intermedia",
        letters: ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
        description: "Domina las teclas intermedias de la fila inferior"
    },
    {
        name: "Sector 8: Combinación Básica",
        letters: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ', 'Q', 'W', 'E', 'I', 'O', 'P'],
        description: "Combina las filas inicial y superior"
    },
    {
        name: "Sector 9: Combinación Intermedia",
        letters: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Z', 'X', 'M', 'N'],
        description: "Practica con todas las teclas excepto las más difíciles"
    },
    {
        name: "Sector 10: Todas las Letras",
        letters: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split(''),
        description: "¡Demuestra tu dominio con todas las letras!"
    }
]; 