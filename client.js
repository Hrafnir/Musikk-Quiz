/* Version: #437 */
// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
let joinView, gameView, myTurnView, waitingForOthersView, roundSummaryView,
    attackView, besserwisserInputView, hijackInputView, gameCodeInput,
    playerNameInput, joinBtn, joinStatus, displayPlayerName, waitingStatus,
    artistGuessInput, titleGuessInput, yearGuessInput, submitAnswerBtn,
    playerHud, newGameLink, artistDataList, titleDataList, buyHandicapBtn,
    skipSongBtn, clientFasitAlbumArt, clientFasitArtist, clientFasitTitle,
    clientFasitYear, clientRoundFeedback, attackTimer, attackPromptText,
    besserwisserBtn, hijackBtn, besserwisserArtistInput, besserwisserTitleInput,
    submitBesserwisserBtn, hijackBidInput, hijackYearInput, submitHijackBtn;

// === STATE ===
let gameChannel = null, myName = '', players = [], currentPlayerName = '', attackInterval = null;

// === FUNKSJONER ===
function populateAutocompleteLists(artistList, titleList) { 
    if (artistList) { 
        artistDataList.innerHTML = artistList.map(artist => `<option value="${artist}"></option>`).join(''); 
    } 
    if (titleList) { 
        titleDataList.innerHTML = titleList.map(title => `<option value="${title}"></option>`).join(''); 
    } 
}
function updateHud() { 
    if (!playerHud) return; 
    playerHud.innerHTML = ''; 
    players.forEach(player => { 
        const playerInfoDiv = document.createElement('div'); 
        playerInfoDiv.className = 'player-info'; 
        if (player.name === currentPlayerName) { 
            playerInfoDiv.classList.add('active-player'); 
        } 
        playerInfoDiv.innerHTML = `<div class="player-name">${player.name}</div><div class="player-stats">SP: ${player.sp} | Credits: ${player.credits}</div>`; 
        playerHud.appendChild(playerInfoDiv); 
    }); 
}

function hideAllViews() {
    myTurnView.classList.add('hidden');
    waitingForOthersView.classList.add('hidden');
    roundSummaryView.classList.add('hidden');
    attackView.classList.add('hidden');
    besserwisserInputView.classList.add('hidden');
    hijackInputView.classList.add('hidden');
}

function submitAnswer() {
    const answer = { name: myName, artist: artistGuessInput.value.trim(), title: titleGuessInput.value.trim(), year: yearGuessInput.value.trim() };
    gameChannel.send({ type: 'broadcast', event: 'submit_answer', payload: answer });
    hideAllViews();
    waitingStatus.textContent = "Svaret ditt er sendt! Venter på resultat...";
    waitingForOthersView.classList.remove('hidden');
}
function buyHandicap() { gameChannel.send({ type: 'broadcast', event: 'buy_handicap', payload: { name: myName } }); }
function skipSong() { gameChannel.send({ type: 'broadcast', event: 'skip_song', payload: { name: myName } }); }

function declareAttack(choice) {
    hideAllViews();
    if (choice === 'besserwisser') {
        gameChannel.send({ type: 'broadcast', event: 'declare_besserwisser', payload: { name: myName } });
        waitingStatus.textContent = "Besserwisser-intensjon registrert! Venter på at alle skal bestemme seg...";
    } else if (choice === 'hijack') {
        gameChannel.send({ type: 'broadcast', event: 'declare_hijack', payload: { name: myName } });
        waitingStatus.textContent = "Hijack-intensjon registrert! Venter på at alle skal bestemme seg...";
    }
    waitingForOthersView.classList.remove('hidden');
}

function submitBesserwisser() {
    const answer = { name: myName, artist: besserwisserArtistInput.value.trim(), title: besserwisserTitleInput.value.trim() };
    gameChannel.send({ type: 'broadcast', event: 'submit_besserwisser', payload: answer });
    hideAllViews();
    waitingStatus.textContent = "Besserwisser-svar sendt! Venter på resultat...";
    waitingForOthersView.classList.remove('hidden');
}

