/* Version: #22 */
// === STATE ===
let allSongs = [];
let players = [];
let gameSettings = {
    songsPerPlayer: 5
};
const PRESET_COLORS = [
    '#1DB954', '#1ED760', '#FF4136', '#FF851B', '#FFDC00', 
    '#0074D9', '#7FDBFF', '#B10DC9', '#F012BE', '#FFFFFF'
];

// Spill-spesifikk state
let gamePlaylist = [];
let currentRound = 0;
let currentPlayerIndex = 0;


// === DOM ELEMENTS ===
const gameSetupScreen = document.getElementById('game-setup');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over');

// Oppsett-skjerm
const playerSetupForm = document.getElementById('player-setup-form');
const playerNameInput = document.getElementById('player-name-input');
const playerColorInput = document.getElementById('player-color-input');
const playersListDiv = document.getElementById('players-list');
const songCountSelect = document.getElementById('song-count-select');
const startGameBtn = document.getElementById('start-game-btn');
const colorPaletteDiv = document.getElementById('color-palette');

// Spill-skjerm
const scoreboardDiv = document.getElementById('scoreboard');
const roundContainerDiv = document.getElementById('round-container');


// === FUNCTIONS ===

// --- Oppsett-funksjoner ---
async function loadSongs() {
    try {
        const response = await fetch('songs.json');
        if (!response.ok) {
            throw new Error('HTTP error! status: ' + response.status);
        }
        allSongs = await response.json();
        console.log('Sanger lastet inn:', allSongs);
        renderPlayers(); 
    } catch (error) {
        console.error('Kunne ikke laste sangfilen:', error);
        gameSetupScreen.innerHTML = '<h1>Feil</h1><p>Kunne ikke laste inn sangdata. Sjekk at filen songs.json finnes og er korrekt formatert.</p>';
    }
}

function populateColorPalette() {
    colorPaletteDiv.innerHTML = '';
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

function renderPlayers() {
    playersListDiv.innerHTML = '';
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
    startGameBtn.disabled = players.length === 0 || allSongs.length === 0;
}

function handleAddPlayer(event) {
    event.preventDefault();
    const name = playerNameInput.value.trim();
    const color = playerColorInput.value;
    if (name) {
        players.push({ name: name, color: color, score: 0 });
        renderPlayers();
        playerNameInput.value = '';
        playerColorInput.value = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
        playerNameInput.focus();
    }
}

// --- Spill-funksjoner ---

function renderScoreboard() {
    scoreboardDiv.innerHTML = '';
    players.forEach(player => {
        const playerScoreDiv = document.createElement('div');
        playerScoreDiv.className = 'scoreboard-player';
        playerScoreDiv.style.backgroundColor = player.color;
        const playerName = document.createTextNode(`${player.name}: `);
        const playerScore = document.createElement('strong');
        playerScore.textContent = player.score;
        playerScoreDiv.appendChild(playerName);
        playerScoreDiv.appendChild(playerScore);
        scoreboardDiv.appendChild(playerScoreDiv);
    });
}

function buildGamePlaylist() {
    const totalSongsNeeded = gameSettings.songsPerPlayer === Infinity ? allSongs.length : players.length * gameSettings.songsPerPlayer;
    const shuffledSongs = [...allSongs].sort(() => 0.5 - Math.random());
    gamePlaylist = shuffledSongs.slice(0, totalSongsNeeded);
    console.log("Spilleliste laget:", gamePlaylist);
}

/**
 * Behandler spillerens svar
 * @param {Event} event 
 */
function processAnswer(event) {
    event.preventDefault(); // Forhindrer at siden lastes på nytt
    
    // Hent gjetningene fra skjemaet
    const yearGuess = document.getElementById('year-guess').value;
    const artistGuess = document.getElementById('artist-guess').value;
    const titleGuess = document.getElementById('title-guess').value;

    console.log("Svar mottatt:", { year: yearGuess, artist: artistGuess, title: titleGuess });

    // Her vil vi legge til poengberegning og visning av resultater
    // For nå, la oss bare gå til neste runde
    
    // Oppdater hvem sin tur det er for neste runde
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    currentRound++;
    
    // Start neste runde
    startNextRound();
}

function startNextRound() {
    if (currentRound >= gamePlaylist.length) {
        console.log("Spill over!");
        roundContainerDiv.innerHTML = '<h2>Spillet er ferdig!</h2>';
        // Senere: bytt til game-over skjerm
        return;
    }

    const currentPlayer = players[currentPlayerIndex];
    const currentSong = gamePlaylist[currentRound];

    console.log(`Runde ${currentRound + 1}: ${currentPlayer.name} sin tur. Sang: ${currentSong.title}`);

    // Bygg HTML for runden
    roundContainerDiv.innerHTML = `
        <h2>${currentPlayer.name}, din tur!</h2>
        
        <button id="play-song-btn" class="play-song-btn">Spill av sang på Spotify</button>
        
        <form id="guess-form">
            <p>Hvilket år, artist og tittel?</p>
            <input type="number" id="year-guess" placeholder="Årstall (f.eks. 1995)" required>
            <input type="text" id="artist-guess" placeholder="Artist" required>
            <input type="text" id="title-guess" placeholder="Tittel" required>
            <button type="submit">Lever svar</button>
        </form>
    `;

    // Legg til event listeners for de nye elementene
    document.getElementById('play-song-btn').addEventListener('click', () => {
        // Åpne Spotify i en ny fane
        window.open(`https://open.spotify.com/track/${currentSong.spotifyId}`, '_blank');
    });

    document.getElementById('guess-form').addEventListener('submit', processAnswer);
}

function startGame() {
    console.log("Starter spill med disse spillerne:", players);
    gameSettings.songsPerPlayer = songCountSelect.value === 'Infinity' ? Infinity : parseInt(songCountSelect.value, 10);
    console.log("Spillinnstillinger:", gameSettings);

    buildGamePlaylist();

    if (gamePlaylist.length === 0) {
        alert("Ikke nok sanger i songs.json til å starte spillet!");
        return;
    }

    gameSetupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    renderScoreboard();
    startNextRound();
}


// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    console.log('Quiz-appen er klar!');
    loadSongs();
    populateColorPalette();

    playerSetupForm.addEventListener('submit', handleAddPlayer);
    startGameBtn.addEventListener('click', startGame);

    renderPlayers();
});
/* Version: #22 */
