/* Version: #47 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Verifiserer er klar.');

    // DOM-elementer
    const songSelector = document.getElementById('song-selector');
    const displayArea = document.getElementById('song-display-area');
    const generateLogBtn = document.getElementById('generate-log-btn');
    const clearLogBtn = document.getElementById('clear-log-btn');
    const logOutput = document.getElementById('log-output');

    // Tilstand
    let allSongs = [];
    let flaggedSongs = []; // Her lagrer vi sanger som blir flagget

    /**
     * Laster sanger fra songs.json og fyller ut nedtrekksmenyen
     */
    async function loadAndPopulateSongs() {
        try {
            const response = await fetch('songs.json');
            if (!response.ok) {
                throw new Error(`Klarte ikke hente songs.json: ${response.statusText}`);
            }
            allSongs = await response.json();
            songSelector.innerHTML = '<option value="">-- Velg en sang --</option>';
            allSongs.forEach((song, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${index + 1}: ${song.artist} - ${song.title}`;
                songSelector.appendChild(option);
            });
            console.log(`${allSongs.length} sanger lastet inn.`);
        } catch (error) {
            displayArea.innerHTML = `<p style="color: #FF4136;"><strong>FEIL:</strong> ${error.message}</p>`;
            console.error(error);
        }
    }

    /**
     * Viser detaljene for en valgt sang
     */
    function displaySongDetails() {
        const selectedIndex = songSelector.value;
        if (selectedIndex === "") {
            displayArea.innerHTML = '<p>Velg en sang fra listen over for å se detaljer.</p>';
            return;
        }
        const song = allSongs[selectedIndex];
        if (!song) return;

        displayArea.innerHTML = `
            <h3>${song.artist} - ${song.title} (${song.year})</h3>
            <hr>
            <h4>Album Cover Test:</h4>
            <p>Hvis bildet under er ødelagt, er lenken i JSON-filen feil.</p>
            <img 
                src="${song.albumArtUrl}" 
                alt="Album cover for ${song.title}" 
                style="max-width: 200px; border-radius: 8px; margin: 10px 0; border: 2px solid #fff;"
                onerror="this.style.border='2px solid #FF4136'; document.getElementById('error-msg').style.display='block';"
            >
            <p id="error-msg" style="display: none; color: #FF4136;"><strong>Bilde-URL feilet!</strong></p>
            
            <div id="flag-buttons" style="margin: 20px 0; padding: 10px; border: 1px dashed #555; border-radius: 5px;">
                <strong>Flagg en feil:</strong>
                <button class="flag-btn" data-error="Mangler/feil album cover">Mangler Cover</button>
                <button class="flag-btn" data-error="Spotify-lenke virker ikke">Feil Spotify-lenke</button>
                <button class="flag-btn" data-error="Annen feil (spesifiseres i logg)">Annen Feil</button>
            </div>
            
            <h4>Detaljer:</h4>
            <ul style="text-align: left; list-style-position: inside;">
                <li><strong>Spotify ID:</strong> ${song.spotifyId}</li>
                <li><strong>Varighet (ms):</strong> ${song.duration_ms}</li>
                <li><strong>Sjangre:</strong> ${song.genres.join(', ')}</li>
                <li><strong>Trivia:</strong> ${song.trivia}</li>
            </ul>
            
            <button id="play-song-btn" style="margin-top: 20px;">Test avspilling</button>
        `;

        // Legg til lytter for avspillingsknapp
        document.getElementById('play-song-btn').addEventListener('click', () => {
            window.open(`https://open.spotify.com/track/${song.spotifyId}`, 'spotify_test_player');
        });

        // Legg til lyttere for flagg-knapper
        document.querySelectorAll('.flag-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const errorType = event.target.dataset.error;
                flagSong(selectedIndex, errorType);
                event.target.style.backgroundColor = '#FF851B'; // Visuell bekreftelse
                event.target.textContent = 'Flagget!';
            });
        });
    }

    /**
     * Legger en sang til i listen over flaggede sanger
     * @param {string} songIndex - Indeksen til sangen i allSongs-arrayet
     * @param {string} errorType - Beskrivelse av feilen
     */
    function flagSong(songIndex, errorType) {
        const song = allSongs[songIndex];
        const flag = {
            artist: song.artist,
            title: song.title,
            spotifyId: song.spotifyId,
            error: errorType
        };

        // Unngå duplikater
        const isAlreadyFlagged = flaggedSongs.some(
            fs => fs.spotifyId === flag.spotifyId && fs.error === flag.error
        );

        if (!isAlreadyFlagged) {
            flaggedSongs.push(flag);
            console.log(`Flagget: ${song.title} - ${errorType}`);
        } else {
            console.log(`Allerede flagget for samme feil: ${song.title}`);
        }
    }

    /**
     * Genererer en formatert tekst-logg av flaggede sanger
     */
    function generateLog() {
        if (flaggedSongs.length === 0) {
            logOutput.value = "Ingen feil har blitt flagget ennå.";
            return;
        }

        let logText = `Feilrapport generert ${new Date().toLocaleString('no-NO')}\n`;
        logText += `Totalt antall feil: ${flaggedSongs.length}\n`;
        logText += "==================================================\n\n";

        flaggedSongs.forEach(flag => {
            logText += `Artist: ${flag.artist}\n`;
            logText += `Tittel: ${flag.title}\n`;
            logText += `Spotify ID: ${flag.spotifyId}\n`;
            logText += `FEIL: ${flag.error}\n`;
            logText += `--------------------------------------------------\n`;
        });

        logOutput.value = logText;
    }

    /**
     * Tømmer listen over flaggede sanger og tekstfeltet
     */
    function clearLog() {
        if (confirm('Er du sikker på at du vil slette feil-loggen?')) {
            flaggedSongs = [];
            logOutput.value = "Loggen er tømt.";
            console.log("Feil-loggen er tømt.");
        }
    }

    // Kjør funksjoner og sett opp lyttere
    loadAndPopulateSongs();
    songSelector.addEventListener('change', displaySongDetails);
    generateLogBtn.addEventListener('click', generateLog);
    clearLogBtn.addEventListener('click', clearLog);
});
/* Version: #47 */
