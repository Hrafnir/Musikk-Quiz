/* Version: #444 */

// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
let collectorJoinView, gameCodeInput, playerNameInput, joinBtn, joinStatus,
    collectorGameView, playerHud, gameStatusText, displayPlayerName,
    answerSubmissionView, submitStatus,
    roundSummaryView,
    newGameLink;

// === STATE ===
let gameCode = '';
let myName = '';
let gameChannel = null;
let answersChannel = null;
let gameState = {};

// === HOVEDFUNKSJONER ===

/**
 * Tar imot et spillobjekt fra databasen og oppdaterer hele UI-en for å matche.
 * @param {object} gameData - Hele raden fra 'games'-tabellen.
 */
function renderGame(gameData) {
    if (!gameData) return;
    console.log("Client received new game state:", gameData);
    gameState = gameData.game_state;

    // Skjul/vis hovedseksjoner
    collectorJoinView.classList.add('hidden');
    collectorGameView.classList.remove('hidden');
    
    // Skjul under-seksjoner
    answerSubmissionView.classList.add('hidden');
    roundSummaryView.classList.add('hidden');

    // Oppdater HUD
    updateHud();

    // Vis riktig status/visning basert på spillstatus
    switch (gameData.status) {
        case 'lobby':
            gameStatusText.textContent = "Venter på at hosten skal starte spillet...";
            break;
        case 'in_progress':
            gameStatusText.textContent = `Runde ${gameState.currentRound} pågår!`;
            answerSubmissionView.classList.remove('hidden');
            break;
        case 'round_summary':
            gameStatusText.textContent = `Runde ${gameState.currentRound} er ferdig.`;
            roundSummaryView.classList.remove('hidden');
            break;
        case 'finished':
            gameStatusText.textContent = "Spillet er over!";
            // TODO: Vis vinnerinfo
            break;
    }
}

/**
 * Oppdaterer HUD-en på klienten.
 */
function updateHud() {
    if (!playerHud) return;
    const players = gameState.players || [];
    playerHud.innerHTML = ''; // Tømmer HUD
    players.forEach(player => {
        const songsCollected = player.songsCollected || 0;
        const playerInfoDiv = document.createElement('div');
        // Bruker 'player-info' som en generell klasse for styling
        playerInfoDiv.className = 'player-info'; 
        // Marker egen spiller
        if (player.name === myName) {
            playerInfoDiv.classList.add('active-player');
        }
        playerInfoDiv.innerHTML = `<div class="player-name">${player.name}</div><div class="player-stats">Sanger: ${songsCollected}</div>`;
        playerHud.appendChild(playerInfoDiv);
    });
}

// === DATABASE & REALTIME ===

/**
 * Setter opp sanntids-abonnementer etter at man har blitt med i et spill.
 */
function setupSubscriptions() {
    gameChannel = supabaseClient
        .channel(`game-${gameCode}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `game_code=eq.${gameCode}` }, 
            (payload) => {
                renderGame(payload.new);
            }
        )
        .subscribe();

    answersChannel = supabaseClient
        .channel(`answers-${gameCode}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'round_answers', filter: `game_code=eq.${gameCode}` },
            (payload) => {
                // Logikk for å vise hvem som har svart
                if (payload.new.player_id === myName) {
                    submitStatus.textContent = '✓ Svaret ditt er lagret!';
                }
            }
        )
        .subscribe();
}

/**
 * Håndterer logikken for å bli med i et spill.
 */
