/* Version: #314 */
// === INITIALIZATION ===
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === STATE ===
// spotifyAccessToken er fjernet. Vi henter token dynamisk.
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

// === NYTT: SPOTIFY AUTH FUNCTIONS (duplisert fra script.js/game.js) ===
async function refreshSpotifyToken() {
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    if (!refreshToken) return null;
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: SPOTIFY_CLIENT_ID,
        }),
    });
    if (!response.ok) { console.error('Klarte ikke å fornye Spotify token'); return null; }
    const data = await response.json();
    localStorage.setItem('spotify_access_token', data.access_token);
    if (data.refresh_token) { localStorage.setItem('spotify_refresh_token', data.refresh_token); }
    const expiresAt = Date.now() + data.expires_in * 1000;
    localStorage.setItem('spotify_token_expires_at', expiresAt);
    return data.access_token;
}

async function getValidSpotifyToken() {
    const expiresAt = localStorage.getItem('spotify_token_expires_at');
    const accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken || !expiresAt) return null;
    if (Date.now() > parseInt(expiresAt) - (5 * 60 * 1000)) {
        return await refreshSpotifyToken();
    }
    return accessToken;
}

// === SPOTIFY PLAYER INITIALIZATION (ENDRET) ===
window.onSpotifyWebPlaybackSDKReady = () => {
    if (localStorage.getItem('spotify_access_token')) {
        initializeSpotifyPlayer();
    }
};

function initializeSpotifyPlayer() {
    if (spotifyPlayer) return;
    spotifyPlayer = new Spotify.Player({
        name: 'MQuiz Admin Tester',
        getOAuthToken: async cb => {
            const token = await getValidSpotifyToken();
            if (token) cb(token);
        }
    });
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
    const token = await getValidSpotifyToken();
    if (!token) return;

    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
        headers: { 'Authorization': `Bearer ${token}` },
    });
}

// === AUTHENTICATION & DATA ===
async function signInWithGoogle() { await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://hrafnir.github.io/Musikk-Quiz/admin.html' } }); }
async function signOut() { await supabaseClient.auth.signOut(); }

async function populateCheckboxes() {
    genresContainer.innerHTML = 'Henter sjangre...';
    const { data: genres, error: gError } = await supabaseClient.from('genre').select('id, name');
    if (gError) { genresContainer.innerHTML = `<p style="color: red;">Kunne ikke laste sjangre: ${gError.message}</p>`; return; }
    allGenres = genres;
    genresContainer.innerHTML = genres.map(g => `<div><input type="checkbox" id="genre-${g.id}" name="genre" value="${g.id}"><label for="genre-${g.id}">${g.name}</label></div>`).join('');
    tagsContainer.innerHTML = 'Henter tags...';
    const { data: tags, error: tError } = await supabaseClient.from('tags').select('id, name');
    if (tError) { tagsContainer.innerHTML = `<p style="color: red;">Kunne ikke laste tags: ${tError.message}</p>`; return; }
    allTags = tags;
    tagsContainer.innerHTML = tags.map(t => `<div><input type="checkbox" id="tag-${t.id}" name="tag" value="${t.id}"><label for="tag-${t.id}">${t.name}</label></div>`).join('');
}

// === ENKEL SANG-HÅNDTERING (ADD/EDIT) ===
async function handleTestSpotifyId() {
    let spotifyIdInput = document.getElementById('spotifyId');
    let rawInput = spotifyIdInput.value.trim();
    spotifyTestStatus.textContent = '';
    testCoverArt.classList.add('hidden');
    
    const token = await getValidSpotifyToken();
    if (!token) { spotifyTestStatus.textContent = 'Koble til Spotify på hovedsiden først.'; return; }
    if (!rawInput) { spotifyTestStatus.textContent = 'Lim inn en Spotify ID/lenke.'; return; }

    let spotifyId = rawInput;
    if (rawInput.includes('spotify.com/track/')) {
        try { spotifyId = new URL(rawInput).pathname.split('/track/')[1].split('?')[0]; } 
        catch (e) { spotifyTestStatus.textContent = 'FEIL: Ugyldig lenke.'; return; }
    }
    
    spotifyTestStatus.textContent = 'Tester...';
    try {
        const response = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error(`Spotify feil (${response.status})`);
        const track = await response.json();
        
        spotifyIdInput.value = spotifyId;
        document.getElementById('artist').value = track.artists.map(a => a.name).join(', ');
        document.getElementById('title').value = track.name;
        document.getElementById('album').value = track.album.name;
        document.getElementById('year').value = track.album.release_date.substring(0, 4);
        const imageUrl = (track.album.images && track.album.images.length > 0) ? track.album.images[0].url : '';
        document.getElementById('albumArtUrl').value = imageUrl;
        testCoverArt.src = imageUrl;
        testCoverArt.classList.remove('hidden');
        spotifyTestStatus.textContent = '✓ Vellykket! Spiller av...';
        await playTestTrack(spotifyId);
    } catch (error) {
        spotifyTestStatus.textContent = `FEIL: ${error.message}`;
    }
}

async function handleFormSubmit(event) { event.preventDefault(); if (isEditMode) { /* TODO */ } else { await handleAddSong(); } }
async function handleAddSong() {
    statusMessage.textContent = 'Lagrer...';
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { statusMessage.textContent = 'FEIL: Ikke logget inn.'; return; }
    const songData = { artist: addSongForm.artist.value.trim(), title: addSongForm.title.value.trim(), album: addSongForm.album.value.trim() || null, year: parseInt(addSongForm.year.value, 10), spotifyid: addSongForm.spotifyId.value.trim(), albumarturl: addSongForm.albumArtUrl.value.trim() || null, trivia: addSongForm.trivia.value.trim() || null, user_id: session.user.id };
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

function resetForm() { addSongForm.reset(); spotifyTestStatus.textContent = ''; testCoverArt.classList.add('hidden'); testCoverArt.src = ''; document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false); isEditMode = false; currentEditSongId = null; formSummary.textContent = 'Legg til én sang'; saveSongBtn.textContent = 'Lagre Sang'; cancelEditBtn.classList.add('hidden'); statusMessage.textContent = ''; }
async function loadSongForEditing(songId) { statusMessage.textContent = `Laster sangdata for redigering (ID: ${songId})...`; /* TODO */ }

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
    formSummary = document.getElementById('form-summary');
    saveSongBtn = document.getElementById('save-song-btn');
    cancelEditBtn = document.getElementById('cancel-edit-btn');

    googleLoginBtn.addEventListener('click', signInWithGoogle);
    logoutBtn.addEventListener('click', signOut);
    addSongForm.addEventListener('submit', handleFormSubmit);
    cancelEditBtn.addEventListener('click', resetForm);
    testSpotifyBtn.addEventListener('click', handleTestSpotifyId);
    
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
            loginView.classList.add('hidden');
            mainView.classList.remove('hidden');
            await populateCheckboxes(); 
            if (window.Spotify && localStorage.getItem('spotify_access_token')) {
                initializeSpotifyPlayer();
            }
            const urlParams = new URLSearchParams(window.location.search);
            const songIdToEdit = urlParams.get('editSongId');
            if (songIdToEdit) { await loadSongForEditing(songIdToEdit); }
        } else {
            loginView.classList.remove('hidden');
            mainView.classList.add('hidden');
        }
    });
});
/* Version: #314 */
