/* Version: #81 */
// === SUPABASE CONFIGURATION ===
const SUPABASE_URL = 'https://vqzyrmpfuxfnjciwgyge.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxenlybXBmdXhmbmpjaXdneWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMDQ0NjksImV4cCI6MjA2ODU4MDQ2OX0.NWYzvjHwsIVn1D78_I3sdXta1-03Lze7MXiQcole65M';

// KORRIGERT: Riktig initialisering av Supabase-klienten
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// === DOM ELEMENTS ===
const loginView = document.getElementById('auth-login');
const loggedInView = document.getElementById('auth-loggedin');
const googleLoginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userEmailSpan = document.getElementById('user-email');


// === FUNCTIONS ===

/**
 * Håndterer innlogging med Google via Supabase
 */
async function signInWithGoogle() {
    console.log('Forsøker å logge inn med Google...');
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
    });
    if (error) {
        console.error('Feil under Google-innlogging:', error);
        alert('En feil oppstod under innlogging med Google.');
    }
}

/**
 * Håndterer utlogging
 */
async function signOut() {
    console.log('Forsøker å logge ut...');
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Feil under utlogging:', error);
    }
    // UI vil oppdateres av onAuthStateChange-lytteren
}

/**
 * Oppdaterer UI basert på brukerens innloggingsstatus
 * @param {object | null} user - Brukerobjektet fra Supabase, eller null
 */
function updateUI(user) {
    if (user) {
        // Bruker er logget inn
        loginView.classList.add('hidden');
        loggedInView.classList.remove('hidden');
        userEmailSpan.textContent = user.email;
    } else {
        // Bruker er logget ut
        loginView.classList.remove('hidden');
        loggedInView.classList.add('hidden');
        userEmailSpan.textContent = '';
    }
}


// === INITIALIZATION ===

// Sjekk at alle elementer ble funnet før vi legger til lyttere
if (googleLoginBtn && logoutBtn) {
    googleLoginBtn.addEventListener('click', signInWithGoogle);
    logoutBtn.addEventListener('click', signOut);
} else {
    console.error('Kunne ikke finne en eller flere knapper. Sjekk ID-ene i index.html.');
}

// Sjekk innloggingsstatus med en gang siden lastes
supabaseClient.auth.getSession().then(({ data: { session } }) => {
    console.log('Nåværende session:', session);
    updateUI(session?.user ?? null);
});

// Lytt etter endringer i innloggingsstatus (når bruker logger inn/ut)
supabaseClient.auth.onAuthStateChange((_event, session) => {
    console.log('Innloggingsstatus endret:', session);
    updateUI(session?.user ?? null);
});
/* Version: #81 */
