/* Version: #310 */
// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === STATE ===
let spotifyAccessToken = null;
let spotifyPlayer = null;
let deviceId = null;
let currentSong = null;
let artistList = [];
let titleList = [];
let songHistory = [];
let totalSongsInDb = 0;
let players = [];
let currentPlayerIndex = 0;
let allTags = [];
let victoryPoints = 10;
let currentRoundHandicap = 0;

// === DOM ELEMENTS ===
let preGameView, inGameView, startGameBtn, victoryView,
    playerNameInput, addPlayerBtn, playerList, playerHandicapInput,
    victoryPointsInput,
    playerHud, turnIndicator,
    answerDisplay, albumArt, correctArtist, correctTitle, correctYear, reportErrorBtn, editSongBtn, brokenSongBtn,
    guessArea, artistGuessInput, titleGuessInput, yearGuessInput, yearRangeDisplay, // Endret
    submitGuessBtn, roundStatus, gameControls, nextRoundBtn,
    artistDataList, titleDataList,
    buyHandicapBtn, skipSongBtn,
    winnerAnnouncement, victoryStatsContainer, playAgainBtn, newGameBtn, mainMenuLink;

// === DOCUMENT READY ===
document.addEventListener('DOMContentLoaded', () => {
    // Hent DOM-elementer
    preGameView = document.getElementById('pre-game-view');
    inGameView = document.getElementById('in-game-view');
    victoryView = document.getElementById('victory-view');
    startGameBtn = document.getElementById('start-game-btn');
    playerNameInput = document.getElementById('player-name-input');
    playerHandicapInput = document.getElementById('player-handicap-input');
    addPlayerBtn = document.getElementById('add-player-btn');
    playerList = document.getElementById('player-list');
    victoryPointsInput = document.getElementById('victory-points-input');
    playerHud = document.getElementById('player-hud');
    turnIndicator = document.getElementById('turn-indicator');
    answerDisplay = document.getElementById('answer-display');
    albumArt = document.getElementById('album-art');
    correctArtist = document.getElementById('correct-artist');
    correctTitle = document.getElementById('correct-title');
    correctYear = document.getElementById('correct-year');
    reportErrorBtn = document.getElementById('report-error-btn');
    editSongBtn = document.getElementById('edit-song-btn');
    brokenSongBtn = document.getElementById('broken-song-btn');
    guessArea = document.getElementById('guess-area');
    artistGuessInput = document.getElementById('artist-guess-input');
    titleGuessInput = document.getElementById('title-guess-input');
    yearGuessInput = document.getElementById('year-guess-input');
    yearRangeDisplay = document.getElementById('year-range-display'); // Ny
    submitGuessBtn = document.getElementById('submit-guess-btn');
    roundStatus = document.getElementById('round-status');
    gameControls = document.getElementById('game-controls');
    nextRoundBtn = document.getElementById('next-round-btn');
    artistDataList = document.getElementById('artist-list');
    titleDataList = document.getElementById('title-list');
    buyHandicapBtn = document.getElementById('buy-handicap-btn');
    skipSongBtn = document.getElementById('skip-song-btn');
    winnerAnnouncement = document.getElementById('winner-announcement');
    victoryStatsContainer = document.getElementById('victory-stats-container');
    playAgainBtn = document.getElementById('play-again-btn');
    newGameBtn = document.getElementById('new-game-btn');
    mainMenuLink = document.getElementById('main-menu-link');

    // Sett opp event listeners
    addPlayerBtn.addEventListener('click', handleAddPlayer);
    playerNameInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') handleAddPlayer(); });
    yearGuessInput.addEventListener('keyup', updateYearGuessRange); // Ny
    startGameBtn.addEventListener('click', startGame);
    submitGuessBtn.addEventListener('click', handleSubmitGuess);
    nextRoundBtn.addEventListener('click', advanceToNextPlayer);
    reportErrorBtn.addEventListener('click', () => handleGenericReport('Trenger sjekk'));
    brokenSongBtn.addEventListener('click', handleBrokenSong);
    buyHandicapBtn.addEventListener('click', handleBuyHandicap);
    skipSongBtn.addEventListener('click', handleSkipSong);
    playAgainBtn.addEventListener('click', handlePlayAgain);
    newGameBtn.addEventListener('click', handleNewGame);
    
    editSongBtn.addEventListener('click', () => {
        if (currentSong) {
            window.open(`admin.html?editSongId=${currentSong.id}`, '_blank');
        }
    });
});