function submitHijack() {
    const bid = parseInt(hijackBidInput.value, 10);
    const year = parseInt(hijackYearInput.value, 10);
    const myCredits = players.find(p => p.name === myName)?.credits || 0;
    if (isNaN(bid) || bid <= 0 || bid > myCredits) {
        alert(`Ugyldig bud. Du må by mellom 1 og ${myCredits} credits.`);
        return;
    }
    if (isNaN(year) || year.toString().length !== 4) {
        alert("Ugyldig årstall.");
        return;
    }
    const bidData = { name: myName, bid, year };
    gameChannel.send({ type: 'broadcast', event: 'submit_hijack', payload: bidData });
    hideAllViews();
    waitingStatus.textContent = "Hijack-bud sendt! Venter på resultat...";
    waitingForOthersView.classList.remove('hidden');
}
function handleNewGameLink(event) {
    event.preventDefault();
    if (confirm("Er du sikker på at du vil forlate dette spillet og starte på nytt?")) {
        localStorage.removeItem('mquiz_gamecode');
        localStorage.removeItem('mquiz_playername');
        window.location.reload();
    }
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
        populateAutocompleteLists(artistList, titleList); // Gjeninnført
        updateHud();
    });

    gameChannel.on('broadcast', { event: 'new_turn' }, (payload) => {
        clearInterval(attackInterval);
        hideAllViews();
        currentPlayerName = payload.payload.name;
        if (players.length > 0) updateHud();

        if (currentPlayerName === myName) {
            myTurnView.classList.remove('hidden');
            artistGuessInput.value = ''; titleGuessInput.value = ''; yearGuessInput.value = '';
        } else {
            waitingStatus.textContent = `Venter på ${currentPlayerName}...`;
            waitingForOthersView.classList.remove('hidden');
        }
    });

    gameChannel.on('broadcast', { event: 'attack_phase_start' }, (payload) => {
        if (myName === payload.payload.attacker) return;
        
        hideAllViews();
        attackView.classList.remove('hidden');
        attackPromptText.textContent = `${payload.payload.attacker} svarte feil! Velg angrep:`;
        besserwisserBtn.classList.toggle('hidden', !payload.payload.canBesserwiss);
        hijackBtn.classList.toggle('hidden', !payload.payload.canHijack);
        
        let timeLeft = 10;
        attackTimer.textContent = timeLeft;
        attackInterval = setInterval(() => {
            timeLeft--;
            attackTimer.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(attackInterval);
                hideAllViews();
                waitingStatus.textContent = "Angrepstiden er ute! Venter på resultat...";
                waitingForOthersView.classList.remove('hidden');
            }
        }, 1000);
    });

    gameChannel.on('broadcast', { event: 'execute_besserwisser' }, (payload) => {
        if (payload.payload.players.includes(myName)) {
            clearInterval(attackInterval);
            hideAllViews();
            besserwisserInputView.classList.remove('hidden');
        }
    });
    gameChannel.on('broadcast', { event: 'execute_hijack' }, (payload) => {
        if (payload.payload.players.includes(myName)) {
            clearInterval(attackInterval);
            hideAllViews();
            hijackInputView.classList.remove('hidden');
        }
    });

    gameChannel.on('broadcast', { event: 'round_result' }, (payload) => {
        clearInterval(attackInterval);
        hideAllViews();
        
        const { players: newPlayers, feedback, song, attackResultsHTML } = payload.payload;
        players = newPlayers;
        updateHud();
        
        clientFasitAlbumArt.src = song.albumarturl || '';
        clientFasitArtist.textContent = song.artist;
        clientFasitTitle.textContent = song.title;
        clientFasitYear.textContent = song.year;
        clientRoundFeedback.innerHTML = `<p>${feedback}</p>${attackResultsHTML || ''}`;
        
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

// === HOVED-INNGANGSPUNKT ===
document.addEventListener('DOMContentLoaded', () => {
    // Tildel alle DOM-elementer
    joinView = document.getElementById('join-view');
    gameView = document.getElementById('game-view');
    myTurnView = document.getElementById('my-turn-view');
    waitingForOthersView = document.getElementById('waiting-for-others-view');
    roundSummaryView = document.getElementById('round-summary-view');
    attackView = document.getElementById('attack-view');
    besserwisserInputView = document.getElementById('besserwisser-input-view');
    hijackInputView = document.getElementById('hijack-input-view');
    gameCodeInput = document.getElementById('game-code-input');
    playerNameInput = document.getElementById('player-name-input');
    joinBtn = document.getElementById('join-btn');
    joinStatus = document.getElementById('join-status');
    displayPlayerName = document.getElementById('display-player-name');
    waitingStatus = document.getElementById('waiting-status');
    artistGuessInput = document.getElementById('artist-guess-input');
    titleGuessInput = document.getElementById('title-guess-input');
    yearGuessInput = document.getElementById('year-guess-input');
    submitAnswerBtn = document.getElementById('submit-answer-btn');
    playerHud = document.getElementById('player-hud');
    newGameLink = document.getElementById('new-game-link');
    artistDataList = document.getElementById('artist-list');
    titleDataList = document.getElementById('title-list');
    buyHandicapBtn = document.getElementById('buy-handicap-btn');
    skipSongBtn = document.getElementById('skip-song-btn');
    clientFasitAlbumArt = document.getElementById('client-fasit-album-art');
    clientFasitArtist = document.getElementById('client-fasit-artist');
    clientFasitTitle = document.getElementById('client-fasit-title');
    clientFasitYear = document.getElementById('client-fasit-year');
    clientRoundFeedback = document.getElementById('client-round-feedback');
    attackTimer = document.getElementById('attack-timer');
    attackPromptText = document.getElementById('attack-prompt-text');
    besserwisserBtn = document.getElementById('besserwisser-btn');
    hijackBtn = document.getElementById('hijack-btn');
    besserwisserArtistInput = document.getElementById('besserwisser-artist-input');
    besserwisserTitleInput = document.getElementById('besserwisser-title-input');
    submitBesserwisserBtn = document.getElementById('submit-besserwisser-btn');
    hijackBidInput = document.getElementById('hijack-bid-input');
    hijackYearInput = document.getElementById('hijack-year-input');
    submitHijackBtn = document.getElementById('submit-hijack-btn');

    const savedCode = localStorage.getItem('mquiz_gamecode');
    const savedName = localStorage.getItem('mquiz_playername');
    if (savedCode && savedName) {
        myName = savedName;
        joinGame(savedCode, savedName);
    }

    joinBtn.addEventListener('click', () => {
        const code = gameCodeInput.value.trim();
        const name = playerNameInput.value.trim();
        if (code && name) { myName = name; joinGame(code, name); } 
        else { joinStatus.textContent = 'Du må fylle ut både spillkode og navn.'; }
    });
    
    submitAnswerBtn.addEventListener('click', submitAnswer);
    newGameLink.addEventListener('click', handleNewGameLink);
    buyHandicapBtn.addEventListener('click', buyHandicap);
    skipSongBtn.addEventListener('click', skipSong);
    besserwisserBtn.addEventListener('click', () => declareAttack('besserwisser'));
    hijackBtn.addEventListener('click', () => declareAttack('hijack'));
    submitBesserwisserBtn.addEventListener('click', submitBesserwisser);
    submitHijackBtn.addEventListener('click', submitHijack);
});
/* Version: #437 */
