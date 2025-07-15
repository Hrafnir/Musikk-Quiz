/* Version: #58 */
// === STATE ===
let allSongs = [];
let players = [];
let gameSettings = {
    totalSongs: 10
};
const PRESET_COLORS = [
    '#1DB954', '#1ED760', '#FF4136', '#FF851B', '#FFDC00', 
    '#0074D9', '#7FDBFF', '#B10DC9', '#F012BE', '#FFFFFF'
];

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
const totalSongSelect = document.getElementById('total-song-select');
const startGameBtn = document.getElementById('start-game-btn');
const colorPaletteDiv = document.getElementById('color-palette');

// Spill-skjerm
const scoreboardDiv = document.getElementById('scoreboard');
const roundContainerDiv = document.getElementById('round-container');

// Spill-slutt skjerm
const finalResultsListDiv = document.getElementById('final-results-list');
const playAgainBtn = document.getElementById('play-again-btn');


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
        swatch.addEventListener('click', () => { playerColorInput.value = color; });
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
        players.push({ id: Date.now(), name: name, color: color, score: 0 });
        renderPlayers();
        playerNameInput.value = '';
        playerColorInput.value = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
        playerNameInput.focus();
    }
}

// --- Spill-funksjoner ---
function normalizeText(text) {
    if (typeof text !== 'string') return '';
    return text.toLowerCase().replace(/^(the|en|et|a)\s+/i, '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()']/g,"").replace(/\s+/g, '');
}

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
    const totalSongsNeeded = gameSettings.totalSongs === Infinity ? allSongs.length : gameSettings.totalSongs;
    const shuffledSongs = [...allSongs].sort(() => 0.5 - Math.random());
    gamePlaylist = shuffledSongs.slice(0, totalSongsNeeded);
    console.log("Spilleliste laget med", gamePlaylist.length, "sanger.");
}

/**
 * NY FUNKSJON: Sentraliserer logikken for å gå til neste tur
 */
function advanceToNextTurn() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    currentRound++;
    startNextRound();
}

function showRoundResult(points, guesses) {
    const currentSong = gamePlaylist[currentRound];
    const { year, artist, title } = currentSong;
    const { yearGuess, artistGuess, titleGuess } = guesses;

    roundContainerDiv.innerHTML = `
        <div id="result-view">
            <img src="${currentSong.albumArtUrl}" alt="Album cover for ${title}" class="result-album-art">
            <h2 class="result-title">${artist} - ${title} (${year})</h2>
            <p class="result-trivia">Trivia: ${currentSong.trivia}</p>
            <hr>
            <h3>Din poengsum denne runden: ${points.total}</h3>
            <div class="result-details">
                <p>Årstall: ${points.year} p (Du gjettet ${yearGuess || 'ingenting'})</p>
                <p>Artist: ${points.artist} p (Du gjettet '${artistGuess || 'ingenting'}')</p>
                <p>Tittel: ${points.title} p (Du gjettet '${titleGuess || 'ingenting'}')</p>
            </div>
            <button id="next-round-btn">Neste</button>
        </div>
    `;

    document.getElementById('next-round-btn').addEventListener('click', advanceToNextTurn);
}

function processAnswer(event) {
    event.preventDefault(); 
    const yearGuess = parseInt(document.getElementById('year-guess').value, 10);
    const artistGuess = document.getElementById('artist-guess').value;
    const titleGuess = document.getElementById('title-guess').value;
    const currentSong = gamePlaylist[currentRound];
    const currentPlayer = players[currentPlayerIndex];
    let points = { year: 0, artist: 0, title: 0, total: 0 };
    const yearDiff = Math.abs(yearGuess - currentSong.year);
    if (!isNaN(yearDiff)) {
        if (yearDiff === 0) points.year = 5;
        else if (yearDiff === 1) points.year = 4;
        else if (yearDiff === 2) points.year = 3;
        else if (yearDiff === 3) points.year = 2;
        else if (yearDiff === 4) points.year = 1;
    }
    if (normalizeText(artistGuess) === normalizeText(currentSong.artist)) points.artist = 5;
    if (normalizeText(titleGuess) === normalizeText(currentSong.title)) points.title = 5;
    points.total = points.year + points.artist + points.title;
    currentPlayer.score += points.total;
    console.log(`${currentPlayer.name} fikk ${points.total} poeng. Ny score: ${currentPlayer.score}`);
    renderScoreboard();
    showRoundResult(points, { yearGuess, artistGuess, titleGuess });
}

function showGameOver() {
    gameScreen.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    finalResultsListDiv.innerHTML = '';
    sortedPlayers.forEach((player, index) => {
        const playerItem = document.createElement('div');
        playerItem.className = 'final-player-item';
        if (index === 0) {
            playerItem.classList.add('winner');
        }
        playerItem.style.backgroundColor = player.color;
        playerItem.innerHTML = `<span>${player.name}</span><strong>${player.score} p</strong>`;
        finalResultsListDiv.appendChild(playerItem);
    });
}

function startNextRound() {
    if (currentRound >= gamePlaylist.length) {
        showGameOver();
        return;
    }

    const songForThisTurn = gamePlaylist[currentRound];
    const playerForThisTurn = players[currentPlayerIndex];

    console.log(`Runde ${currentRound + 1} / ${gamePlaylist.length} | Spiller: ${playerForThisTurn.name} | Sang: ${songForThisTurn.title}`);

    roundContainerDiv.innerHTML = `
        <h2>${playerForThisTurn.name}, din tur!</h2>
        <p style="font-size: 1.2em; margin-bottom: 20px;">Sang ${currentRound + 1} av ${gamePlaylist.length}</p>
        <div style="padding: 10px; border: 1px solid #555; border-radius: 5px; margin: 15px 0;">
            <p><strong>VIKTIG:</strong> Klikk knappen under og bytt <strong>umiddelbart</strong> tilbake til denne fanen!</p>
        </div>
        <button id="play-song-btn" class="play-song-btn">Spill av sang på Spotify</button>
        <form id="guess-form">
            <p>Hvilket år, artist og tittel?</p>
            <input type="number" id="year-guess" placeholder="Årstall (f.eks. 1995)" required>
            <input type="text" id="artist-guess" placeholder="Artist" required>
            <input type="text" id="title-guess" placeholder="Tittel" required>
            <button type="submit">Lever svar</button>
        </form>
        <button id="skip-song-btn" class="skip-song-btn">Hopp over sang (0 poeng)</button>
    `;

    document.getElementById('play-song-btn').addEventListener('click', () => {
        window.open(`https://open.spotify.com/track/${songForThisTurn.spotifyId}`, 'spotify_player_tab');
    });
    document.getElementById('guess-form').addEventListener('submit', processAnswer);
    
    // NYTT: Legg til lytter for hopp-over-knappen
    document.getElementById('skip-song-btn').addEventListener('click', () => {
        console.log(`Sang hoppet over: ${songForThisTurn.title}`);
        advanceToNextTurn(); // Gå direkte til neste tur
    });
}

function resetGame() {
    gameOverScreen.classList.add('hidden');
    gameSetupScreen.classList.remove('hidden');
}

function startGame() {
    players.forEach(p => p.score = 0);
    gamePlaylist = [];
    currentRound = 0;
    currentPlayerIndex = 0;
    gameSettings.totalSongs = totalSongSelect.value === 'Infinity' ? Infinity : parseInt(totalSongSelect.value, 10);
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
    playAgainBtn.addEventListener('click', resetGame);
    renderPlayers();
});
/* Version: #58 */
