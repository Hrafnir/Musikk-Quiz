/* Version: #295 */
// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = 'https://ldmkhaeauldafjzaxozp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbWtoYWVhdWxkYWZqemF4b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNjY0MTgsImV4cCI6MjA2ODY0MjQxOH0.78PkucLIkoclk6Wd6Lvcml0SPPEmUDpEQ1Ou7MPOPLM';

console.log('admin.js lastet. Oppretter Supabase-klient...');
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Supabase-klient opprettet:', supabaseClient);

// === STATE ===
let spotifyAccessToken = null;
let spotifyPlayer = null;
let deviceId = null;
let allGenres = [];
let allTags = [];

// === DOM ELEMENTS ===
let loginView, mainView, googleLoginBtn, logoutBtn, addSongForm, 
    statusMessage, genresContainer, tagsContainer,
    testSpotifyBtn, spotifyTestStatus, testCoverArt,
    bulkImportInput, bulkImportBtn, bulkImportLog,
    formSummary;

// === SPOTIFY PLAYER INITIALIZATION ===
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('Spotify SDK er klar.');
    spotifyAccessToken = localStorage.getItem('spotify_access_token');
    if (spotifyAccessToken) {
        console.log('Funnet Spotify token i localStorage, initialiserer spiller.');
        initializeSpotifyPlayer(spotifyAccessToken);
    } else {
        console.log('Ingen Spotify token i localStorage.');
    }
};

function initializeSpotifyPlayer(token) {
    if (spotifyPlayer) return;
    console.log('Kaller new Spotify.Player()');
    spotifyPlayer = new Spotify.Player({ name: 'MQuiz Admin Tester', getOAuthToken: cb => { cb(token); } });
    spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Admin Spotify-spiller er klar med enhet-ID:', device_id);
        deviceId = device_id;
    });
    spotifyPlayer.connect();
}

// === AUTHENTICATION & DATA ===
async function signInWithGoogle() {
    console.log('Starter innlogging med Google...');
    await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://hrafnir.github.io/Musikk-Quiz/admin.html' } });
}

async function signOut() {
    console.log('Starter utlogging...');
    await supabaseClient.auth.signOut();
}

async function populateCheckboxes() {
    console.log('--- Kjører populateCheckboxes ---');
    
    console.log('Forsøker å hente sjangre...');
    genresContainer.innerHTML = 'Henter sjangre fra DB...';
    const { data: genres, error: gError } = await supabaseClient.from('genre').select('id, name');
    console.log('Resultat fra sjanger-henting:', { genres, gError });

    if (gError) { 
        genresContainer.innerHTML = `<p style="color: red;">Kunne ikke laste sjangre: ${gError.message}</p>`; 
    } else { 
        allGenres = genres;
        genresContainer.innerHTML = genres.map(g => `<div><input type="checkbox" id="genre-${g.id}" name="genre" value="${g.id}"><label for="genre-${g.id}">${g.name}</label></div>`).join('');
        console.log('Sjangre populert i HTML.');
    }

    console.log('Forsøker å hente tags...');
    tagsContainer.innerHTML = 'Henter tags fra DB...';
    const { data: tags, error: tError } = await supabaseClient.from('tags').select('id, name');
    console.log('Resultat fra tag-henting:', { tags, tError });

    if (tError) { 
        tagsContainer.innerHTML = `<p style="color: red;">Kunne ikke laste tags: ${tError.message}</p>`; 
    } else { 
        allTags = tags;
        tagsContainer.innerHTML = tags.map(t => `<div><input type="checkbox" id="tag-${t.id}" name="tag" value="${t.id}"><label for="tag-${t.id}">${t.name}</label></div>`).join('');
        console.log('Tags populert i HTML.');
    }
    console.log('--- Ferdig med populateCheckboxes ---');
}

// === ENKEL SANG-HÅNDTERING (med logging) ===
async function handleTestSpotifyId() { /* ... uendret, mindre viktig nå ... */ }
async function handleAddSong(event) { /* ... uendret, mindre viktig nå ... */ }
async function importSingleTrack(trackObject) { /* ... uendret, mindre viktig nå ... */ }
async function handleBulkImport() { /* ... uendret, mindre viktig nå ... */ }
async function loadSongForEditing(songId) { console.log(`Klargjør for redigering av sang med ID: ${songId}`); statusMessage.textContent = `Laster sangdata for redigering (ID: ${songId})...`; }

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fyrt av. Henter DOM-elementer.');
    loginView = document.getElementById('admin-login-view');
    mainView = document.getElementById('admin-main-view');
    googleLoginBtn = document.getElementById('google-login-btn');
    logoutBtn = document.getElementById('logout-btn');
    addSongForm = document.getElementById('add-song-form');
    statusMessage = document.getElementById('status-message');
    genresContainer = document.getElementById('genres-container');
    tagsContainer = document.getElementById('tags-container');
    testSpotifyBtn = document.getElementById('test-spotify-btn');
    spotifyTestStatus = document.getElementById('spotify-test-status');
    testCoverArt = document.getElementById('test-cover-art');
    bulkImportInput = document.getElementById('bulk-import-input');
    bulkImportBtn = document.getElementById('bulk-import-btn');
    bulkImportLog = document.getElementById('bulk-import-log');
    formSummary = document.getElementById('form-summary');
    console.log('Alle DOM-elementer er hentet.');

    console.log('Setter opp event listeners...');
    googleLoginBtn.addEventListener('click', signInWithGoogle);
    logoutBtn.addEventListener('click', signOut);
    // ... andre listeners ...
    console.log('Event listeners satt opp.');

    console.log('Registrerer onAuthStateChange listener...');
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        console.log(`onAuthStateChange fyrt av. Event: ${_event}. Har session: ${!!session}`);

        if (session) {
            console.log('Session funnet. Bruker:', session.user.email);
            loginView.classList.add('hidden');
            mainView.classList.remove('hidden');
            console.log('Viser hovedinnhold.');
            
            await populateCheckboxes(); 

            spotifyAccessToken = localStorage.getItem('spotify_access_token');
            console.log(`Spotify token fra localStorage: ${spotifyAccessToken ? 'Funnet' : 'Ikke funnet'}`);
            if (window.Spotify && spotifyAccessToken && !spotifyPlayer) {
                initializeSpotifyPlayer(spotifyAccessToken);
            }

            const urlParams = new URLSearchParams(window.location.search);
            const songIdToEdit = urlParams.get('editSongId');
            if (songIdToEdit) {
                console.log(`Funnet sang-ID i URL: ${songIdToEdit}. Kaller loadSongForEditing.`);
                await loadSongForEditing(songIdToEdit);
            }

        } else {
            console.log('Ingen session funnet. Viser innloggingsskjerm.');
            loginView.classList.remove('hidden');
            mainView.classList.add('hidden');
        }
    });
    console.log('onAuthStateChange listener er registrert.');
});
/* Version: #295 */
