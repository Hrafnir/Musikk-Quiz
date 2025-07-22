/* Version: #263 */
// === CONFIGURATION ===
const SUPABASE_URL = 'https://ldmkhaeauldafjzaxozp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbWtoYWVhdWxkYWZqemF4b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNjY0MTgsImV4cCI6MjA2ODY0MjQxOH0.78PkucLIkoclk6Wd6Lvcml0SPPEmUDpEQ1Ou7MPOPLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === STATE ===
let spotifyAccessToken = null;
let spotifyPlayer = null;
let deviceId = null;
let currentSong = null;
let artistList = [];
let titleList = []; // NYTT: For å holde på listen over titler
let songHistory = [];
let totalSongsInDb = 0;
let players = [];
let currentPlayerIndex = 0;

// === DOM ELEMENTS ===
let preGameView, inGameView, startGameBtn,
    playerNameInput, addPlayerBtn, playerList,
    playerHud, turnIndicator,
    answerDisplay, albumArt, correctArtist, correctTitle, correctYear,
    guessArea, artistGuessInput, titleGuessInput, yearGuessInput, submitGuessBtn,
    roundStatus, gameControls, nextRoundBtn,
    artistDataList, titleDataList; // NYTT: titleDataList

// === SPOTIFY SDK & PLAYER ===
window.onSpotifyWebPlaybackSDKReady = () => {
    spotifyAccessToken = localStorage.getItem('spotify_access_token');
    if (spotifyAccessToken) {
        initializeSpotifyPlayer(spotifyAccessToken);
    } else {
        alert('Spotify-tilkobling mangler. Sender deg tilbake til hovedsiden.');
        window.location.href = 'index.html';
    }
};

// ... (Uendrede funksjoner som initializeSpotifyPlayer, playTrack etc.) ...

// === PRE-GAME LOGIC (SPILLER-OPPSETT) ===
function handleAddPlayer() {
    const name = playerNameInput.value.trim();
    if (name && !players.some(p => p.name === name)) {
        players.push({ name: name, sp: 0, credits: 3, handicap: 5 });
        updatePlayerListView();
        playerNameInput.value = '';
        startGameBtn.disabled = false;
    }
    playerNameInput.focus();
}

function updatePlayerListView() {
    playerList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name;
        playerList.appendChild(li);
    });
}

// === GAME LOGIC ===
async function startGame() {
    if (players.length === 0) return;
    preGameView.classList.add('hidden');
    inGameView.classList.remove('hidden');
    songHistory = [];
    currentPlayerIndex = 0;
    
    const { count, error } = await supabaseClient.from('songs').select('*', { count: 'exact', head: true });
    if (!error) totalSongsInDb = count;

    // Laster begge autocomplete-listene
    await populateAutocompleteLists();
    updateHud();
    playNextRound();
}

// ENDRET: Henter og fyller begge autocomplete-listene
async function populateAutocompleteLists() {
    console.log("Henter autocomplete-lister...");
    // Artist-liste
    const { data: artists, error: artistError } = await supabaseClient.rpc('get_distinct_artists');
    if (artistError) { console.error("Klarte ikke hente artistliste:", artistError); } 
    else {
        artistList = artists.map(item => item.artist_name);
        artistDataList.innerHTML = artistList.map(artist => `<option value="${artist}"></option>`).join('');
        console.log(`Artistliste lastet med ${artistList.length} artister.`);
    }

    // Tittel-liste
    const { data: titles, error: titleError } = await supabaseClient.rpc('get_distinct_titles');
    if (titleError) { console.error("Klarte ikke hente tittelliste:", titleError); } 
    else {
        titleList = titles.map(item => item.title_name);
        titleDataList.innerHTML = titleList.map(title => `<option value="${title}"></option>`).join('');
        console.log(`Tittelliste lastet med ${titleList.length} titler.`);
    }
}

