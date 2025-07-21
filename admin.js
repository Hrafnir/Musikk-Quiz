/* Version: #239 */
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
let allSongs = []; // NYTT: Holder alle sanger med relasjoner
let editingSongId = null; // NYTT: Holder styr på hvilken sang vi redigerer

// === DOM ELEMENTS ===
let loginView, mainView, googleLoginBtn, logoutBtn, addSongForm, 
    statusMessage, genresContainer, tagsContainer,
    testSpotifyBtn, spotifyTestStatus, testCoverArt,
    bulkImportInput, bulkImportBtn, bulkImportLog,
    formSummary, saveSongBtn, cancelEditBtn, // NYE SKJEMA-ELEMENTER
    searchSongsInput, songEditList; // NYE REDIGERINGS-ELEMENTER

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
    spotifyPlayer.addListener('ready', ({ device_id }) => { deviceId = device_id; });
    spotifyPlayer.connect();
}

async function playTestTrack(trackId) { /* ... (uendret) ... */ }

// === AUTHENTICATION & DATA ===
async function signInWithGoogle() { /* ... (uendret) ... */ }
async function signOut() { /* ... (uendret) ... */ }

async function populateCheckboxes() {
    const { data: genres, error: gError } = await supabaseClient.from('genre').select('id, name');
    if (gError) { genresContainer.textContent = 'Kunne ikke laste sjangre.'; } 
    else { 
        allGenres = genres;
        genresContainer.innerHTML = genres.map(g => `<div><input type="checkbox" id="genre-${g.id}" name="genre" value="${g.id}"><label for="genre-${g.id}">${g.name}</label></div>`).join('');
    }

    const { data: tags, error: tError } = await supabaseClient.from('tags').select('id, name');
    if (tError) { tagsContainer.textContent = 'Kunne ikke laste tags.'; } 
    else { 
        allTags = tags;
        tagsContainer.innerHTML = tags.map(t => `<div><input type="checkbox" id="tag-${t.id}" name="tag" value="${t.id}"><label for="tag-${t.id}">${t.name}</label></div>`).join('');
    }
}

// === REDIGERINGSMODUS-FUNKSJONER ===
function populateSongEditList(songsToDisplay) {
    songEditList.innerHTML = '';
    if (songsToDisplay.length === 0) {
        songEditList.innerHTML = '<div class="song-edit-item">Ingen sanger funnet.</div>';
        return;
    }
    songsToDisplay.forEach(song => {
        const item = document.createElement('div');
        item.className = 'song-edit-item';
        item.dataset.songId = song.id;
        item.innerHTML = `<span>${song.title} <span class="artist">- ${song.artist}</span></span>`;
        item.addEventListener('click', () => handleEditSongClick(song.id));
        songEditList.appendChild(item);
    });
}

async function fetchAndDisplaySongs() {
    const { data: songs, error: songsError } = await supabaseClient.from('songs').select('*').order('artist', { ascending: true });
    if (songsError) { console.error("Feil ved henting av sanger:", songsError); return; }
    
    const { data: genres, error: genresError } = await supabaseClient.from('song_genres').select('*');
    if (genresError) { console.error("Feil ved henting av sjangerkoblinger:", genresError); return; }
    
    const { data: tags, error: tagsError } = await supabaseClient.from('song_tags').select('*');
    if (tagsError) { console.error("Feil ved henting av tag-koblinger:", tagsError); return; }

    // Kombiner dataen slik at hver sang har en liste med sjanger- og tag-IDer
    allSongs = songs.map(song => ({
        ...song,
        genre_ids: genres.filter(g => g.song_id === song.id).map(g => g.genre_id),
        tag_ids: tags.filter(t => t.song_id === song.id).map(t => t.tag_id)
    }));
    
    populateSongEditList(allSongs);
}

function handleSearchSongs() {
    const query = searchSongsInput.value.toLowerCase();
    const filteredSongs = allSongs.filter(song => 
        song.title.toLowerCase().includes(query) || 
        song.artist.toLowerCase().includes(query)
    );
    populateSongEditList(filteredSongs);
}

function handleEditSongClick(songId) {
    const song = allSongs.find(s => s.id === songId);
    if (!song) return;

    editingSongId = songId;

    // Fyll ut skjema
    document.getElementById('spotifyId').value = song.spotifyid;
    document.getElementById('artist').value = song.artist;
    document.getElementById('title').value = song.title;
    document.getElementById('album').value = song.album;
    document.getElementById('year').value = song.year;
    document.getElementById('albumArtUrl').value = song.albumarturl;
    document.getElementById('trivia').value = song.trivia;

    // Kryss av sjekkbokser
    document.querySelectorAll('input[name="genre"]').forEach(cb => cb.checked = song.genre_ids.includes(parseInt(cb.value)));
    document.querySelectorAll('input[name="tag"]').forEach(cb => cb.checked = song.tag_ids.includes(parseInt(cb.value)));

    // Oppdater UI til redigeringsmodus
    formSummary.textContent = `Redigerer: ${song.title}`;
    saveSongBtn.textContent = 'Oppdater Sang';
    cancelEditBtn.classList.remove('hidden');
    document.querySelector('details').open = true; // Åpne panelet
    window.scrollTo(0, 0); // Scroll til toppen
}

