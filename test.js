/* Version: #246 */
// === KONFIGURASJON ===
// Sørg for at disse er 100% korrekte fra ditt Supabase-prosjekt.
const SUPABASE_URL = 'https://ldmkhaeauldafjzaxozp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbWtoYWVhdWxkYWZqemF4b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwNjY0MTgsImV4cCI6MjA2ODY0MjQxOH0.78PkucLIkoclk6Wd6Lvcml0SPPEmUDpEQ1Ou7MPOPLM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === DOM-ELEMENTER ===
const testBtn = document.getElementById('test-btn');
const resultContainer = document.getElementById('result-container');

// === TESTFUNKSJON ===
async function runSupabaseTest() {
    resultContainer.textContent = 'Prøver å hente sjangre fra databasen...';
    resultContainer.style.color = '#FFDC00'; // Gul

    // Dette er det eneste kallet vi gjør:
    const { data, error } = await supabaseClient.from('genre').select('*');

    if (error) {
        // HVIS DET FEILER:
        resultContainer.textContent = 'TEST FEILER!\n\n';
        resultContainer.textContent += `Feilmelding: ${error.message}\n\n`;
        resultContainer.textContent += `Hint: ${error.hint}\n\n`;
        resultContainer.textContent += `Detaljer: ${JSON.stringify(error, null, 2)}`;
        resultContainer.style.color = '#FF4136'; // Rød
        console.error("Test feilet:", error);
    } else {
        // HVIS DET FUNGERER:
        resultContainer.textContent = 'TEST VELLYKKET!\n\n';
        resultContainer.textContent += `Fant ${data.length} sjangre.\n\n`;
        resultContainer.textContent += 'Mottatt data:\n';
        resultContainer.textContent += JSON.stringify(data, null, 2);
        resultContainer.style.color = '#1DB954'; // Grønn
        console.log("Test vellykket:", data);
    }
}

// === EVENT LISTENER ===
testBtn.addEventListener('click', runSupabaseTest);
/* Version: #246 */
