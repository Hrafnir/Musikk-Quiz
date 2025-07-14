/* Version: #13 */
// === STATE ===
let allSongs = [];
let players = [];
let gameSettings = {
    songsPerPlayer: 5
};
// En liste med forhåndsdefinerte farger for paletten
const PRESET_COLORS = [
    '#1DB954', '#1ED760', '#FF4136', '#FF851B', '#FFDC00', 
    '#0074D9', '#7FDBFF', '#B10DC9', '#F012BE', '#FFFFFF'
];

// === DOM ELEMENTS ===
const gameSetupScreen = document.getElementById('game-setup');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over');

const playerSetupForm = document.getElementById('player-setup-form');
const playerNameInput = document.getElementById('player-name-input');
const playerColorInput = document.getElementById('player-color-input');
const playersListDiv = document.getElementById('players-list');
const songCountSelect = document.getElementById('song-count-select');
const startGameBtn = document.getElementById('start-game-btn');
const colorPaletteDiv = document.getElementById('color-palette'); // NY


// === FUNCTIONS ===

/**
 * Laster sanger fra songs.json-filen
 */
async function loadSongs() {
    try {
        const response = await fetch('songs.json');
        if (!response.ok) {
            throw new Error('HTTP error! status: ' + response.status);
        }
        allSongs = await response.json();
        console.log('Sanger lastet inn:', allSongs);
    } catch (error) {
        console.error('Kunne ikke laste sangfilen:', error);
        gameSetupScreen.innerHTML = '<h1>Feil</h1><p>Kunne ikke laste inn sangdata. Sjekk at filen songs.json finnes og er korrekt formatert.</p>';
    }
}

/**
 * Oppretter og viser fargepaletten
 */
function populateColorPalette() {
    PRESET_COLORS.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;
        swatch.addEventListener('click', () => {
            playerColorInput.value = color;
        });
        colorPaletteDiv.appendChild(swatch);
    });
}

/**
 * Viser spillerne i listen på oppsett-skjermen
 */
function renderPlayers() {
    playersListDiv.innerHTML = ''; // Tømmer listen først
    players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-item';

        const colorDot = document.createElement('div');
        colorDot.className = 'player-color-dot';
        colorDot.style.backgroundColor = player.color;

        const playerName = document.createElement('span');
        playerName.className = 'player-name';
        playerName.textContent = player.name;

        playerElement.appendChild(colorDot);
        playerElement.appendChild(playerName);
        playersListDiv.appendChild(playerElement);
    });

    // Aktiverer startknappen hvis det er minst én spiller
    startGameBtn.disabled = players.length === 0;
}

/**
 * Legger til en ny spiller i `players`-arrayet
 * @param {Event} event - Skjemaets submit-event
 */
function handleAddPlayer(event) {
    event.preventDefault(); // Forhindrer at siden lastes på nytt
    const name = playerNameInput.value.trim();
    const color = playerColorInput.value;

    if (name) {
        const newPlayer = {
            name: name,
            color: color,
            score: 0
        };
        players.push(newPlayer);
        renderPlayers();

        // Nullstill input-feltene og velg en ny tilfeldig farge for neste spiller
        playerNameInput.value = '';
        playerColorInput.value = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
        playerNameInput.focus();
    }
}

/**
 * Starter selve spillet
 */
function startGame() {
    console.log("Starter spill med disse spillerne:", players);
    
    // Lagre valgt antall sanger
    gameSettings.songsPerPlayer = songCountSelect.value === 'Infinity' ? Infinity : parseInt(songCountSelect.value, 10);
    console.log("Spillinnstillinger:", gameSettings);

    // Bytt til spill-skjermen
    gameSetupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
}


// === INITIALIZATION ===

document.addEventListener('DOMContentLoaded', () => {
    console.log('Quiz-appen er klar!');
    loadSongs();
    populateColorPalette(); // NY: Fyll paletten med farger

    // Legg til event listeners
    playerSetupForm.addEventListener('submit', handleAddPlayer);
    startGameBtn.addEventListener('click', startGame);

    // Initialiser spillerlisten (som er tom)
    renderPlayers();
});
/* Version: #13 */