function cancelEditMode() {
    editingSongId = null;
    addSongForm.reset();
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    
    formSummary.textContent = 'Legg til én sang';
    saveSongBtn.textContent = 'Lagre Sang';
    cancelEditBtn.classList.add('hidden');
    statusMessage.textContent = '';
    spotifyTestStatus.textContent = '';
    testCoverArt.classList.add('hidden');
}

// === HOVEDFUNKSJON FOR SKJEMA (BÅDE LAGRE OG OPPDATER) ===
async function handleFormSubmit(event) {
    event.preventDefault();
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { statusMessage.textContent = 'FEIL: Ikke logget inn.'; return; }

    const form = event.target;
    const songData = {
        artist: form.artist.value.trim(), title: form.title.value.trim(), album: form.album.value.trim() || null, year: parseInt(form.year.value, 10),
        spotifyid: form.spotifyId.value.trim(), albumarturl: form.albumArtUrl.value.trim() || null, trivia: form.trivia.value.trim() || null, user_id: session.user.id,
    };
    const selectedGenreIds = Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(cb => parseInt(cb.value));
    const selectedTagIds = Array.from(document.querySelectorAll('input[name="tag"]:checked')).map(cb => parseInt(cb.value));

    if (editingSongId) {
        // --- OPPDATERINGS-LOGIKK ---
        statusMessage.textContent = 'Oppdaterer sang...';
        const { error: updateError } = await supabaseClient.from('songs').update(songData).eq('id', editingSongId);
        if (updateError) { statusMessage.textContent = `FEIL: ${updateError.message}`; return; }
        
        // Slett og gjenskap koblinger
        await supabaseClient.from('song_genres').delete().eq('song_id', editingSongId);
        if (selectedGenreIds.length > 0) await supabaseClient.from('song_genres').insert(selectedGenreIds.map(id => ({ song_id: editingSongId, genre_id: id })));
        
        await supabaseClient.from('song_tags').delete().eq('song_id', editingSongId);
        if (selectedTagIds.length > 0) await supabaseClient.from('song_tags').insert(selectedTagIds.map(id => ({ song_id: editingSongId, tag_id: id })));
        
        statusMessage.textContent = 'Vellykket! Sangen er oppdatert.';

    } else {
        // --- LAGRE NY SANG-LOGIKK ---
        statusMessage.textContent = 'Lagrer ny sang...';
        const { data: newSong, error: insertError } = await supabaseClient.from('songs').insert(songData).select('id').single();
        if (insertError) { statusMessage.textContent = `FEIL: ${insertError.message}`; return; }
        
        const newSongId = newSong.id;
        if (selectedGenreIds.length > 0) await supabaseClient.from('song_genres').insert(selectedGenreIds.map(id => ({ song_id: newSongId, genre_id: id })));
        if (selectedTagIds.length > 0) await supabaseClient.from('song_tags').insert(selectedTagIds.map(id => ({ song_id: newSongId, tag_id: id })));
        
        statusMessage.textContent = `Vellykket! "${songData.title}" er lagt til.`;
    }

    await fetchAndDisplaySongs(); // Oppdater listen
    cancelEditMode(); // Tilbakestill skjemaet
}

// === MASSE-IMPORT FUNKSJONALITET ===
// ... (uendret fra forrige versjon) ...
async function importSingleTrack(trackObject) { /* ... */ }
async function handleBulkImport() { /* ... */ }


// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    // Hent alle DOM-elementer
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
    searchSongsInput = document.getElementById('search-songs-input');
    songEditList = document.getElementById('song-edit-list');

    // Sett opp event listeners
    googleLoginBtn.addEventListener('click', signInWithGoogle);
    logoutBtn.addEventListener('click', signOut);
    addSongForm.addEventListener('submit', handleFormSubmit); // ENDRET
    testSpotifyBtn.addEventListener('click', handleTestSpotifyId);
    bulkImportBtn.addEventListener('click', handleBulkImport);
    cancelEditBtn.addEventListener('click', cancelEditMode); // NY
    searchSongsInput.addEventListener('input', handleSearchSongs); // NY

    populateCheckboxes(); 

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
            loginView.classList.add('hidden');
            mainView.classList.remove('hidden');
            spotifyAccessToken = localStorage.getItem('spotify_access_token');
            if (window.Spotify && spotifyAccessToken) {
                initializeSpotifyPlayer(spotifyAccessToken);
            }
            await fetchAndDisplaySongs(); // NY: Hent sanger ved innlogging
        } else {
            loginView.classList.remove('hidden');
            mainView.classList.add('hidden');
        }
    });
});

