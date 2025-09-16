// Configuración de Supabase
const SUPABASE_URL = 'https://lpsupabase.luispinta.com/'; // Reemplaza con tu URL de Supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.bZRDLg2HoJKCXPp_B6BD5s-qcZM6-NrKO8qtxBtFGTk'; // Reemplaza con tu clave anónima

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Función para verificar autenticación
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

// Función para redirigir si no autenticado
async function requireAuth() {
    const session = await checkAuth();
    if (!session) {
        window.location.href = 'login.html';
    }
    return session;
}

// Función para cerrar sesión
async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}