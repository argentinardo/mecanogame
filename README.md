# Mecano Game

Mecano Game is a web-based typing game where players type falling letters to score points and progress through stages.

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm (comes with Node.js) or yarn

### Installation

1.  Navigate to the project directory:
    ```bash
    cd mecano-game 
    ```
    (If you are not already in the project's root directory)

2.  Install the dependencies:
    ```bash
    npm install
    ```
    Alternatively, if you prefer using yarn:
    ```bash
    yarn install
    ```

## Available Scripts

In the project directory, you can run the following commands:

### `npm run dev`

Runs the app in development mode.
Open [http://localhost:5173](http://localhost:5173) (or the port shown in your terminal) to view it in the browser.
The page will reload if you make edits.

### `npm run build`

Builds the app for production to the `dist` folder.
It correctly bundles React in production mode and optimizes the build for the best performance.

### `npm run preview`

Serves the production build locally for preview before deployment.

### `npm run lint`

Lints the codebase using ESLint to identify and fix stylistic and programmatic errors.

## Gameplay

Mecano Game is a fast-paced typing challenge!

*   **Objective:** Type the letters that fall from the top of the screen before they reach the bottom.
*   **Shooting:** Press the corresponding key on your keyboard to "shoot" a falling letter.
*   **Scoring:** Each correctly typed letter earns you points.
*   **Lives:** You start with a set number of lives. If a letter reaches the bottom, you lose a life. The game ends when you run out of lives.
*   **Difficulty:** The game gets progressively harder, with letters falling faster and appearing more frequently as you score more points and advance through different typing stages.
*   **Stages:** The game features different stages, introducing new sets of letters to type, helping you practice different areas of the keyboard.

## Technologies Used

*   **React:** A JavaScript library for building user interfaces.
*   **TypeScript:** A typed superset of JavaScript that compiles to plain JavaScript.
*   **Vite:** A fast build tool and development server for modern web projects.
*   **ESLint:** A pluggable and configurable linter tool for identifying and reporting on patterns in JavaScript and TypeScript.
