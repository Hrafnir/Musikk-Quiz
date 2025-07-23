/* Version: #384 */
// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
const joinView = document.getElementById('join-view');
const gameView = document.getElementById('game-view');
const myTurnView = document.getElementById('my-turn-view');
const waitingForOthersView = document.getElementById('waiting-for-others-view');
const roundSummaryView = document.getElementById('round-summary-view'); // Nytt
const gameCodeInput = document.getElementById('game-code-input');
const playerNameInput = document.getElementById('player-name-input');
const joinBtn = document.getElementById('join-btn');
const joinStatus = document.getElementById('join-status');
const displayPlayerName = document.getElementById('display-player-name');
const waitingStatus = document.getElementById('waiting-status');
const artistGuessInput = document.getElementById('artist-guess-input');
const titleGuessInput = document.getElementById('title-guess-input');
const yearGuessInput = document.getElementById('year-guess-input');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const playerHud = document.getElementById('player-hud');
const newGameLink = document.getElementById('new-game-link');
const artistDataList = document.getElementById('artist-list');
const titleDataList = document.getElementById('title-list');
const buyHandicapBtn = document.getElementById('buy-handicap-btn');
const skipSongBtn = document.getElementById('skip-song-btn');
const clientFasitAlbumArt = document.getElementById('client-fasit-album-art'); // Nytt
const clientFasitArtist = document.getElementById('client-fasit-artist'); // Nytt
const clientFasitTitle = document.getElementById('client-fasit-title'); // Nytt
const clientFasitYear = document.getElementById('client-fasit-year'); // Nytt
const clientRoundFeedback = document.getElementById('client-round-feedback'); // Nytt

// === STATE ===
let gameChannel = null;
let myName = '';
let players = [];
let currentPlayerName = '';

// === FUNKSJONER ===
function populateAutocompleteLists(artistList, titleList) { /* ... (uendret) ... */ }
function updateHud() { /* ... (uendret) ... */ }
function submitAnswer() {
    const answer = {
        name: myName,
        artist: artistGuessInput.value.trim(),
        title: titleGuessInput.value.trim(),
        year: yearGuessInput.value.trim()
    };
    gameChannel.send({ type: 'broadcast', event: 'submit_answer', payload: answer });
    myTurnView.classList.add('hidden');
    waitingStatus.textContent = "Svaret ditt er sendt! Venter på resultat...";
    waitingForOthersView.classList.remove('hidden');
}
function buyHandicap() {
    gameChannel.send({ type: 'broadcast', event: 'buy_handicap', payload: { name: myName } });
}
function skipSong() {
    gameChannel.send({ type: 'broadcast', event: 'skip_song', payload: { name: myName } });
}

async function joinGame(code, name) {
    joinStatus.textContent = 'Kobler til...';
    joinBtn.disabled = true;

    const channelName = `game-${code}`;
    gameChannel = supabaseClient.channel(channelName);

    // LYTTERE FOR SPILLHENDELSER
    gameChannel.on('broadcast', { event: 'game_start' }, (payload) => {
        joinView.classList.add('hidden');
        gameView.classList.remove('hidden');
        const { players: newPlayers, artistList, titleList } = payload.payload;
        players = newPlayers;
        populateAutocompleteLists(artistList, titleList);
        updateHud();
    });

    gameChannel.on('broadcast', { event: 'new_turn' }, (payload) => {
        currentPlayerName = payload.payload.name;
        if (players.length > 0) updateHud();
        
        roundSummaryView.classList.add('hidden'); // Skjul forrige fasit

        if (currentPlayerName === myName) {
            waitingForOthersView.classList.add('hidden');
            myTurnView.classList.remove('hidden');
            artistGuessInput.value = '';
            titleGuessInput.value = '';
            yearGuessInput.value = '';
        } else {
            myTurnView.classList.add('hidden');
            waitingStatus.textContent = `Venter på ${currentPlayerName}...`;
            waitingForOthersView.classList.remove('hidden');
        }
    });

    gameChannel.on('broadcast', { event: 'round_result' }, (payload) => {
        const { players: newPlayers, feedback, song } = payload.payload;
        players = newPlayers;
        updateHud();
        
        // Vis fasit
        clientFasitAlbumArt.src = song.albumarturl || '';
        clientFasitArtist.textContent = song.artist;
        clientFasitTitle.textContent = song.title;
        clientFasitYear.textContent = song.year;
        clientRoundFeedback.textContent = feedback;

        waitingForOthersView.classList.add('hidden');
        roundSummaryView.classList.remove('hidden');
    });

    gameChannel.on('broadcast', { event: 'player_update' }, (payload) => {
        players = payload.payload.players;
        const { artistList, titleList } = payload.payload;
        if (artistList && titleList) {
            populateAutocompleteLists(artistList, titleList);
        }
        updateHud();
    });

    gameChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            localStorage.setItem('mquiz_gamecode', code);
            localStorage.setItem('mquiz_playername', name);
            gameChannel.send({
                type: 'broadcast',
                event: 'player_join',
                payload: { name: name },
            });
            joinView.classList.add('hidden');
            gameView.classList.remove('hidden');
            displayPlayerName.textContent = name;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            joinStatus.textContent = 'Feil: Fant ikke spillet. Sjekk koden.';
            joinBtn.disabled = false;
            localStorage.removeItem('mquiz_gamecode');
            localStorage.removeItem('mquiz_playername');
        }
    });
}
function handleNewGameLink(event) {
    event.preventDefault();
    const confirmed = confirm("Er du sikker på at du vil forlate dette spillet og starte på nytt?");
    if (confirmed) {
        localStorage.removeItem('mquiz_gamecode');
        localStorage.removeItem('mquiz_playername');
        window.location.reload();
    }
}

// === HOVED-INNGANGSPUNKT ===
document.addEventListener('DOMContentLoaded', () => {
    const savedCode = localStorage.getItem('mquiz_gamecode');
    const savedName = localStorage.getItem('mquiz_playername');

    if (savedCode && savedName) {
        myName = savedName;
        joinGame(savedCode, savedName);
    }

    joinBtn.addEventListener('click', () => {
        const code = gameCodeInput.value.trim();
        const name = playerNameInput.value.trim();
        if (code && name) {
            myName = name;
            joinGame(code, name);
        } else {
            joinStatus.textContent = 'Du må fylle ut både spillkode og navn.';
        }
    });
    
    submitAnswerBtn.addEventListener('click', submitAnswer);
    newGameLink.addEventListener('click', handleNewGameLink);
    buyHandicapBtn.addEventListener('click', buyHandicap);
    skipSongBtn.addEventListener('click', skipSong);
});

// --- Kopiert inn uendrede funksjoner ---
function populateAutocompleteLists(artistList, titleList) { if (artistList) { artistDataList.innerHTML = artistList.map(artist => `<option value="${artist}"></option>`).join(''); } if (titleList) { titleDataList.innerHTML = titleList.map(title => `<option value="${title}"></option>`).join(''); } }
function updateHud() { if (!playerHud) return; playerHud.innerHTML = ''; players.forEach(player => { const playerInfoDiv = document.createElement('div'); playerInfoDiv.className = 'player-info'; if (player.name === currentPlayerName) { playerInfoDiv.classList.add('active-player'); } playerInfoDiv.innerHTML = `<div class="player-name">${player.name}</div><div class="player-stats">SP: ${player.sp} | Credits: ${player.credits}</div>`; playerHud.appendChild(playerInfoDiv); }); }
/* Version: #384 */
