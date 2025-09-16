// La configuración de Supabase está en config.js
// supabase ya está inicializado globalmente

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            errorMessage.textContent = error.message;
        } else {
            // Login exitoso, redirigir a index.html
            window.location.href = 'index.html';
        }
    } catch (error) {
        errorMessage.textContent = 'Error al iniciar sesión';
        console.error('Error:', error);
    }
});