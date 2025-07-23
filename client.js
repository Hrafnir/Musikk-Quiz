/* Version: #324 */
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

// === STATE ===
let gameChannel = null;
let myName = '';

// === FUNCTIONS ===
function submitAnswer() {
    const answer = {
        artist: artistGuessInput.value.trim(),
        title: titleGuessInput.value.trim(),
        year: yearGuessInput.value.trim()
    };
    console.log("Sender svar:", answer);
    gameChannel.send({
        type: 'broadcast',
        event: 'submit_answer',
        payload: answer
    });
    // Skjul input-felt etter å ha sendt svar
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
        console.log("Mottok game_start!");
        joinView.classList.add('hidden');
        gameView.classList.remove('hidden');
    });

    gameChannel.on('broadcast', { event: 'new_turn' }, (payload) => {
        const activePlayerName = payload.payload.name;
        console.log(`Ny tur for: ${activePlayerName}`);
        
        if (activePlayerName === myName) {
            // Det er min tur!
            waitingForOthersView.classList.add('hidden');
            myTurnView.classList.remove('hidden');
            artistGuessInput.value = '';
            titleGuessInput.value = '';
            yearGuessInput.value = '';
        } else {
            // Det er noen andres tur
            myTurnView.classList.add('hidden');
            waitingStatus.textContent = `Venter på ${activePlayerName}...`;
            waitingForOthersView.classList.remove('hidden');
        }
    });

    gameChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            gameChannel.send({
                type: 'broadcast',
                event: 'player_join',
                payload: { name: myName },
            });
            joinView.classList.add('hidden');
            gameView.classList.remove('hidden'); // Gå til spill-visning (venterom)
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
/* Version: #324 */
