/* Version: #350 */
// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
const joinView = document.getElementById('join-view');
const gameView = document.getElementById('game-view');
const myTurnView = document.getElementById('my-turn-view');
const waitingForOthersView = document.getElementById('waiting-for-others-view');
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
const playerHud = document.getElementById('player-hud'); // Nytt

// === STATE ===
let gameChannel = null;
let myName = '';
let players = []; // Nytt
let currentPlayerName = ''; // Nytt

// === FUNKSJONER ===

// NY: Viser poengtavlen
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

function submitAnswer() {
    const answer = {
        artist: artistGuessInput.value.trim(),
        title: titleGuessInput.value.trim(),
        year: yearGuessInput.value.trim()
    };
    gameChannel.send({
        type: 'broadcast',
        event: 'submit_answer',
        payload: answer
    });
    myTurnView.classList.add('hidden');
    waitingStatus.textContent = "Svaret ditt er sendt! Venter på resultat...";
    waitingForOthersView.classList.remove('hidden');
}

async function joinGame() {
    const gameCode = gameCodeInput.value.trim();
    myName = playerNameInput.value.trim();

    if (!gameCode || !myName) {
        joinStatus.textContent = 'Du må fylle ut både spillkode og navn.';
        return;
    }

    joinStatus.textContent = 'Kobler til...';
    joinBtn.disabled = true;

    const channelName = `game-${gameCode}`;
    gameChannel = supabaseClient.channel(channelName);

    // LYTTERE FOR SPILLHENDELSER
    gameChannel.on('broadcast', { event: 'game_start' }, () => {
        joinView.classList.add('hidden');
        gameView.classList.remove('hidden');
    });

    gameChannel.on('broadcast', { event: 'new_turn' }, (payload) => {
        currentPlayerName = payload.payload.name;
        if (players.length > 0) updateHud(); // Oppdater HUD for å vise aktiv spiller

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

    // NY LYTTER: Mottar resultater og oppdatert poengstilling
    gameChannel.on('broadcast', { event: 'round_result' }, (payload) => {
        players = payload.payload.players;
        updateHud();
        // TODO: Vis en mer detaljert oppsummering av runden
    });

    gameChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            gameChannel.send({
                type: 'broadcast',
                event: 'player_join',
                payload: { name: myName },
            });
            joinView.classList.add('hidden');
            gameView.classList.remove('hidden');
            displayPlayerName.textContent = myName;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            joinStatus.textContent = 'Feil: Fant ikke spillet. Sjekk koden.';
            joinBtn.disabled = false;
        }
    });
}

// === EVENT LISTENERS ===
joinBtn.addEventListener('click', joinGame);
submitAnswerBtn.addEventListener('click', submitAnswer);
/* Version: #350 */
