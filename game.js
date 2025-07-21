/* Version: #193 */
// === CONFIGURATION ===
const SUPABASE_URL = 'https://ldmkhaeauldafjzaxozp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbWtoYWVhdWxkYWZqemF4b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNjY0MTgsImV4cCI6MjA2ODY0MjQxOH0.78PkucLIkoclk6Wd6Lvcml0SPPEmUDpEQ1Ou7MPOPLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === STATE ===
let spotifyAccessToken = null;
let spotifyPlayer = null;
let deviceId = null;
let currentSong = null;
let score = 0; // NYTT: Poeng-variabel

// === DOM ELEMENTS ===
let preGameView, inGameView, startGameBtn,
    playerHud, scoreDisplay,
    answerDisplay, albumArt, correctArtist, correctTitle, correctYear,
    guessArea, artistGuessInput, titleGuessInput, yearGuessInput, submitGuessBtn,
    roundStatus, gameControls, nextRoundBtn;


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

async function playTrack(spotifyTrackId) {
    if (!deviceId) {
        alert('Ingen aktiv Spotify-enhet funnet. Åpne Spotify på en enhet og prøv igjen.');
        return;
    }
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
async function fetchRandomSong() {
    const { count, error: countError } = await supabaseClient
        .from('songs')
        .select('*', { count: 'exact', head: true });

    if (countError || count === 0) {
        console.error('Kunne ikke hente antall sanger:', countError);
        alert('Fant ingen sanger i databasen! Gå til admin-panelet og legg til noen sanger først.');
        return null;
    }

    const randomIndex = Math.floor(Math.random() * count);

    const { data: song, error: songError } = await supabaseClient
        .from('songs')
        .select('*')
        .range(randomIndex, randomIndex)
        .single();

    if (songError) {
        console.error('Kunne ikke hente tilfeldig sang:', songError);
        return null;
    }
    
    return song;
}

function startGame() {
    preGameView.classList.add('hidden');
    inGameView.classList.remove('hidden');
    score = 0; // Nullstill poeng ved start
    updateScoreDisplay(); // Vis start-poengsum
    playNextRound();
}

async function playNextRound() {
    roundStatus.textContent = 'Henter en ny sang...';
    roundStatus.style.color = '#fff';
    guessArea.classList.remove('hidden');
    answerDisplay.classList.add('hidden');
    nextRoundBtn.classList.add('hidden');
    
    // Tøm alle input-felt
    artistGuessInput.value = '';
    titleGuessInput.value = '';
    yearGuessInput.value = '';
    albumArt.src = '';

    currentSong = await fetchRandomSong();

    if (currentSong) {
        roundStatus.textContent = 'Sangen spilles...';
        await playTrack(currentSong.spotifyid);
        artistGuessInput.focus(); // Sett fokus på første felt
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
    if (yearGuess === correctYear) roundScore++;

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

function updateScoreDisplay() {
    scoreDisplay.textContent = `Poeng: ${score}`;
}


// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    // Hent alle DOM-elementer
    preGameView = document.getElementById('pre-game-view');
    inGameView = document.getElementById('in-game-view');
    startGameBtn = document.getElementById('start-game-btn');
    
    playerHud = document.getElementById('player-hud');
    scoreDisplay = document.getElementById('score-display');
    
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

    startGameBtn.disabled = true;
    startGameBtn.textContent = 'Kobler til Spotify...';

    startGameBtn.addEventListener('click', startGame);
    submitGuessBtn.addEventListener('click', handleSubmitGuess);
    nextRoundBtn.addEventListener('click', playNextRound);
});
/* Version: #193 */
