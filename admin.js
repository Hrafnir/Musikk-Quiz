/* Version: #290 */
// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = 'https://ldmkhaeauldafjzaxozp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbWtoYWVhdWxkYWZqemF4b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNjY0MTgsImV4cCI6MjA2ODY0MjQxOH0.78PkucLIkoclk6Wd6Lvcml0SPPEmUDpEQ1Ou7MPOPLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    bulkImportInput, bulkImportBtn, bulkImportLog;

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
    const { data: genres, error: gError } = await supabaseClient.from('genre').select('id, name');
    if (gError) { genresContainer.innerHTML = '<p style="color: red;">Kunne ikke laste sjangre.</p>'; } 
    else { 
        allGenres = genres;
        genresContainer.innerHTML = genres.map(g => `<div><input type="checkbox" id="genre-${g.id}" name="genre" value="${g.id}"><label for="genre-${g.id}">${g.name}</label></div>`).join('');
    }

    const { data: tags, error: tError } = await supabaseClient.from('tags').select('id, name');
    if (tError) { tagsContainer.innerHTML = '<p style="color: red;">Kunne ikke laste tags.</p>'; } 
    else { 
        allTags = tags;
        tagsContainer.innerHTML = tags.map(t => `<div><input type="checkbox" id="tag-${t.id}" name="tag" value="${t.id}"><label for="tag-${t.id}">${t.name}</label></div>`).join('');
    }
}

// === ENKEL SANG-HÅNDTERING ===
async function handleTestSpotifyId() {
    let spotifyIdInput = document.getElementById('spotifyId');
    let rawInput = spotifyIdInput.value.trim();
    spotifyTestStatus.textContent = '';
    testCoverArt.classList.add('hidden');
    if (!spotifyAccessToken) { spotifyTestStatus.textContent = 'Koble til Spotify på hovedsiden først.'; return; }
    if (!rawInput) { spotifyTestStatus.textContent = 'Lim inn en Spotify ID/lenke.'; return; }

    let spotifyId = rawInput;
    if (rawInput.includes('spotify.com/track/')) {
        try { spotifyId = new URL(rawInput).pathname.split('/track/')[1].split('?')[0]; } 
        catch (e) { spotifyTestStatus.textContent = 'FEIL: Ugyldig lenke.'; return; }
    }
    
    spotifyTestStatus.textContent = 'Tester...';
    try {
        const response = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, { headers: { 'Authorization': `Bearer ${spotifyAccessToken}` } });
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

async function handleAddSong(event) {
    event.preventDefault();
    statusMessage.textContent = 'Lagrer...';
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { statusMessage.textContent = 'FEIL: Ikke logget inn.'; return; }
    
    const form = event.target;
    const songData = {
        artist: form.artist.value.trim(), title: form.title.value.trim(), album: form.album.value.trim() || null, year: parseInt(form.year.value, 10),
        spotifyid: form.spotifyId.value.trim(), albumarturl: form.albumArtUrl.value.trim() || null, trivia: form.trivia.value.trim() || null, user_id: session.user.id,
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
    addSongForm.reset();
    spotifyTestStatus.textContent = '';
    testCoverArt.classList.add('hidden');
    form.spotifyId.focus();
}

// === MASSE-IMPORT FUNKSJONALITET ===
async function importSingleTrack(trackObject) { /* ... (uendret) ... */ }
async function handleBulkImport() { /* ... (uendret) ... */ }

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

    googleLoginBtn.addEventListener('click', signInWithGoogle);
    logoutBtn.addEventListener('click', signOut);
    addSongForm.addEventListener('submit', handleAddSong);
    testSpotifyBtn.addEventListener('click', handleTestSpotifyId);
    bulkImportBtn.addEventListener('click', handleBulkImport);
    
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        // KORRIGERT: Kaller populateCheckboxes() her for å garantere at Supabase-klienten er klar.
        await populateCheckboxes(); 

        if (session) {
            loginView.classList.add('hidden');
            mainView.classList.remove('hidden');
            spotifyAccessToken = localStorage.getItem('spotify_access_token');
            if (window.Spotify && spotifyAccessToken) {
                initializeSpotifyPlayer(spotifyAccessToken);
            }
        } else {
            loginView.classList.remove('hidden');
            mainView.classList.add('hidden');
        }
    });
});

// --- Kopiert inn uendrede funksjoner ---
async function importSingleTrack(trackObject) { const { url, genres = [], tags = [] } = trackObject; let spotifyId = url; if (url.includes('spotify.com/track/')) { try { spotifyId = new URL(url).pathname.split('/track/')[1].split('?')[0]; } catch (e) { return { success: false, message: `✗ Ugyldig lenke: ${url}` }; } } try { const response = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, { headers: { 'Authorization': `Bearer ${spotifyAccessToken}` } }); if (!response.ok) throw new Error(`Spotify feil (${response.status})`); const track = await response.json(); const { data: { session } } = await supabaseClient.auth.getSession(); const songData = { artist: track.artists.map(a => a.name).join(', '), title: track.name, album: track.album.name, year: parseInt(track.album.release_date.substring(0, 4), 10), spotifyid: spotifyId, albumarturl: (track.album.images && track.album.images.length > 0) ? track.album.images[0].url : null, user_id: session.user.id }; const { data: newSong, error: songError } = await supabaseClient.from('songs').insert(songData).select('id').single(); if (songError) { if (songError.code === '23505') return { success: false, message: `⚠️ "${songData.title}" finnes allerede.` }; throw new Error(`Supabase feil: ${songError.message}`); } const genreIdsToInsert = allGenres.filter(g => genres.includes(g.name)).map(g => g.id); if (genreIdsToInsert.length > 0) await supabaseClient.from('song_genres').insert(genreIdsToInsert.map(id => ({ song_id: newSong.id, genre_id: id }))); const tagIdsToInsert = allTags.filter(t => tags.includes(t.name)).map(t => t.id); if (tagIdsToInsert.length > 0) await supabaseClient.from('song_tags').insert(tagIdsToInsert.map(id => ({ song_id: newSong.id, tag_id: id }))); return { success: true, message: `✓ Importerte "${songData.title}"` }; } catch (error) { return { success: false, message: `✗ FEIL for ${spotifyId}: ${error.message}` }; } }
async function handleBulkImport() { const rawInput = bulkImportInput.value.trim(); let songsToImport; try { songsToImport = JSON.parse(rawInput); if (!Array.isArray(songsToImport)) throw new Error(); } catch (e) { bulkImportLog.innerHTML = 'FEIL: Ugyldig JSON-format.'; return; } if (songsToImport.length === 0) { bulkImportLog.innerHTML = 'JSON-listen er tom.'; return; } bulkImportLog.innerHTML = `Starter import av ${songsToImport.length} sanger...\n\n`; bulkImportBtn.disabled = true; bulkImportBtn.textContent = 'Importerer...'; for (let i = 0; i < songsToImport.length; i++) { const result = await importSingleTrack(songsToImport[i]); bulkImportLog.innerHTML += `(${i + 1}/${songsToImport.length}) ${result.message}\n`; bulkImportLog.scrollTop = bulkImportLog.scrollHeight; await new Promise(resolve => setTimeout(resolve, 300)); } bulkImportLog.innerHTML += '\nImport fullført!'; bulkImportBtn.disabled = false; bulkImportBtn.textContent = 'Start Import'; }
/* Version: #290 */
