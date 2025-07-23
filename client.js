/* Version: #351 */
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
const playerHud = document.getElementById('player-hud');

// === STATE ===
let gameChannel = null;
let myName = '';
let players = [];
let currentPlayerName = '';

// === FUNKSJONER ===
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
        name: myName, // Inkluder navnet for sikkerhets skyld
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

async function joinGame(code, name) {
    joinStatus.textContent = 'Kobler til...';
    joinBtn.disabled = true;

    const channelName = `game-${code}`;
    gameChannel = supabaseClient.channel(channelName);

    // LYTTERE FOR SPILLHENDELSER
    gameChannel.on('broadcast', { event: 'game_start' }, (payload) => {
        joinView.classList.add('hidden');
        gameView.classList.remove('hidden');
        players = payload.payload.players; // Motta start-tilstand
        updateHud();
    });

    gameChannel.on('broadcast', { event: 'new_turn' }, (payload) => {
        currentPlayerName = payload.payload.name;
        if (players.length > 0) updateHud();

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
        players = payload.payload.players;
        updateHud();
    });

    gameChannel.on('broadcast', { event: 'player_update' }, (payload) => {
        players = payload.payload.players;
        updateHud();
    });

    gameChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            // Lagre info for reconnection
            localStorage.setItem('mquiz_gamecode', code);
            localStorage.setItem('mquiz_playername', name);
            
            // Send melding til host
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
            localStorage.removeItem('mquiz_gamecode'); // Rydd opp ved feil
            localStorage.removeItem('mquiz_playername');
        }
    });
}

// === HOVED-INNGANGSPUNKT ===
document.addEventListener('DOMContentLoaded', () => {
    const savedCode = localStorage.getItem('mquiz_gamecode');
    const savedName = localStorage.getItem('mquiz_playername');

    if (savedCode && savedName) {
        // Prøv å koble til på nytt automatisk
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
});
/* Version: #351 */