// --- Kopiert inn uendrede funksjoner for kompletthet ---
async function playTestTrack(trackId) { if (!deviceId) { spotifyTestStatus.textContent += ' | Ingen spiller funnet.'; return; } await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, { method: 'PUT', body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }), headers: { 'Authorization': `Bearer ${spotifyAccessToken}` }, }); }
async function signInWithGoogle() { await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://hrafnir.github.io/Musikk-Quiz/admin.html' } }); }
async function signOut() { await supabaseClient.auth.signOut(); }
async function handleTestSpotifyId() { let spotifyIdInput = document.getElementById('spotifyId'); let rawInput = spotifyIdInput.value.trim(); spotifyTestStatus.textContent = ''; testCoverArt.classList.add('hidden'); if (!spotifyAccessToken) { spotifyTestStatus.textContent = 'Koble til Spotify på hovedsiden først.'; return; } if (!rawInput) { spotifyTestStatus.textContent = 'Lim inn en Spotify ID/lenke.'; return; } let spotifyId = rawInput; if (rawInput.includes('spotify.com/track/')) { try { spotifyId = new URL(rawInput).pathname.split('/track/')[1].split('?')[0]; } catch (e) { spotifyTestStatus.textContent = 'FEIL: Ugyldig lenke.'; return; } } spotifyTestStatus.textContent = 'Tester...'; try { const response = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, { headers: { 'Authorization': `Bearer ${spotifyAccessToken}` } }); if (!response.ok) throw new Error(`Spotify feil (${response.status})`); const track = await response.json(); spotifyIdInput.value = spotifyId; document.getElementById('artist').value = track.artists.map(a => a.name).join(', '); document.getElementById('title').value = track.name; document.getElementById('album').value = track.album.name; document.getElementById('year').value = track.album.release_date.substring(0, 4); const imageUrl = (track.album.images && track.album.images.length > 0) ? track.album.images[0].url : ''; document.getElementById('albumArtUrl').value = imageUrl; testCoverArt.src = imageUrl; testCoverArt.classList.remove('hidden'); spotifyTestStatus.textContent = '✓ Vellykket! Spiller av...'; await playTestTrack(spotifyId); } catch (error) { spotifyTestStatus.textContent = `FEIL: ${error.message}`; } }
async function importSingleTrack(trackObject) { const { url, genres = [], tags = [] } = trackObject; let spotifyId = url; if (url.includes('spotify.com/track/')) { try { spotifyId = new URL(url).pathname.split('/track/')[1].split('?')[0]; } catch (e) { return { success: false, message: `✗ Ugyldig lenke: ${url}` }; } } try { const response = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, { headers: { 'Authorization': `Bearer ${spotifyAccessToken}` } }); if (!response.ok) throw new Error(`Spotify feil (${response.status})`); const track = await response.json(); const { data: { session } } = await supabaseClient.auth.getSession(); const songData = { artist: track.artists.map(a => a.name).join(', '), title: track.name, album: track.album.name, year: parseInt(track.album.release_date.substring(0, 4), 10), spotifyid: spotifyId, albumarturl: (track.album.images && track.album.images.length > 0) ? track.album.images[0].url : null, user_id: session.user.id }; const { data: newSong, error: songError } = await supabaseClient.from('songs').insert(songData).select('id').single(); if (songError) { if (songError.code === '23505') { return { success: false, message: `⚠️ "${songData.title}" finnes allerede i databasen.` }; } throw new Error(`Supabase feil: ${songError.message}`); } const genreIdsToInsert = allGenres.filter(g => genres.includes(g.name)).map(g => g.id); if (genreIdsToInsert.length > 0) { await supabaseClient.from('song_genres').insert(genreIdsToInsert.map(id => ({ song_id: newSong.id, genre_id: id }))); } const tagIdsToInsert = allTags.filter(t => tags.includes(t.name)).map(t => t.id); if (tagIdsToInsert.length > 0) { await supabaseClient.from('song_tags').insert(tagIdsToInsert.map(id => ({ song_id: newSong.id, tag_id: id }))); } return { success: true, message: `✓ Importerte "${songData.title}"` }; } catch (error) { return { success: false, message: `✗ FEIL for ${spotifyId}: ${error.message}` }; } }
async function handleBulkImport() { const rawInput = bulkImportInput.value.trim(); let songsToImport; try { songsToImport = JSON.parse(rawInput); if (!Array.isArray(songsToImport)) throw new Error(); } catch (e) { bulkImportLog.innerHTML = 'FEIL: Ugyldig JSON-format.'; return; } if (songsToImport.length === 0) { bulkImportLog.innerHTML = 'JSON-listen er tom.'; return; } bulkImportLog.innerHTML = `Starter import av ${songsToImport.length} sanger...\n\n`; bulkImportBtn.disabled = true; bulkImportBtn.textContent = 'Importerer...'; for (let i = 0; i < songsToImport.length; i++) { const result = await importSingleTrack(songsToImport[i]); bulkImportLog.innerHTML += `(${i + 1}/${songsToImport.length}) ${result.message}\n`; bulkImportLog.scrollTop = bulkImportLog.scrollHeight; await new Promise(resolve => setTimeout(resolve, 300)); } bulkImportLog.innerHTML += '\nImport fullført!'; bulkImportBtn.disabled = false; bulkImportBtn.textContent = 'Start Import'; }

/* Version: #239 */