async function playNextRound() {
    updateTurnIndicator();
    roundStatus.textContent = 'Henter en ny sang...';
    roundStatus.style.color = '#fff';
    guessArea.classList.remove('hidden');
    answerDisplay.classList.add('hidden');
    nextRoundBtn.classList.add('hidden');
    
    artistGuessInput.value = '';
    titleGuessInput.value = '';
    yearGuessInput.value = '';
    albumArt.src = '';

    currentSong = await fetchRandomSong();

    if (currentSong) {
        songHistory.push(currentSong.id);
        roundStatus.textContent = 'Starter avspilling...';
        const playbackSuccess = await playTrack(currentSong.spotifyid);
        if (playbackSuccess) {
            roundStatus.textContent = 'Sangen spilles...';
            artistGuessInput.focus();
        } else {
            roundStatus.textContent = 'Avspilling feilet. Prøv neste runde.';
        }
    } else {
        roundStatus.textContent = 'Klarte ikke hente en sang. Prøv igjen.';
    }
}

function handleSubmitGuess() {
    const currentPlayer = players[currentPlayerIndex];
    let roundSp = 0;
    let roundCredits = 0;

    const artistGuess = artistGuessInput.value.trim().toLowerCase();
    const titleGuess = titleGuessInput.value.trim().toLowerCase();
    const yearGuess = parseInt(yearGuessInput.value, 10);

    const correctArtist = currentSong.artist.toLowerCase();
    const correctTitle = currentSong.title.toLowerCase();
    const correctYear = currentSong.year;

    if (artistGuess === correctArtist && titleGuess === correctTitle) {
        roundCredits += 2;
    }
    
    if (yearGuess && Math.abs(yearGuess - correctYear) <= currentPlayer.handicap) {
        roundSp++;
    }

    currentPlayer.sp += roundSp;
    currentPlayer.credits += roundCredits;
    
    updateHud();
    roundStatus.textContent = `Du fikk ${roundSp} SP og ${roundCredits} Credits!`;
    roundStatus.style.color = (roundSp > 0 || roundCredits > 0) ? '#1DB954' : '#FF4136';
    showAnswer();
}

function advanceToNextPlayer() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    updateHud(); 
    playNextRound();
}

// === UI UPDATE FUNCTIONS ===
function updateHud() { /* ... (uendret) ... */ }
function updateTurnIndicator() { /* ... (uendret) ... */ }
function showAnswer() { /* ... (uendret) ... */ }

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    // Hent alle DOM-elementer
    preGameView = document.getElementById('pre-game-view');
    inGameView = document.getElementById('in-game-view');
    startGameBtn = document.getElementById('start-game-btn');
    playerNameInput = document.getElementById('player-name-input');
    addPlayerBtn = document.getElementById('add-player-btn');
    playerList = document.getElementById('player-list');
    playerHud = document.getElementById('player-hud');
    turnIndicator = document.getElementById('turn-indicator');
    answerDisplay = document.getElementById('answer-display');
    albumArt = document.getElementById('album-art');
    correctArtist = document.getElementById('correct-artist');
    correctTitle = document.getElementById('correct-title');
    correctYear = document.getElementById('correct-year');
    guessArea = document.getElementById('guess-area');
    artistGuessInput = document.getElementById('artist-guess-input');
    titleGuessInput = document.getElementById('title-guess-input');
    yearGuessInput = document.getElementById('year-guess-input');
    submitGuessBtn = document.getElementById('submit-guess-btn');
    roundStatus = document.getElementById('round-status');
    gameControls = document.getElementById('game-controls');
    nextRoundBtn = document.getElementById('next-round-btn');
    artistDataList = document.getElementById('artist-list');
    titleDataList = document.getElementById('title-list'); // NYTT

    // Sett opp event listeners
    addPlayerBtn.addEventListener('click', handleAddPlayer);
    playerNameInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') handleAddPlayer(); });
    startGameBtn.addEventListener('click', startGame);
    submitGuessBtn.addEventListener('click', handleSubmitGuess);
    nextRoundBtn.addEventListener('click', advanceToNextPlayer);
});

