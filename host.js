/* Version: #388 */
// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
let spotifyConnectView, spotifyLoginBtn, hostLobbyView, gameCodeDisplay,
    playerLobbyList, startGameBtn, hostGameView, hostTurnIndicator,
    hostAnswerDisplay, receivedArtist, receivedTitle, receivedYear,
    hostSongDisplay, hostFasitDisplay, fasitArtist, fasitTitle,
    fasitYear, nextTurnBtn, playerHud, gameHeader, gameCodeDisplayPermanent,
    fasitAlbumArt, receivedYearRange, readyToPlayView, startFirstRoundBtn,
    attackPhaseDisplay, attackTimerDisplay, attackResultsContainer; // Nye

// === STATE ===
let players = [], gameCode = '', gameChannel = null, currentPlayerIndex = 0,
    spotifyPlayer = null, deviceId = null, currentSong = null,
    songHistory = [], totalSongsInDb = 0, isGameRunning = false,
    autocompleteData = { artistList: [], titleList: [] },
    currentAttacks = { besserwissers: [], hijacks: [] }, // Nytt
    attackTimer = null; // Nytt

// === FUNKSJONER ===
async function redirectToSpotifyLogin() { /* ... (uendret) ... */ }
async function fetchSpotifyAccessToken(code) { /* ... (uendret) ... */ }
function generateRandomString(length) { /* ... (uendret) ... */ }
async function generateCodeChallenge(codeVerifier) { /* ... (uendret) ... */ }
async function getValidSpotifyToken() { /* ... (uendret) ... */ }
async function refreshSpotifyToken() { /* ... (uendret) ... */ }
window.onSpotifyWebPlaybackSDKReady = () => { console.log("Spotify SDK er lastet."); };
function initializeSpotifyPlayer() {
    return new Promise((resolve) => {
        if (spotifyPlayer) { resolve(); return; }
        spotifyPlayer = new Spotify.Player({ name: 'MQuiz Host Spiller', getOAuthToken: async cb => { const token = await getValidSpotifyToken(); if (token) cb(token); }, volume: 0.5 });
        spotifyPlayer.addListener('ready', ({ device_id }) => {
            console.log('Host Spotify-spiller er klar med enhet-ID:', device_id);
            deviceId = device_id;
            resolve();
        });
        spotifyPlayer.connect();
    });
}
async function playTrack(spotifyTrackId) { /* ... (uendret) ... */ }
async function pauseTrack() { /* ... (uendret) ... */ }
async function fetchWithFreshToken(url, options = {}) { /* ... (uendret) ... */ }
function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase().normalize('NFD').replace(/[\u00c0-\u017f]/g, '').replace(/[.,/#!$%^&*;:{}=\-_`~()']/g, "").replace(/\s+/g, ' ').trim();
}
function updateHud() { /* ... (uendret) ... */ }
function updatePlayerLobby() { /* ... (uendret) ... */ }
function handlePlayerJoin(payload) { /* ... (uendret) ... */ }
async function getAutocompleteLists() { /* ... (uendret) ... */ }

// --- NY, KOMPLEKS SPILL-LOGIKK ---
async function setupGameLobby(existingCode = null) {
    gameCode = existingCode || Math.floor(100000 + Math.random() * 900000).toString();
    gameCodeDisplay.textContent = gameCode;
    gameCodeDisplayPermanent.textContent = gameCode;
    const channelName = `game-${gameCode}`;
    gameChannel = supabaseClient.channel(channelName);
    gameChannel.on('broadcast', { event: 'player_join' }, handlePlayerJoin);
    gameChannel.on('broadcast', { event: 'submit_answer' }, handleAnswer);
    gameChannel.on('broadcast', { event: 'buy_handicap' }, handleBuyHandicap);
    gameChannel.on('broadcast', { event: 'skip_song' }, handleSkipSong);
    // Nye lyttere for angrep
    gameChannel.on('broadcast', { event: 'choose_attack' }, handleAttackChoice);
    gameChannel.on('broadcast', { event: 'submit_besserwisser' }, handleBesserwisserAnswer);
    gameChannel.on('broadcast', { event: 'submit_hijack' }, handleHijackBid);
    gameChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') { console.log(`Lobby er klar og lytter på kanalen: ${channelName}`); }
    });
}
async function startGameLoop() {
    isGameRunning = true;
    hostLobbyView.classList.add('hidden');
    spotifyConnectView.classList.add('hidden');
    gameHeader.classList.remove('hidden');
    hostGameView.classList.remove('hidden');
    await initializeSpotifyPlayer();
    console.log("Spotify-spiller initialisert. Venter 1 sekund...");
    await new Promise(resolve => setTimeout(resolve, 1000));
    await getAutocompleteLists();
    const { count, error } = await supabaseClient.from('songs').select('*', { count: 'exact', head: true });
    if (!error) totalSongsInDb = count;
    gameChannel.send({ type: 'broadcast', event: 'game_start', payload: { players: players, ...autocompleteData } });
    currentPlayerIndex = 0;
    updateHud();
    await startTurn();
}
async function startTurn() {
    players.forEach(p => p.roundHandicap = 0);
    const currentPlayer = players[currentPlayerIndex];
    hostTurnIndicator.textContent = `Venter på svar fra ${currentPlayer.name}...`;
    hostAnswerDisplay.classList.add('hidden');
    hostFasitDisplay.classList.add('hidden');
    attackPhaseDisplay.classList.add('hidden');
    nextTurnBtn.classList.add('hidden');
    hostSongDisplay.innerHTML = '<h2>Henter en ny sang...</h2>';
    hostSongDisplay.classList.remove('hidden');
    updateHud();
    currentSong = await fetchRandomSong();
    if (currentSong) {
        const playbackSuccess = await playTrack(currentSong.spotifyid);
        if (playbackSuccess) {
            hostSongDisplay.innerHTML = '<h2>Sangen spilles...</h2>';
            gameChannel.send({ type: 'broadcast', event: 'new_turn', payload: { name: currentPlayer.name } });
        } else {
            hostSongDisplay.innerHTML = '<h2 style="color: red;">Avspilling feilet!</h2>';
        }
    } else {
        hostSongDisplay.innerHTML = '<h2 style="color: red;">Klarte ikke hente sang!</h2>';
    }
}
async function handleAnswer(payload) {
    const respondingPlayer = players.find(p => p.name === payload.payload.name);
    if (!respondingPlayer) return;
    
    currentAttacks = { 
        playerAnswer: payload.payload,
        besserwissers: [], 
        hijacks: [] 
    };

    const { artist, title, year } = payload.payload;
    receivedArtist.textContent = artist || 'Ikke besvart';
    receivedTitle.textContent = title || 'Ikke besvart';
    receivedYear.textContent = year || 'Ikke besvart';
    hostTurnIndicator.textContent = `${respondingPlayer.name} har svart!`;
    hostAnswerDisplay.classList.remove('hidden');

    const artistGuessNorm = normalizeString(artist);
    const titleGuessNorm = normalizeString(title);
    const correctArtistNorm = normalizeString(currentSong.artist);
    const correctTitleNorm = normalizeString(currentSong.title);
    const yearGuess = parseInt(year, 10);
    const totalHandicap = respondingPlayer.handicap + (respondingPlayer.roundHandicap || 0);
    
    const canBesserwiss = artistGuessNorm !== correctArtistNorm && titleGuessNorm !== correctTitleNorm;
    const canHijack = isNaN(yearGuess) || Math.abs(yearGuess - currentSong.year) > totalHandicap;

    if (!canBesserwiss && !canHijack) {
        resolveRound();
        return;
    }

    attackPhaseDisplay.classList.remove('hidden');
    gameChannel.send({ type: 'broadcast', event: 'attack_phase_start', payload: { attacker: respondingPlayer.name, canBesserwiss, canHijack } });

    let timeLeft = 10;
    attackTimerDisplay.textContent = timeLeft;
    attackTimer = setInterval(() => {
        timeLeft--;
        attackTimerDisplay.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(attackTimer);
            resolveRound();
        }
    }, 1000);
}
function handleAttackChoice(payload) {
    const { name, choice } = payload.payload;
    if (choice === 'besserwisser') {
        currentAttacks.besserwissers.push({ name, artist: '', title: '' });
    } else if (choice === 'hijack') {
        currentAttacks.hijacks.push({ name, bid: 0, year: 0 });
    }
}
function handleBesserwisserAnswer(payload) {
    const { name, artist, title } = payload.payload;
    const bw = currentAttacks.besserwissers.find(b => b.name === name);
    if (bw) {
        bw.artist = artist;
        bw.title = title;
    }
}
function handleHijackBid(payload) {
    const { name, bid, year } = payload.payload;
    const hj = currentAttacks.hijacks.find(h => h.name === name);
    if (hj) {
        hj.bid = bid;
        hj.year = year;
    }
}
async function resolveRound() {
    clearInterval(attackTimer);
    attackPhaseDisplay.classList.add('hidden');
    
    const respondingPlayer = players.find(p => p.name === currentAttacks.playerAnswer.name);
    let feedbackMessages = [];
    let attackResultsHTML = '<h4>Angrep:</h4>';
    
    // Poeng for hovedspiller
    // ... (samme logikk som før) ...

    // Hijack-auksjon
    currentAttacks.hijacks.sort((a, b) => b.bid - a.bid);
    let hijackSuccess = false;
    for (const hijack of currentAttacks.hijacks) {
        // ... logikk for å sjekke svar og gi SP ...
    }

    // Besserwisser-sjekk
    for (const bw of currentAttacks.besserwissers) {
        // ... logikk for å sjekke svar og gi credits ...
    }
    
    const feedbackText = feedbackMessages.length > 0 ? feedbackMessages.join(' ') : `${respondingPlayer.name} fikk ingen poeng.`;
    
    updateHud();
    fasitAlbumArt.src = currentSong.albumarturl || '';
    fasitArtist.textContent = currentSong.artist;
    fasitTitle.textContent = currentSong.title;
    fasitYear.textContent = currentSong.year;
    attackResultsContainer.innerHTML = attackResultsHTML;
    hostFasitDisplay.classList.remove('hidden');
    hostSongDisplay.classList.add('hidden');
    nextTurnBtn.classList.remove('hidden');
    gameChannel.send({ type: 'broadcast', event: 'round_result', payload: { players: players, feedback: feedbackText, song: currentSong, attackResults: attackResultsHTML } });
}
async function advanceToNextTurn() { /* ... (uendret) ... */ }
function handleBuyHandicap(payload) { /* ... (uendret) ... */ }
async function handleSkipSong(payload) { /* ... (uendret) ... */ }

// === HOVED-INNGANGSPUNKT: DOMContentLoaded ===
document.addEventListener('DOMContentLoaded', async () => { /* ... (uendret) ... */ });

// --- Kopiert inn uendrede funksjoner ---
// ... (alle uendrede funksjoner her) ...

/* Version: #388 */
