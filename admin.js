/* Version: #297 */
// === INITIALIZATION ===
// Nøklene hentes nå fra config.js

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === STATE ===
let spotifyAccessToken = null;
let spotifyPlayer = null;
let deviceId = null;
let allGenres = [];
let allTags = [];
let isEditMode = false;
let currentEditSongId = null;

// === DOM ELEMENTS ===
let loginView, mainView, googleLoginBtn, logoutBtn, addSongForm, 
    statusMessage, genresContainer, tagsContainer,
    testSpotifyBtn, spotifyTestStatus, testCoverArt,
    bulkImportInput, bulkImportBtn, bulkImportLog,
    formSummary, saveSongBtn, cancelEditBtn;

// === SPOTIFY PLAYER INITIALIZATION ===
window.onSpotifyWebPlaybackSDKReady = () => {
    spotifyAccessToken = localStorage.getItem('spotify_access_token');
    if (spotifyAccessToken) {
        initializeSpotifyPlayer(spotifyAccessToken);
    }
};

function initializeSpotifyPlayer(token) {
    if (spotifyPlayer) return;
    spotifyPlayer = new Spotify.Player({ name: 'MQuiz Admin Tester', getOAuthToken: cb => { cb(token); } });
    spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Admin Spotify-spiller er klar med enhet-ID:', device_id);
        deviceId = device_id;
    });
    spotifyPlayer.connect();
}

async function playTestTrack(trackId) {
    if (!deviceId) {
        spotifyTestStatus.textContent += ' | Ingen Spotify-spiller funnet.';
        spotifyTestStatus.style.color = '#FFDC00';
        return;
    }
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
        headers: { 'Authorization': `Bearer ${spotifyAccessToken}` },
    });
}

// === AUTHENTICATION & DATA ===
async function signInWithGoogle() {
    await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://hrafnir.github.io/Musikk-Quiz/admin.html' } });
}

async function signOut() {
    await supabaseClient.auth.signOut();
}

async function populateCheckboxes() {
    genresContainer.innerHTML = 'Henter sjangre...';
    const { data: genres, error: gError } = await supabaseClient.from('genre').select('id, name');
    if (gError) { 
        genresContainer.innerHTML = `<p style="color: red;">Kunne ikke laste sjangre: ${gError.message}</p>`; 
        return;
    }
    allGenres = genres;
    genresContainer.innerHTML = genres.map(g => `<div><input type="checkbox" id="genre-${g.id}" name="genre" value="${g.id}"><label for="genre-${g.id}">${g.name}</label></div>`).join('');

    tagsContainer.innerHTML = 'Henter tags...';
    const { data: tags, error: tError } = await supabaseClient.from('tags').select('id, name');
    if (tError) { 
        tagsContainer.innerHTML = `<p style="color: red;">Kunne ikke laste tags: ${tError.message}</p>`; 
        return;
    }
    allTags = tags;
    tagsContainer.innerHTML = tags.map(t => `<div><input type="checkbox" id="tag-${t.id}" name="tag" value="${t.id}"><label for="tag-${t.id}">${t.name}</label></div>`).join('');
}

// === ENKEL SANG-HÅNDTERING (ADD/EDIT) ===
async function handleFormSubmit(event) {
    event.preventDefault();
    if (isEditMode) {
        // Logikk for oppdatering kommer her
    } else {
        await handleAddSong();
    }
}

async function handleAddSong() {
    statusMessage.textContent = 'Lagrer...';
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { statusMessage.textContent = 'FEIL: Ikke logget inn.'; return; }
    
    const songData = {
        artist: addSongForm.artist.value.trim(), title: addSongForm.title.value.trim(), album: addSongForm.album.value.trim() || null, year: parseInt(addSongForm.year.value, 10),
        spotifyid: addSongForm.spotifyId.value.trim(), albumarturl: addSongForm.albumArtUrl.value.trim() || null, trivia: addSongForm.trivia.value.trim() || null, user_id: session.user.id,
    };

    const { data: newSong, error: songError } = await supabaseClient.from('songs').insert(songData).select('id').single();
    if (songError) { statusMessage.textContent = `FEIL: ${songError.message}`; return; }
    
    const newSongId = newSong.id;
    const selectedGenreIds = Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(cb => parseInt(cb.value));
    if (selectedGenreIds.length > 0) {
        const { error } = await supabaseClient.from('song_genres').insert(selectedGenreIds.map(id => ({ song_id: newSongId, genre_id: id })));
        if (error) { statusMessage.textContent = `FEIL ved sjangerkobling.`; return; }
    }
    const selectedTagIds = Array.from(document.querySelectorAll('input[name="tag"]:checked')).map(cb => parseInt(cb.value));
    if (selectedTagIds.length > 0) {
        const { error } = await supabaseClient.from('song_tags').insert(selectedTagIds.map(id => ({ song_id: newSongId, tag_id: id })));
        if (error) { statusMessage.textContent = `FEIL ved tag-kobling.`; return; }
    }

    statusMessage.textContent = `Vellykket! "${songData.title}" er lagt til.`;
    resetForm();
    addSongForm.spotifyId.focus();
}

// === HJELPEFUNKSJONER FOR SKJEMA ===
function resetForm() {
    addSongForm.reset();
    spotifyTestStatus.textContent = '';
    testCoverArt.classList.add('hidden');
    testCoverArt.src = '';
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    isEditMode = false;
    currentEditSongId = null;
    formSummary.textContent = 'Legg til én sang';
    saveSongBtn.textContent = 'Lagre Sang';
    cancelEditBtn.classList.add('hidden');
    statusMessage.textContent = '';
}

async function loadSongForEditing(songId) {
    statusMessage.textContent = `Laster sangdata for redigering (ID: ${songId})...`;
    // Fremtidig logikk for å fylle skjemaet vil komme her.
}

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
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
    saveSongBtn = document.getElementById('save-song-btn');
    cancelEditBtn = document.getElementById('cancel-edit-btn');

    googleLoginBtn.addEventListener('click', signInWithGoogle);
    logoutBtn.addEventListener('click', signOut);
    addSongForm.addEventListener('submit', handleFormSubmit);
    cancelEditBtn.addEventListener('click', resetForm);
    // ... andre listeners ...
    
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
            loginView.classList.add('hidden');
            mainView.classList.remove('hidden');
            
            await populateCheckboxes(); 

            spotifyAccessToken = localStorage.getItem('spotify_access_token');
            if (window.Spotify && spotifyAccessToken && !spotifyPlayer) {
                initializeSpotifyPlayer(spotifyAccessToken);
            }

            const urlParams = new URLSearchParams(window.location.search);
            const songIdToEdit = urlParams.get('editSongId');
            if (songIdToEdit) {
                await loadSongForEditing(songIdToEdit);
            }

        } else {
            loginView.classList.remove('hidden');
            mainView.classList.add('hidden');
        }
    });
});
/* Version: #297 */