// --- Kopiert inn uendrede hjelpefunksjoner ---
function initializeSpotifyPlayer(token) { if (spotifyPlayer) return; spotifyPlayer = new Spotify.Player({ name: 'MQuiz Spiller', getOAuthToken: cb => { cb(token); }, volume: 0.5 }); spotifyPlayer.addListener('ready', ({ device_id }) => { console.log('Spotify-spiller er klar med enhet-ID:', device_id); deviceId = device_id; startGameBtn.disabled = true; startGameBtn.textContent = 'Legg til spillere for å starte'; }); spotifyPlayer.addListener('not_ready', ({ device_id }) => { console.log('Enhet har gått offline', device_id); }); spotifyPlayer.addListener('authentication_error', ({ message }) => { console.error('Autentisering feilet:', message); alert('Spotify-autentisering feilet. Prøv å koble til på nytt fra hovedsiden.'); window.location.href = 'index.html'; }); spotifyPlayer.connect(); }
async function transferPlayback() { if (!deviceId) return; await fetch(`https://api.spotify.com/v1/me/player`, { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: false }), headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${spotifyAccessToken}` }, }); await new Promise(resolve => setTimeout(resolve, 500)); }
async function pauseTrack() { if (!deviceId) return; await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${spotifyAccessToken}` }, }); }
async function playTrack(spotifyTrackId) { if (!deviceId) { alert('Ingen aktiv Spotify-enhet funnet.'); return false; } await pauseTrack(); await new Promise(resolve => setTimeout(resolve, 100)); const trackUri = `spotify:track:${spotifyTrackId}`; const playUrl = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`; const playOptions = { method: 'PUT', body: JSON.stringify({ uris: [trackUri] }), headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${spotifyAccessToken}` }, }; try { const response = await fetch(playUrl, playOptions); if (!response.ok) throw new Error(`Spotify API svarte med ${response.status}`); return true; } catch (error) { if (error.message.includes("403")) { await transferPlayback(); try { const retryResponse = await fetch(playUrl, playOptions); if (!retryResponse.ok) throw new Error(`Spotify API svarte med ${retryResponse.status} på nytt forsøk`); return true; } catch (retryError) { alert("Klarte ikke starte avspilling. Sjekk at Spotify er aktiv og prøv neste runde."); return false; } } else { return false; } } }
async function fetchRandomSong() { if (totalSongsInDb > 0 && songHistory.length >= totalSongsInDb) { songHistory = []; } const { data, error } = await supabaseClient.rpc('get_random_song', { excluded_ids: songHistory }); if (error || !data || !data[0]) { songHistory = []; const { data: fallbackData } = await supabaseClient.rpc('get_random_song', { excluded_ids: songHistory }); return fallbackData ? fallbackData[0] : null; } return data[0]; }
function updateHud() { playerHud.innerHTML = ''; players.forEach((player, index) => { const playerInfoDiv = document.createElement('div'); playerInfoDiv.className = 'player-info'; if (index === currentPlayerIndex) { playerInfoDiv.classList.add('active-player'); } playerInfoDiv.innerHTML = ` <div class="player-name">${player.name}</div> <div class="player-stats">SP: ${player.sp} | Credits: ${player.credits}</div> `; playerHud.appendChild(playerInfoDiv); }); }
function updateTurnIndicator() { turnIndicator.textContent = `${players[currentPlayerIndex].name} sin tur!`; }
function showAnswer() { albumArt.src = currentSong.albumarturl || ''; correctArtist.textContent = currentSong.artist; correctTitle.textContent = currentSong.title; correctYear.textContent = currentSong.year; answerDisplay.classList.remove('hidden'); guessArea.classList.add('hidden'); nextRoundBtn.classList.remove('hidden'); }
/* Version: #263 */
