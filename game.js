/* Version: #206 */
// === CONFIGURATION ===
const SUPABASE_URL = 'https://ldmkhaeauldafjzaxozp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbWtoYWVhdWxkYWZqemF4b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNjY0MTgsImV4cCI6MjA2ODY0MjQxOH0.78PkucLIkoclk6Wd6Lvcml0SPPEmUDpEQ1Ou7MPOPLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === STATE ===
let spotifyAccessToken = null;
let spotifyPlayer = null;
let deviceId = null;
let currentSong = null;
let score = 0;
let handicap = 5;
let artistList = [];
let songHistory = []; // NYTT: Holder styr på spilte sanger
let totalSongsInDb = 0; // NYTT: Holder styr på totalt antall sanger

// === DOM ELEMENTS ===
let preGameView, inGameView, startGameBtn,
    playerHud, scoreDisplay, handicapDisplay,
    answerDisplay, albumArt, correctArtist, correctTitle, correctYear,
    guessArea, artistGuessInput, titleGuessInput, yearGuessInput, submitGuessBtn,
    roundStatus, gameControls, nextRoundBtn,
    artistDataList;


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

function initializeSpotifyPlayer(token) {
    spotifyPlayer = new Spotify.Player({
        name: 'MQuiz Spiller',
        getOAuthToken: cb => { cb(token); },
        volume: 0.5
    });

    spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Spotify-spiller er klar med enhet-ID:', device_id);
        deviceId = device_id;
        startGameBtn.disabled = false;
        startGameBtn.textContent = 'Start Spill';
    });

    spotifyPlayer.addListener('not_ready', ({ device_id }) => { console.log('Enhet har gått offline', device_id); });
    spotifyPlayer.addListener('authentication_error', ({ message }) => {
        console.error('Autentisering feilet:', message);
        alert('Spotify-autentisering feilet. Prøv å koble til på nytt fra hovedsiden.');
        window.location.href = 'index.html';
    });

    spotifyPlayer.connect();
}

// NYTT: Egen funksjon for å pause avspilling
async function pauseTrack() {
    if (!deviceId) return;
    await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${spotifyAccessToken}`
        },
    });
}

// ENDRET: Mer robust avspillingsfunksjon
async function playTrack(spotifyTrackId) {
    if (!deviceId) {
        alert('Ingen aktiv Spotify-enhet funnet. Åpne Spotify på en enhet og prøv igjen.');
        return;
    }
    // Steg 1: Pause først for å unngå at gammel sang fortsetter
    await pauseTrack();
    
    // En bitteliten forsinkelse for å la Spotify-APIet "puste"
    await new Promise(resolve => setTimeout(resolve, 100));

    // Steg 2: Spill av den nye sangen
    const trackUri = `spotify:track:${spotifyTrackId}`;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [trackUri] }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${spotifyAccessToken}`
        },
    });
}


// === GAME LOGIC ===
async function populateArtistList() {
    console.log("Henter artistliste for autocomplete...");
    const { data, error } = await supabaseClient.rpc('get_distinct_artists');

    if (error) {
        console.error("Klarte ikke hente artistliste:", error);
        return;
    }
    
    artistList = data.map(item => item.artist_name);
    artistDataList.innerHTML = artistList.map(artist => `<option value="${artist}"></option>`).join('');
    console.log(`Artistliste lastet med ${artistList.length} unike artister.`);
}

// ENDRET: Bruker nå den nye, smarte databasefunksjonen
async function fetchRandomSong() {
    // Hvis vi har spilt over halvparten av sangene, nullstill historikken for å unngå å gå tom
    if (songHistory.length > totalSongsInDb / 2) {
        console.log("Nullstiller sanghistorikk.");
        songHistory = [];
    }

    const { data, error } = await supabaseClient.rpc('get_random_song', {
        excluded_ids: songHistory
    });

    if (error || !data || data.length === 0) {
        console.error("Klarte ikke hente en unik tilfeldig sang:", error);
        // Fallback: nullstill historikk og prøv igjen én gang
        songHistory = [];
        const { data: fallbackData, error: fallbackError } = await supabaseClient.rpc('get_random_song', { excluded_ids: songHistory });
        if (fallbackError || !fallbackData || fallbackData.length === 0) {
            alert("Klarte ikke hente en sang fra databasen.");
            return null;
        }
        return fallbackData[0];
    }
    
    return data[0];
}

async function startGame() {
    preGameView.classList.add('hidden');
    inGameView.classList.remove('hidden');
    score = 0;
    songHistory = []; // Nullstill historikk ved nytt spill
    updateScoreDisplay();
    updateHandicapDisplay();
    
    // Hent totalt antall sanger én gang ved start
    const { count, error } = await supabaseClient.from('songs').select('*', { count: 'exact', head: true });
    if (!error) totalSongsInDb = count;

    await populateArtistList();
    playNextRound();
}

async function playNextRound() {
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
        songHistory.push(currentSong.id); // Legg til sangen i historikken
        console.log("Spiller sang ID:", currentSong.id, "Historikk:", songHistory);
        roundStatus.textContent = 'Sangen spilles...';
        await playTrack(currentSong.spotifyid);
        artistGuessInput.focus();
    } else {
        roundStatus.textContent = 'Klarte ikke hente en sang. Prøv igjen.';
    }
}

function handleSubmitGuess() {
    let roundScore = 0;
    const artistGuess = artistGuessInput.value.trim().toLowerCase();
    const titleGuess = titleGuessInput.value.trim().toLowerCase();
    const yearGuess = parseInt(yearGuessInput.value, 10);

    const correctArtist = currentSong.artist.toLowerCase();
    const correctTitle = currentSong.title.toLowerCase();
    const correctYear = currentSong.year;

    if (artistGuess === correctArtist) roundScore++;
    if (titleGuess === correctTitle) roundScore++;
    
    if (yearGuess && Math.abs(yearGuess - correctYear) <= handicap) {
        roundScore++;
    }

    score += roundScore;
    updateScoreDisplay();

    roundStatus.textContent = `Du fikk ${roundScore} av 3 poeng denne runden!`;
    roundStatus.style.color = roundScore > 0 ? '#1DB954' : '#FF4136';

    showAnswer();
}

function showAnswer() {
    albumArt.src = currentSong.albumarturl || '';
    correctArtist.textContent = currentSong.artist;
    correctTitle.textContent = currentSong.title;
    correctYear.textContent = currentSong.year;
    
    answerDisplay.classList.remove('hidden');
    guessArea.classList.add('hidden');
    nextRoundBtn.classList.remove('hidden');
}

// === UI UPDATE FUNCTIONS ===
function updateScoreDisplay() {
    scoreDisplay.textContent = `Poeng: ${score}`;
}

function updateHandicapDisplay() {
    handicapDisplay.textContent = `Handicap: ${handicap}`;
}


// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    preGameView = document.getElementById('pre-game-view');
    inGameView = document.getElementById('in-game-view');
    startGameBtn = document.getElementById('start-game-btn');
    playerHud = document.getElementById('player-hud');
    scoreDisplay = document.getElementById('score-display');
    handicapDisplay = document.getElementById('handicap-display');
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

    startGameBtn.disabled = true;
    startGameBtn.textContent = 'Kobler til Spotify...';

    startGameBtn.addEventListener('click', startGame);
    submitGuessBtn.addEventListener('click', handleSubmitGuess);
    nextRoundBtn.addEventListener('click', playNextRound);
});
/* Version: #206 */