// === NY FUNKSJON ===
function updateYearGuessRange() {
    const yearGuess = parseInt(yearGuessInput.value, 10);
    if (isNaN(yearGuess) || yearGuessInput.value.length < 4) {
        yearRangeDisplay.textContent = '';
        return;
    }
    const currentPlayer = players[currentPlayerIndex];
    const totalHandicap = currentPlayer.handicap + currentRoundHandicap;
    const startYear = yearGuess - totalHandicap;
    const endYear = yearGuess + totalHandicap;
    yearRangeDisplay.textContent = `(${startYear} - ${endYear})`;
}

// === SPILL-LOGIKK: START, SLUTT, OMSTART ===
async function startGame() {
    if (players.length === 0) return;
    players.forEach(p => {
        p.sp = 0;
        p.credits = 3;
        p.stats = { artistGuesses: 0, artistCorrect: 0, titleGuesses: 0, titleCorrect: 0, yearGuesses: 0, yearCorrect: 0, perfectYearGuesses: 0 };
    });
    victoryPoints = parseInt(victoryPointsInput.value, 10) || 10;
    preGameView.classList.add('hidden');
    victoryView.classList.add('hidden');
    inGameView.classList.remove('hidden');
    mainMenuLink.classList.remove('hidden');
    songHistory = [];
    currentPlayerIndex = 0;
    if (totalSongsInDb === 0) {
        const { count, error } = await supabaseClient.from('songs').select('*', { count: 'exact', head: true });
        if (!error) totalSongsInDb = count;
    }
    await populateAutocompleteLists();
    updateHud();
    playNextRound(false);
}
function handlePlayAgain() { startGame(); }
function handleNewGame() { players = []; resetGame(); }
function resetGame() {
    inGameView.classList.add('hidden');
    victoryView.classList.add('hidden');
    preGameView.classList.remove('hidden');
    mainMenuLink.classList.remove('hidden');
    updatePlayerListView();
    startGameBtn.disabled = true;
    startGameBtn.textContent = 'Legg til spillere for å starte';
}
function handleWin(winner) { pauseTrack(); showVictoryScreen(winner); }
function showVictoryScreen(winner) {
    inGameView.classList.add('hidden');
    preGameView.classList.add('hidden');
    mainMenuLink.classList.add('hidden');
    victoryView.classList.remove('hidden');
    winnerAnnouncement.textContent = `${winner.name} vinner spillet!`;
    let tableHTML = '<table class="stats-table"><thead><tr><th>Spiller</th><th>SP</th><th>Artist</th><th>Tittel</th><th>År (SP)</th><th>Perfekt År</th></tr></thead><tbody>';
    players.forEach(p => {
        const artistAccuracy = p.stats.artistGuesses > 0 ? `${Math.round((p.stats.artistCorrect / p.stats.artistGuesses) * 100)}%` : 'N/A';
        const titleAccuracy = p.stats.titleGuesses > 0 ? `${Math.round((p.stats.titleCorrect / p.stats.titleGuesses) * 100)}%` : 'N/A';
        const yearAccuracy = p.stats.yearGuesses > 0 ? `${Math.round((p.stats.yearCorrect / p.stats.yearGuesses) * 100)}%` : 'N/A';
        tableHTML += `<tr><td>${p.name}</td><td>${p.sp}</td><td>${artistAccuracy} (${p.stats.artistCorrect}/${p.stats.artistGuesses})</td><td>${titleAccuracy} (${p.stats.titleCorrect}/${p.stats.titleGuesses})</td><td>${yearAccuracy} (${p.stats.yearCorrect}/${p.stats.yearGuesses})</td><td>${p.stats.perfectYearGuesses}</td></tr>`;
    });
    tableHTML += '</tbody></table>';
    victoryStatsContainer.innerHTML = tableHTML;
}

