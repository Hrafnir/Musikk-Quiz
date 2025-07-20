/* Version: #104 */
// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = 'https://vqzyrmpfuxfnciwgyge.supabase.co';
// KORRIGERT: Rettet skrivefeil i nøkkelen
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxenlybXBmdXhmbmpjaXdneWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMDQ0NjksImV4cCI6MjA2ODU4MDQ2OX0.NWYzvjHwsIVn1D78_I3sdXta1-03Lze7MXiQcole65M';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// === DOM ELEMENTS ===
const addSongForm = document.getElementById('add-song-form');
const statusMessage = document.getElementById('status-message');
const genresContainer = document.getElementById('genres-container');
const tagsContainer = document.getElementById('tags-container');

/**
 * Henter sjangre og tags fra databasen og bygger avkrysningsbokser
 */
async function populateCheckboxes() {
    // Hent sjangre
    const { data: genres, error: genresError } = await supabaseClient.from('genres').select('id, name');
    if (genresError) {
        genresContainer.textContent = 'Kunne ikke laste sjangre.';
        console.error(genresError);
    } else {
        genresContainer.innerHTML = genres.map(genre => `
            <div>
                <input type="checkbox" id="genre-${genre.id}" name="genre" value="${genre.id}">
                <label for="genre-${genre.id}">${genre.name}</label>
            </div>
        `).join('');
    }

    // Hent tags
    const { data: tags, error: tagsError } = await supabaseClient.from('tags').select('id, name');
    if (tagsError) {
        tagsContainer.textContent = 'Kunne ikke laste tags.';
        console.error(tagsError);
    } else {
        tagsContainer.innerHTML = tags.map(tag => `
            <div>
                <input type="checkbox" id="tag-${tag.id}" name="tag" value="${tag.id}">
                <label for="tag-${tag.id}">${tag.name}</label>
            </div>
        `).join('');
    }
}


/**
 * Håndterer innsending av skjemaet
 * @param {Event} event
 */
async function handleAddSong(event) {
    event.preventDefault();
    statusMessage.textContent = 'Lagrer sang...';
    statusMessage.style.color = '#FFDC00';

    // 1. Hent basisdata fra skjemaet
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

    // 2. Sett inn sangen i 'songs'-tabellen og få tilbake ID-en
    const { data: newSong, error: songError } = await supabaseClient
        .from('songs')
        .insert(songData)
        .select('id')
        .single();

    if (songError) {
        statusMessage.textContent = `FEIL ved lagring av sang: ${songError.message}`;
        statusMessage.style.color = '#FF4136';
        console.error(songError);
        return;
    }

    const newSongId = newSong.id;
    console.log(`Sang lagret med ID: ${newSongId}`);

    // 3. Håndter sjangre
    const selectedGenreIds = Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(cb => parseInt(cb.value, 10));
    if (selectedGenreIds.length > 0) {
        const songGenresData = selectedGenreIds.map(genreId => ({
            song_id: newSongId,
            genre_id: genreId
        }));
        const { error: genreLinkError } = await supabaseClient.from('song_genres').insert(songGenresData);
        if (genreLinkError) {
            statusMessage.textContent = `FEIL ved kobling av sjangre: ${genreLinkError.message}`;
            statusMessage.style.color = '#FF4136';
            return;
        }
    }

    // 4. Håndter tags
    const selectedTagIds = Array.from(document.querySelectorAll('input[name="tag"]:checked')).map(cb => parseInt(cb.value, 10));
    if (selectedTagIds.length > 0) {
        const songTagsData = selectedTagIds.map(tagId => ({
            song_id: newSongId,
            tag_id: tagId
        }));
        const { error: tagLinkError } = await supabaseClient.from('song_tags').insert(songTagsData);
        if (tagLinkError) {
            statusMessage.textContent = `FEIL ved kobling av tags: ${tagLinkError.message}`;
            statusMessage.style.color = '#FF4136';
            return;
        }
    }

    // 5. Suksess!
    statusMessage.textContent = `Vellykket! "${songData.title}" er lagt til i databasen.`;
    statusMessage.style.color = '#1DB954';
    addSongForm.reset();
    form.artist.focus();
}


// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    populateCheckboxes();
    addSongForm.addEventListener('submit', handleAddSong);
});
/* Version: #104 */