async function handleJoinGame() {
    gameCode = gameCodeInput.value.trim();
    myName = playerNameInput.value.trim();

    if (!gameCode || !myName) {
        joinStatus.textContent = 'Du må fylle ut både spillkode og navn.';
        return;
    }

    joinBtn.disabled = true;
    joinStatus.textContent = 'Sjekker spillkode...';

    try {
        // 1. Sjekk at spillet finnes
        const { data: gameData, error: gameError } = await supabaseClient
            .from('games')
            .select('game_state, status')
            .eq('game_code', gameCode)
            .single();

        if (gameError || !gameData) {
            throw new Error("Fant ikke noe spill med den koden.");
        }
        if (gameData.status !== 'lobby') {
            throw new Error("Det spillet har allerede startet.");
        }

        // 2. Legg til spilleren i spillets state
        const currentPlayers = gameData.game_state.players || [];
        if (currentPlayers.some(p => p.name === myName)) {
            // TODO: Håndter reconnect her senere
            throw new Error("En spiller med det navnet er allerede med.");
        }
        
        const newPlayer = { name: myName, songsCollected: 0 };
        const updatedPlayers = [...currentPlayers, newPlayer];
        
        const { error: updateError } = await supabaseClient
            .from('games')
            .update({ game_state: { ...gameData.game_state, players: updatedPlayers } })
            .eq('game_code', gameCode);

        if (updateError) {
            throw new Error("Kunne ikke legge deg til i spillet.");
        }

        // 3. Alt gikk bra, fortsett inn i spillet
        joinStatus.textContent = 'Koblet til!';
        // ENDRET: Bruker unike nøkler
        localStorage.setItem('mquiz_collector_client_gamecode', gameCode);
        localStorage.setItem('mquiz_collector_playername', myName);
        
        displayPlayerName.textContent = myName;
        gameState = { ...gameData.game_state, players: updatedPlayers };
        
        setupSubscriptions();
        renderGame({ status: 'lobby', game_state: gameState });

    } catch (error) {
        joinStatus.textContent = `Feil: ${error.message}`;
        joinBtn.disabled = false;
    }
}

function handleLeaveGame(event) {
    event.preventDefault();
    if (confirm("Er du sikker på at du vil forlate spillet?")) {
        // TODO: Legg til logikk for å fjerne spilleren fra databasen
        // ENDRET: Bruker unike nøkler
        localStorage.removeItem('mquiz_collector_client_gamecode');
        localStorage.removeItem('mquiz_collector_playername');
        window.location.reload();
    }
}


// === MAIN ENTRY POINT ===

document.addEventListener('DOMContentLoaded', () => {
    // Tildel DOM-elementer
    collectorJoinView = document.getElementById('collector-join-view');
    gameCodeInput = document.getElementById('game-code-input');
    playerNameInput = document.getElementById('player-name-input');
    joinBtn = document.getElementById('join-btn');
    joinStatus = document.getElementById('join-status');
    
    collectorGameView = document.getElementById('collector-game-view');
    playerHud = document.getElementById('player-hud');
    gameStatusText = document.getElementById('game-status-text');
    displayPlayerName = document.getElementById('display-player-name');
    
    answerSubmissionView = document.getElementById('answer-submission-view');
    submitStatus = document.getElementById('submit-status');
    
    roundSummaryView = document.getElementById('round-summary-view');
    newGameLink = document.getElementById('new-game-link');

    // Lyttere
    joinBtn.addEventListener('click', handleJoinGame);
    newGameLink.addEventListener('click', handleLeaveGame);

    // Sjekk om vi kan gjenoppta en økt
    // ENDRET: Bruker unike nøkler
    const savedCode = localStorage.getItem('mquiz_collector_client_gamecode');
    const savedName = localStorage.getItem('mquiz_collector_playername');
    if (savedCode && savedName) {
        // TODO: Implementer full reconnect-logikk. For nå, bare koble til kanalen.
        gameCode = savedCode;
        myName = savedName;
        displayPlayerName.textContent = myName;
        
        // Hent siste spilltilstand for å rendre UI-en korrekt
        supabaseClient.from('games').select('*').eq('game_code', gameCode).single().then(({data, error}) => {
            if (data && !error) {
                setupSubscriptions();
                renderGame(data);
            } else {
                // Spillet finnes ikke lenger, nullstill
                localStorage.clear();
                window.location.reload();
            }
        });
    }
});
/* Version: #444 */