// === RUNDE-LOGIKK ===
function handleSubmitGuess() {
    const currentPlayer = players[currentPlayerIndex];
    const artistGuess = artistGuessInput.value.trim().toLowerCase();
    const titleGuess = titleGuessInput.value.trim().toLowerCase();
    const yearGuess = parseInt(yearGuessInput.value, 10);
    const correctArtistNormalized = currentSong.artist.toLowerCase();
    const correctTitleNormalized = currentSong.title.toLowerCase();
    const correctYear = currentSong.year;
    let roundSp = 0;
    let roundCredits = 0;
    let feedbackMessages = [];
    const artistIsCorrect = artistGuess !== '' && artistGuess === correctArtistNormalized;
    const titleIsCorrect = titleGuess !== '' && titleGuess === correctTitleNormalized;
    if (artistGuess !== '') currentPlayer.stats.artistGuesses++;
    if (titleGuess !== '') currentPlayer.stats.titleGuesses++;
    if (artistIsCorrect && titleIsCorrect) {
        roundCredits += 3;
        currentPlayer.stats.artistCorrect++;
        currentPlayer.stats.titleCorrect++;
        feedbackMessages.push("Artist & Tittel: +3 credits!");
    } else {
        if (artistIsCorrect) { roundCredits += 1; currentPlayer.stats.artistCorrect++; feedbackMessages.push("Artist: +1 credit!"); }
        if (titleIsCorrect) { roundCredits += 1; currentPlayer.stats.titleCorrect++; feedbackMessages.push("Tittel: +1 credit!"); }
    }
    if (!isNaN(yearGuess)) {
        currentPlayer.stats.yearGuesses++;
        const yearDifference = Math.abs(yearGuess - correctYear);
        if (yearDifference === 0) { roundCredits += 3; currentPlayer.stats.perfectYearGuesses++; feedbackMessages.push("Perfekt år: +3 credits!"); }
        const totalHandicap = currentPlayer.handicap + currentRoundHandicap;
        if (yearDifference <= totalHandicap) { roundSp += 1; currentPlayer.stats.yearCorrect++; feedbackMessages.push("Årstall: +1 SP!"); }
    }
    currentPlayer.sp += roundSp;
    currentPlayer.credits += roundCredits;
    updateHud();
    if (feedbackMessages.length > 0) { roundStatus.textContent = feedbackMessages.join(' '); roundStatus.style.color = '#1DB954'; } else { roundStatus.textContent = "Ingen riktige svar denne runden."; roundStatus.style.color = '#FF4136'; }
    showAnswer();
    if (currentPlayer.sp >= victoryPoints) { nextRoundBtn.disabled = true; setTimeout(() => handleWin(currentPlayer), 500); }
}

function advanceToNextPlayer() { currentPlayerIndex = (currentPlayerIndex + 1) % players.length; updateHud(); playNextRound(false); }

async function playNextRound(isSkip = false) {
    currentRoundHandicap = 0;
    if (!isSkip) { updateTurnIndicator(); }
    reportErrorBtn.disabled = false;
    reportErrorBtn.textContent = 'Rapporter Annen Feil';
    editSongBtn.disabled = false;
    brokenSongBtn.disabled = false;
    roundStatus.textContent = 'Henter en ny sang...';
    roundStatus.style.color = '#fff';
    guessArea.classList.remove('hidden');
    answerDisplay.classList.add('hidden');
    nextRoundBtn.classList.add('hidden');
    artistGuessInput.value = '';
    titleGuessInput.value = '';
    yearGuessInput.value = '';
    yearRangeDisplay.textContent = ''; // Nullstill range-visning
    albumArt.src = '';
    currentSong = await fetchRandomSong();
    if (currentSong) {
        songHistory.push(currentSong.id);
        roundStatus.textContent = 'Starter avspilling...';
        const playbackSuccess = await playTrack(currentSong.spotifyid);
        if (playbackSuccess) { roundStatus.textContent = 'Sangen spilles...'; artistGuessInput.focus(); } else { roundStatus.textContent = 'Avspilling feilet. Prøv neste runde.'; }
    } else { roundStatus.textContent = 'Klarte ikke hente en sang. Prøv igjen.'; }
}

