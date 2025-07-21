/* Version: #121 */
// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = 'https://vqzyrmpfuxfnjciwgyge.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxenlybXBmdXhmbmpjaXdneWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMDQ0NjksImV4cCI6MjA2ODU4MDQ2OX0.NWYzvjHwsIVn1D78_I3sdXta1-03Lze7MXiQcole65M';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM ELEMENTS ===
let loginView, mainView, googleLoginBtn, logoutBtn, addSongForm, 
    statusMessage, genresContainer, tagsContainer;

// === AUTHENTICATION FUNCTIONS ===
async function signInWithGoogle() {
    await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://hrafnir.github.io/Musikk-Quiz/admin.html' }
    });
}

async function signOut() {
    await supabaseClient.auth.signOut();
}

// === DATA FETCHING ===
async function populateCheckboxes() {
    // Henter sjangre
    const { data: genres, error: genresError } = await supabaseClient.from('genre').select('id, name');
    if (genresError) {
        genresContainer.textContent = 'Kunne ikke laste sjangre.';
        console.error('Feil ved henting av sjangre:', genresError);
    } else {
        genresContainer.innerHTML = genres
            .map(g => `<div><input type="checkbox" id="genre-${g.id}" name="genre" value="${g.id}"><label for="genre-${g.id}">${g.name}</label></div>`)
            .join('');
    }

    // Henter tags
    const { data: tags, error: tagsError } = await supabaseClient.from('tags').select('id, name');
    if (tagsError) {
        tagsContainer.textContent = 'Kunne ikke laste tags.';
        console.error('Feil ved henting av tags:', tagsError);
    } else {
        tagsContainer.innerHTML = tags
            .map(t => `<div><input type="checkbox" id="tag-${t.id}" name="tag" value="${t.id}"><label for="tag-${t.id}">${t.name}</label></div>`)
            .join('');
    }
}

// === FORM HANDLING ===
async function handleAddSong(event) {
    event.preventDefault();
    statusMessage.textContent = 'Lagrer sang...';
    statusMessage.style.color = '#FFDC00';

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        statusMessage.textContent = 'FEIL: Du er ikke logget inn. Prøv å laste siden på nytt.';
        statusMessage.style.color = '#FF4136';
        return;
    }

    const form = event.target;
    const songData = {
        artist: form.artist.value.trim(),
        title: form.title.value.trim(),
        album: form.album.value.trim() || null,
        year: parseInt(form.year.value, 10),
        spotifyId: form.spotifyId.value.trim(),
        albumArtUrl: form.albumArtUrl.value.trim() || null,
        trivia: form.trivia.value.trim() || null,
    };

    // 1. Lagre sangen
    const { data: newSong, error: songError } = await supabaseClient.from('songs').insert(songData).select('id').single();
    if (songError) {
        statusMessage.textContent = `FEIL ved lagring av sang: ${songError.message}`;
        statusMessage.style.color = '#FF4136';
        console.error(songError);
        return;
    }
    const newSongId = newSong.id;

    // 2. Koble sjangre
    const selectedGenreIds = Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(cb => parseInt(cb.value, 10));
    if (selectedGenreIds.length > 0) {
        const songGenresData = selectedGenreIds.map(genreId => ({ song_id: newSongId, genre_id: genreId }));
        const { error: genreLinkError } = await supabaseClient.from('song_genres').insert(songGenresData);
        if (genreLinkError) {
            statusMessage.textContent = `FEIL ved kobling av sjangre: ${genreLinkError.message}`;
            return;
        }
    }

    // 3. Koble tags
    const selectedTagIds = Array.from(document.querySelectorAll('input[name="tag"]:checked')).map(cb => parseInt(cb.value, 10));
    if (selectedTagIds.length > 0) {
        const songTagsData = selectedTagIds.map(tagId => ({ song_id: newSongId, tag_id: tagId }));
        const { error: tagLinkError } = await supabaseClient.from('song_tags').insert(songTagsData);
        if (tagLinkError) {
            statusMessage.textContent = `FEIL ved kobling av tags: ${tagLinkError.message}`;
            return;
        }
    }

    statusMessage.textContent = `Vellykket! "${songData.title}" er lagt til i databasen.`;
    statusMessage.style.color = '#1DB954';
    addSongForm.reset();
    form.artist.focus();
}

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    // Hent DOM-elementer
    loginView = document.getElementById('admin-login-view');
    mainView = document.getElementById('admin-main-view');
    googleLoginBtn = document.getElementById('google-login-btn');
    logoutBtn = document.getElementById('logout-btn');
    addSongForm = document.getElementById('add-song-form');
    statusMessage = document.getElementById('status-message');
    genresContainer = document.getElementById('genres-container');
    tagsContainer = document.getElementById('tags-container');

    // Sett opp event listeners
    googleLoginBtn.addEventListener('click', signInWithGoogle);
    logoutBtn.addEventListener('click', signOut);
    addSongForm.addEventListener('submit', handleAddSong);

    // Håndter visning basert på innloggingsstatus
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        if (session) {
            loginView.classList.add('hidden');
            mainView.classList.remove('hidden');
        } else {
            loginView.classList.remove('hidden');
            mainView.classList.add('hidden');
        }
    });

    // Last inn sjangre og tags umiddelbart, uavhengig av innlogging
    populateCheckboxes();
});
/* Version: #121 */