// === HJELPEFUNKSJONER ===
// ENDRET: Viser nå handicap
function updateTurnIndicator() {
    const currentPlayer = players[currentPlayerIndex];
    const totalHandicap = currentPlayer.handicap + currentRoundHandicap;
    turnIndicator.textContent = `${currentPlayer.name} sin tur (Handicap: ${totalHandicap})`;
}

// ENDRET: Kaller nå de nye visningsfunksjonene
function handleBuyHandicap() {
    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer.credits >= 1) {
        currentPlayer.credits -= 1;
        currentRoundHandicap += 2;
        updateHud();
        updateTurnIndicator(); // Oppdaterer handicap-visning
        updateYearGuessRange(); // Oppdaterer range-visning
    } else {
        roundStatus.textContent = 'Ikke nok credits!';
        roundStatus.style.color = '#FF4136';
    }
}

// ... (resten av hjelpefunksjonene er uendret) ...
window.onSpotifyWebPlaybackSDKReady = () => { spotifyAccessToken = localStorage.getItem('spotify_access_token'); if (spotifyAccessToken) { initializeSpotifyPlayer(spotifyAccessToken); } else { alert('Spotify-tilkobling mangler. Sender deg tilbake til hovedsiden.'); window.location.href = 'index.html'; } };
function initializeSpotifyPlayer(token) { if (spotifyPlayer) return; spotifyPlayer = new Spotify.Player({ name: 'MQuiz Spiller', getOAuthToken: cb => { cb(token); }, volume: 0.5 }); spotifyPlayer.addListener('ready', ({ device_id }) => { console.log('Spotify-spiller er klar med enhet-ID:', device_id); deviceId = device_id; startGameBtn.disabled = true; startGameBtn.textContent = 'Legg til spillere for å starte'; }); spotifyPlayer.addListener('not_ready', ({ device_id }) => { console.log('Enhet har gått offline', device_id); }); spotifyPlayer.addListener('authentication_error', ({ message }) => { console.error('Autentisering feilet:', message); alert('Spotify-autentisering feilet. Prøv å koble til på nytt fra hovedsiden.'); window.location.href = 'index.html'; }); spotifyPlayer.connect(); }
async function transferPlayback() { if (!deviceId) return; await fetch(`https://api.spotify.com/v1/me/player`, { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: false }), headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${spotifyAccessToken}` }, }); await new Promise(resolve => setTimeout(resolve, 500)); }
async function pauseTrack() { if (!deviceId) return; await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${spotifyAccessToken}` }, }); }
async function playTrack(spotifyTrackId) { if (!deviceId) { alert('Ingen aktiv Spotify-enhet funnet.'); return false; } await pauseTrack(); await new Promise(resolve => setTimeout(resolve, 100)); const trackUri = `spotify:track:${spotifyTrackId}`; const playUrl = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`; const playOptions = { method: 'PUT', body: JSON.stringify({ uris: [trackUri] }), headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${spotifyAccessToken}` }, }; try { const response = await fetch(playUrl, playOptions); if (!response.ok) throw new Error(`Spotify API svarte med ${response.status}`); return true; } catch (error) { if (error.message.includes("403")) { await transferPlayback(); try { const retryResponse = await fetch(playUrl, playOptions); if (!retryResponse.ok) throw new Error(`Spotify API svarte med ${retryResponse.status} på nytt forsøk`); return true; } catch (retryError) { alert("Klarte ikke starte avspilling. Sjekk at Spotify er aktiv og prøv neste runde."); return false; } } else { return false; } } }
function handleAddPlayer() { const name = playerNameInput.value.trim(); const handicap = parseInt(playerHandicapInput.value, 10); if (name && !players.some(p => p.name === name) && !isNaN(handicap) && handicap >= 0 && handicap <= 5) { players.push({ name: name, sp: 0, credits: 3, handicap: handicap, stats: { artistGuesses: 0, artistCorrect: 0, titleGuesses: 0, titleCorrect: 0, yearGuesses: 0, yearCorrect: 0, perfectYearGuesses: 0 } }); updatePlayerListView(); playerNameInput.value = ''; startGameBtn.disabled = false; } playerNameInput.focus(); }
function updatePlayerListView() { playerList.innerHTML = ''; players.forEach(player => { const li = document.createElement('li'); li.textContent = `${player.name} (Handicap: ${player.handicap})`; playerList.appendChild(li); }); }
async function populateAutocompleteLists() { if(artistList.length > 0) return; const { data: artists, error: artistError } = await supabaseClient.rpc('get_distinct_artists'); if (artistError) { console.error("Klarte ikke hente artistliste:", artistError); } else { artistList = artists.map(item => item.artist_name); artistDataList.innerHTML = artistList.map(artist => `<option value="${artist}"></option>`).join(''); } const { data: titles, error: titleError } = await supabaseClient.rpc('get_distinct_titles'); if (titleError) { console.error("Klarte ikke hente tittelliste:", titleError); } else { titleList = titles.map(item => item.title_name); titleDataList.innerHTML = titleList.map(title => `<option value="${title}"></option>`).join(''); } const { data: tags, error: tagsError } = await supabaseClient.from('tags').select('id, name'); if (tagsError) { console.error("Kunne ikke hente tags for rapportering"); } else { allTags = tags; } }
async function handleBrokenSong() { const success = await handleGenericReport('Feil årstall', brokenSongBtn); if (success) { await pauseTrack(); roundStatus.textContent = '✓ Rapportert! Gir ny sang...'; roundStatus.style.color = '#1DB954'; setTimeout(() => playNextRound(true), 1500); } }
async function handleSkipSong() { const currentPlayer = players[currentPlayerIndex]; if (currentPlayer.credits >= 1) { currentPlayer.credits -= 1; updateHud(); await pauseTrack(); playNextRound(true); } else { roundStatus.textContent = 'Ikke nok credits!'; roundStatus.style.color = '#FF4136'; } }
async function handleGenericReport(tagName, button = reportErrorBtn) { if (!currentSong) return false; const errorTag = allTags.find(tag => tag.name === tagName); if (!errorTag) { console.error(`Taggen "${tagName}" finnes ikke i databasen.`); button.textContent = 'Feil: Tag mangler'; return false; } button.disabled = true; button.textContent = 'Rapporterer...'; const { data, error: checkError } = await supabaseClient.from('song_tags').select().eq('song_id', currentSong.id).eq('tag_id', errorTag.id); if (checkError) { console.error("Feil ved sjekk av tag:", checkError); button.textContent = 'Feil oppstod'; return false; } if (data.length > 0) { button.textContent = 'Allerede rapportert'; return true; } const { error: insertError } = await supabaseClient.from('song_tags').insert({ song_id: currentSong.id, tag_id: id }); if (insertError) { console.error("Klarte ikke rapportere:", insertError); button.textContent = 'Feil oppstod'; button.disabled = false; return false; } button.textContent = '✓ Rapportert!'; return true; }
function updateHud() { playerHud.innerHTML = ''; players.forEach((player, index) => { const playerInfoDiv = document.createElement('div'); playerInfoDiv.className = 'player-info'; if (index === currentPlayerIndex) { playerInfoDiv.classList.add('active-player'); } playerInfoDiv.innerHTML = ` <div class="player-name">${player.name}</div> <div class="player-stats">SP: ${player.sp} | Credits: ${player.credits}</div> `; playerHud.appendChild(playerInfoDiv); }); }
function showAnswer() { albumArt.src = currentSong.albumarturl || ''; correctArtist.textContent = currentSong.artist; correctTitle.textContent = currentSong.title; correctYear.textContent = currentSong.year; answerDisplay.classList.remove('hidden'); guessArea.classList.add('hidden'); nextRoundBtn.classList.remove('hidden'); nextRoundBtn.disabled = false; }
async function fetchRandomSong() { if (totalSongsInDb > 0 && songHistory.length >= totalSongsInDb) { songHistory = []; } const { data, error } = await supabaseClient.rpc('get_random_song', { excluded_ids: songHistory }); if (error || !data || !data[0]) { songHistory = []; const { data: fallbackData } = await supabaseClient.rpc('get_random_song', { excluded_ids: songHistory }); return fallbackData ? fallbackData[0] : null; } return data[0]; }
/* Version: #310 */
