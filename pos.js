// La configuración de Supabase está en config.js
// supabase ya está inicializado globalmente

// Variables globales
let searchResults = [];
let highlightedIndex = -1;
let cart = JSON.parse(localStorage.getItem('pos_cart') || '[]'); // Cargar carrito del localStorage
let isEditing = false; // Variable para modo edición
let isSearching = false; // Variable para controlar si hay una búsqueda en curso
let isUpdatingQuantity = false; // Variable para prevenir múltiples actualizaciones simultáneas
let lastKeyPressTime = 0; // Timestamp del último evento de teclado
const KEY_DEBOUNCE_DELAY = 150; // Milisegundos entre eventos de teclado permitidos

// Función para guardar carrito en localStorage
function saveCartToLocalStorage() {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
}

// Función para formatear números para URLs (siempre con punto)
function formatNumberForURL(value) {
    if (isNaN(value) || value === null || value === undefined) {
        return '0.00';
    }
    return value.toFixed(2);
}

// Función para resetear el timestamp de teclado (útil para debugging y control)
function resetKeyTimestamp() {
    lastKeyPressTime = 0;
}

// Función para formatear moneda
function formatCurrency(value) {
    // Si el valor no es un número válido, intentar parsearlo
    if (typeof value === 'string') {
        value = parsePrice(value);
    }
    
    if (isNaN(value) || value === null || value === undefined) {
        return '$0.00';
    }
    
    // Usar formato ecuatoriano con coma como separador decimal
    return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

// Función para parsear precios que pueden venir con símbolos de moneda
function parsePrice(priceString) {
    if (typeof priceString !== 'string') {
        return parseFloat(priceString) || 0;
    }
    
    // Remover símbolos de moneda y espacios
    const cleaned = priceString.replace(/[$€£¥₹₽₩₦₨₪₫₡₵₺₴₸₼₲₱₭₯₰₳₶₷₹₻₽₾₿]/g, '').trim();
    
    // Reemplazar coma por punto para asegurar parseo correcto
    const normalized = cleaned.replace(',', '.');
    
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
}

// Función para agregar al carrito (global)
function addToCart(codigo) {
    const product = searchResults.find(p => p.codigo === codigo);
    if (!product) return;

    const existingItem = cart.find(item => item.codigo === codigo);
    if (existingItem) {
        existingItem.cantidad += 1;
    } else {
        cart.push({
            codigo: product.codigo,
            producto: product.producto,
            precio: parsePrice(product.precio),
            cantidad: 1
        });
    }

    updateCartDisplay();
    saveCartToLocalStorage(); // Guardar en localStorage
    
    // Limpiar completamente la búsqueda y resetear estado
    clearSearchState();
}

// Función para limpiar el estado de búsqueda
function clearSearchState() {
    const productSearch = document.getElementById('productSearch');
    const resultsContainer = document.getElementById('resultsContainer');
    
    if (productSearch) {
        productSearch.value = '';
        productSearch.focus();
    }
    
    if (resultsContainer) {
        resultsContainer.classList.add('hidden');
        // Resetear el scroll del contenedor
        const scrollContainer = document.querySelector('.results-container');
        if (scrollContainer) {
            scrollContainer.scrollTop = 0;
        }
    }
    
    searchResults = [];
    highlightedIndex = -1;
    isSearching = false;
    resetKeyTimestamp(); // Resetear timestamp
}

// Función para eliminar del carrito (global)
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartDisplay();
    saveCartToLocalStorage(); // Guardar en localStorage
}

// Función para limpiar carrito (global)
function clearCart() {
    cart = [];
    updateCartDisplay();
    saveCartToLocalStorage(); // Guardar en localStorage
    localStorage.removeItem('pos_cart'); // Limpiar también del localStorage
    
    // También limpiar el estado de búsqueda
    clearSearchState();
}

// Función para imprimir recibo (global)
function printReceipt() {
    if (cart.length === 0) {
        alert('El carrito está vacío');
        return;
    }

    // Preparar datos para la URL del recibo
    var cantidades = [];
    var servicios = [];
    var p_units = [];
    var p_total = [];

    cart.forEach((item) => {
        cantidades.push(item.cantidad);
        // Reemplazar comas por puntos en el nombre del producto
        var nombreProducto = item.producto.replace(/,/g, ".");
        servicios.push(encodeURIComponent(nombreProducto));
        p_units.push(item.precio);
        p_total.push(formatNumberForURL(item.precio * item.cantidad));
    });

    // Obtener fecha actual formateada
    var now = new Date();
    var formattedDate = now.toLocaleString('es-EC', {
        timeZone: 'America/Guayaquil',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(/[/]/g, '/').replace(',', '');

    // Calcular total
    var total = cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

    // Construir URL del recibo
    var url = "https://pos.manasakilla.com/RECIBO.html" +
        "?fecha=" + encodeURIComponent(formattedDate) +
        "&venta=" + encodeURIComponent("VENTA-" + Date.now()) +
        "&subtotal=" + encodeURIComponent(formatNumberForURL(total)) +
        "&descuento=0" +
        "&vendedor=CAJAPC" +
        "&nombre_cliente=" + encodeURIComponent("CONSUMIDOR FINAL") +
        "&cedula_cliente=" + encodeURIComponent("9999999999999") +
        "&direccion_cliente=" + encodeURIComponent("") +
        "&telefono_cliente=" + encodeURIComponent("") +
        "&cantidades=" + cantidades.join(',') +
        "&servicios=" + servicios.join(',') +
        "&p_units=" + p_units.join(',') +
        "&total=" + encodeURIComponent(formatNumberForURL(total)) +
        "&p_total=" + p_total.join(',') +
        "&tipo_documento=RECIBO";

    // Abrir el recibo
    window.open(url, '_blank');
    
    // Limpiar carrito después de imprimir
    setTimeout(() => {
        if (confirm('¿Desea limpiar el carrito después de imprimir el recibo?')) {
            clearCart();
        }
    }, 1000);
}

// Función para cerrar sesión (global)
async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

// Función para alternar modo edición (global)
function toggleEditable() {
    var cartTable = document.getElementById("cart");
    if (!cartTable) return;
    
    var rows = cartTable.getElementsByTagName('tr');
    isEditing = !isEditing;

    for (var i = 1; i < rows.length; i++) {
        var cells = rows[i].getElementsByTagName('td');
        if (cells.length >= 6) { // Asegurarse de que hay suficientes celdas
            if (isEditing) {
                // Hacer editables las celdas de precio (índice 2) y cantidad (índice 3)
                cells[2].contentEditable = "true";
                cells[3].contentEditable = "true";
                cells[2].classList.add("editable");
                cells[3].classList.add("editable");
                cells[2].addEventListener("blur", handleCellBlur);
                cells[3].addEventListener("blur", handleCellBlur);
                cells[2].addEventListener("keydown", handleCellKeyDown);
                cells[3].addEventListener("keydown", handleCellKeyDown);
                cells[2].setAttribute('data-old-value', cells[2].innerText);
                cells[3].setAttribute('data-old-value', cells[3].innerText);
            } else {
                cells[2].contentEditable = "false";
                cells[3].contentEditable = "false";
                cells[2].classList.remove("editable");
                cells[3].classList.remove("editable");
                cells[2].removeEventListener("blur", handleCellBlur);
                cells[3].removeEventListener("blur", handleCellBlur);
                cells[2].removeEventListener("keydown", handleCellKeyDown);
                cells[3].removeEventListener("keydown", handleCellKeyDown);
            }
        }
        rows[i].classList.remove("highlighted-row");
    }

    // Mostrar/ocultar indicador de modo edición
    var editModeButton = document.getElementById("editModeButton");
    if (editModeButton) {
        editModeButton.classList.toggle("edit-mode");
    }

    // Deshabilitar búsqueda mientras se edita
    var productSearch = document.getElementById('productSearch');
    if (productSearch) {
        productSearch.disabled = isEditing;
    }

    if (isEditing && rows.length > 1) {
        highlightRow(1); // Resaltar primera fila de productos
    } else if (productSearch) {
        productSearch.focus();
    }

    // Resetear timestamp al cambiar de modo
    resetKeyTimestamp();
    
    // Configurar event listeners para navegación
    setupNavigationListeners();
}

// Función para manejar cuando se pierde el foco de una celda editable
function handleCellBlur(event) {
    var cell = event.target;
    if (cell.cellIndex === 2 || cell.cellIndex === 3) { // Precio o cantidad
        updateCellTotal(cell);
    }
}

// Función para manejar teclas en celdas editables
function handleCellKeyDown(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        event.target.blur();
    } else if (event.key === "Escape") {
        event.preventDefault();
        event.target.innerText = event.target.getAttribute('data-old-value');
        event.target.blur();
    }
}

// Función para configurar los event listeners de navegación
function setupNavigationListeners() {
    // Remover listeners anteriores
    document.removeEventListener("keydown", handleArrowKeys);
    
    // Resetear timestamp para evitar interferencia entre modos
    resetKeyTimestamp();
    
    // Agregar listener para navegación
    document.addEventListener("keydown", handleArrowKeys);
}

// Función principal para manejar teclas de flecha
function handleArrowKeys(event) {
    if (isEditing) {
        handleEditModeKeys(event);
    } else {
        handleSearchModeKeys(event);
    }
}

// Función para manejar teclas en modo edición
function handleEditModeKeys(event) {
    var currentTime = Date.now();
    
    // Si han pasado menos de KEY_DEBOUNCE_DELAY ms desde el último evento, ignorar
    if (currentTime - lastKeyPressTime < KEY_DEBOUNCE_DELAY) {
        return;
    }
    
    lastKeyPressTime = currentTime;
    
    var cartTable = document.getElementById("cart");
    if (!cartTable) return;
    
    var rows = cartTable.getElementsByTagName('tr');
    var currentRow = document.querySelector('.highlighted-row');
    var currentIndex = Array.from(rows).indexOf(currentRow);

    switch (event.key) {
        case "ArrowUp":
            if (currentIndex > 1) {
                highlightRow(currentIndex - 1);
                event.preventDefault();
            }
            break;
        case "ArrowDown":
            if (currentIndex < rows.length - 1) {
                highlightRow(currentIndex + 1);
                event.preventDefault();
            }
            break;
        case "+":
            if (currentRow && !isUpdatingQuantity) {
                updateQuantity(currentRow, 1);
                event.preventDefault();
            }
            break;
        case "-":
            if (currentRow && !isUpdatingQuantity) {
                updateQuantity(currentRow, -1);
                event.preventDefault();
            }
            break;
    }
}

// Función para manejar teclas en modo búsqueda
function handleSearchModeKeys(event) {
    var currentTime = Date.now();
    
    // Si han pasado menos de KEY_DEBOUNCE_DELAY ms desde el último evento, ignorar
    if (currentTime - lastKeyPressTime < KEY_DEBOUNCE_DELAY) {
        return;
    }
    
    lastKeyPressTime = currentTime;
    
    var resultsContainer = document.getElementById('resultsContainer');
    if (!resultsContainer || resultsContainer.classList.contains('hidden')) return;
    
    var rows = searchResultsBody.querySelectorAll('tr');
    var highlightedRow = searchResultsBody.querySelector('.highlighted-search');
    var highlightedIndex = highlightedRow ? Array.from(rows).indexOf(highlightedRow) : -1;

    switch (event.key) {
        case "ArrowUp":
            event.preventDefault();
            if (rows.length > 0) {
                if (highlightedIndex <= 0) {
                    // Si estamos en el primer elemento o no hay ninguno resaltado, ir al último
                    highlightSearchResult(rows.length - 1);
                } else {
                    // Ir al elemento anterior
                    highlightSearchResult(highlightedIndex - 1);
                }
            }
            break;
        case "ArrowDown":
            event.preventDefault();
            if (rows.length > 0) {
                if (highlightedIndex === -1 || highlightedIndex >= rows.length - 1) {
                    // Si no hay ninguno resaltado o estamos en el último, ir al primero
                    highlightSearchResult(0);
                } else {
                    // Ir al siguiente elemento
                    highlightSearchResult(highlightedIndex + 1);
                }
            }
            break;
        case "Enter":
            if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
                addToCart(searchResults[highlightedIndex].codigo);
                event.preventDefault();
            }
            break;
    }
}

// Función para resaltar fila en modo edición
function highlightRow(index) {
    var cartTable = document.getElementById("cart");
    if (!cartTable) return;
    
    var rows = cartTable.getElementsByTagName('tr');
    
    for (var i = 1; i < rows.length; i++) {
        rows[i].classList.remove("highlighted-row");
    }
    
    if (index >= 1 && index < rows.length) {
        rows[index].classList.add("highlighted-row");
        // Hacer scroll suave hacia la fila resaltada
        rows[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Función para resaltar resultado de búsqueda
function highlightSearchResult(index) {
    var rows = searchResultsBody.querySelectorAll('tr');
    
    rows.forEach(row => row.classList.remove("highlighted-search"));
    
    if (index >= 0 && index < rows.length) {
        rows[index].classList.add("highlighted-search");
        
        // Auto-scroll suave al elemento resaltado
        const resultsContainer = document.querySelector('.results-container');
        if (resultsContainer && rows[index]) {
            // Calcular la posición del elemento dentro del contenedor
            const containerRect = resultsContainer.getBoundingClientRect();
            const rowRect = rows[index].getBoundingClientRect();
            
            // Verificar si el elemento está visible en el contenedor
            const isVisible = rowRect.top >= containerRect.top && 
                            rowRect.bottom <= containerRect.bottom;
            
            if (!isVisible) {
                // Calcular el offset para centrar el elemento
                const containerHeight = containerRect.height;
                const rowHeight = rowRect.height;
                const scrollTop = resultsContainer.scrollTop;
                const rowTop = rows[index].offsetTop;
                
                // Centrar el elemento en el contenedor
                const targetScrollTop = rowTop - (containerHeight / 2) + (rowHeight / 2);
                
                resultsContainer.scrollTo({
                    top: targetScrollTop,
                    behavior: 'smooth'
                });
            }
        }
    }
}

// Función para actualizar cantidad con + y -
function updateQuantity(row, change) {
    if (!row || isUpdatingQuantity) return;
    
    isUpdatingQuantity = true; // Marcar que estamos actualizando
    
    var cells = row.getElementsByTagName('td');
    if (cells.length < 6) {
        isUpdatingQuantity = false;
        return;
    }
    
    var quantityCell = cells[3]; // Celda de cantidad
    var currentQuantity = parseFloat(quantityCell.innerText) || 0;
    var newQuantity = currentQuantity + change;
    
    // Validar que no sea negativa
    if (newQuantity < 0) {
        alert("La cantidad no puede ser negativa.");
        isUpdatingQuantity = false;
        return;
    }
    
    // Actualizar cantidad en la celda
    quantityCell.innerText = newQuantity;
    
    // Actualizar el array del carrito
    var productCode = cells[0].innerText; // Código del producto
    var cartItem = cart.find(item => item.codigo === productCode);
    if (cartItem) {
        cartItem.cantidad = newQuantity;
    }
    
    // Actualizar total de la fila
    var price = parseFloat(cells[2].innerText.replace('$', '').replace(',', '')) || 0;
    var total = price * newQuantity;
    cells[4].innerText = formatCurrency(total);
    
    // Actualizar total general
    updateCartDisplay();
    saveCartToLocalStorage();
    
    // Efecto visual de flash
    flashCell(quantityCell);
    
    // Resetear la variable después de un pequeño retraso
    setTimeout(() => {
        isUpdatingQuantity = false;
    }, 100);
}

// Función para efecto visual de flash
function flashCell(cell) {
    if (!cell) return;
    
    cell.classList.add("flash-green");
    setTimeout(() => {
        cell.classList.remove("flash-green");
    }, 300);
}

// Función para actualizar totales de celda en modo edición
function updateCellTotal(cell) {
    var row = cell.parentElement;
    if (!row || row.cells.length < 6) return;
    
    var newPrice = parsePrice(row.cells[2].innerText);
    var newQuantity = parseFloat(row.cells[3].innerText);
    
    // Validar precio
    if (isNaN(newPrice) || newPrice < 0) {
        alert('El precio no puede ser negativo o inválido.');
        cell.innerText = cell.getAttribute('data-old-value');
        return;
    }
    
    // Validar cantidad
    if (isNaN(newQuantity) || newQuantity < 0) {
        alert('La cantidad no puede ser negativa o inválida.');
        cell.innerText = cell.getAttribute('data-old-value');
        return;
    }
    
    // Actualizar el total de la fila
    var newTotal = newPrice * newQuantity;
    row.cells[4].innerText = formatCurrency(newTotal);
    
    // Actualizar el precio/cantidad en el array del carrito
    var productCode = row.cells[0].innerText; // Código del producto
    var cartItem = cart.find(item => item.codigo === productCode);
    if (cartItem) {
        if (cell.cellIndex === 2) { // Editando precio
            cartItem.precio = newPrice;
            // Actualizar la celda con el precio formateado
            row.cells[2].innerText = formatCurrency(newPrice);
        } else if (cell.cellIndex === 3) { // Editando cantidad
            cartItem.cantidad = newQuantity;
        }
    }
    
    // Guardar el nuevo valor como el valor antiguo
    if (cell.cellIndex === 2) { // Para precios, guardar el valor formateado
        cell.setAttribute('data-old-value', formatCurrency(newPrice));
    } else { // Para cantidades, guardar el valor numérico
        cell.setAttribute('data-old-value', cell.innerText);
    }
    
    // Actualizar total general
    updateCartDisplay();
    saveCartToLocalStorage(); // Guardar cambios en localStorage
}

// Función para actualizar display del carrito (global)
function updateCartDisplay() {
    const cartBody = document.getElementById('cartBody');
    const totalGeneral = document.getElementById('totalGeneral');
    
    if (!cartBody || !totalGeneral) return; // Safety check
    
    // Guardar la fila actualmente resaltada antes de recrear la tabla
    const currentlyHighlightedRow = document.querySelector('.highlighted-row');
    const highlightedProductCode = currentlyHighlightedRow ? 
        currentlyHighlightedRow.cells[0].innerText : null;
    
    cartBody.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.precio * item.cantidad;
        total += itemTotal;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.codigo}</td>
            <td>${item.producto}</td>
            <td>${formatCurrency(item.precio)}</td>
            <td>${item.cantidad}</td>
            <td>${formatCurrency(itemTotal)}</td>
            <td><button onclick="removeFromCart(${index})">Eliminar</button></td>
        `;
        cartBody.appendChild(row);
        
        // Si estamos en modo edición, hacer las celdas editables
        if (isEditing) {
            const cells = row.getElementsByTagName('td');
            if (cells.length >= 6) {
                cells[2].contentEditable = "true"; // Precio
                cells[3].contentEditable = "true"; // Cantidad
                cells[2].classList.add("editable");
                cells[3].classList.add("editable");
                cells[2].addEventListener("blur", handleCellBlur);
                cells[3].addEventListener("blur", handleCellBlur);
                cells[2].addEventListener("keydown", handleCellKeyDown);
                cells[3].addEventListener("keydown", handleCellKeyDown);
                cells[2].setAttribute('data-old-value', formatCurrency(item.precio));
                cells[3].setAttribute('data-old-value', item.cantidad.toString());
            }
        }
    });

    totalGeneral.textContent = formatCurrency(total);
    
    // Restaurar la selección de fila después de actualizar
    if (isEditing && highlightedProductCode) {
        const rows = cartBody.querySelectorAll('tr');
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].cells[0].innerText === highlightedProductCode) {
                rows[i].classList.add('highlighted-row');
                break;
            }
        }
    }
}

// Verificar autenticación al cargar
requireAuth().then(() => {
    // Continuar con la inicialización del POS
    initPOS();
});

// Función para inicializar el POS
function initPOS() {
    // Elementos del DOM
    const productSearch = document.getElementById('productSearch');
    const resultsContainer = document.getElementById('resultsContainer');
    const searchResultsBody = document.getElementById('searchResultsBody');
    const cartBody = document.getElementById('cartBody');
    const totalGeneral = document.getElementById('totalGeneral');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const printReceiptBtn = document.getElementById('printReceiptBtn');

    // Mostrar carrito guardado al cargar
    updateCartDisplay();

// Función para buscar productos
async function searchProducts(query) {
    // Si la query está vacía o es muy corta, ocultar resultados
    if (!query || query.trim().length < 1) {
        document.getElementById('resultsContainer').classList.add('hidden');
        searchResults = [];
        highlightedIndex = -1;
        isSearching = false;
        return;
    }

    // Evitar búsquedas duplicadas
    const trimmedQuery = query.trim();
    if (trimmedQuery === '') {
        document.getElementById('resultsContainer').classList.add('hidden');
        searchResults = [];
        highlightedIndex = -1;
        isSearching = false;
        return;
    }

    isSearching = true; // Marcar que hay una búsqueda en curso

    try {
        const { data, error } = await supabase
            .from('ferresoluciones_inventario')
            .select('codigo, producto, precio, stock')
            .or(`codigo.ilike.%${trimmedQuery}%,producto.ilike.%${trimmedQuery}%`)
            .limit(10);

        if (error) {
            console.error('Error searching products:', error);
            searchResults = [];
            document.getElementById('resultsContainer').classList.add('hidden');
            isSearching = false;
            return;
        }

        searchResults = data || [];
        displaySearchResults();
        isSearching = false; // Marcar que la búsqueda terminó
        
    } catch (error) {
        console.error('Error:', error);
        searchResults = [];
        document.getElementById('resultsContainer').classList.add('hidden');
        isSearching = false;
    }
}    // Función para mostrar resultados de búsqueda
    function displaySearchResults() {
        searchResultsBody.innerHTML = '';
        highlightedIndex = -1; // Resetear el índice resaltado

        if (searchResults.length === 0) {
            resultsContainer.classList.add('hidden');
            return;
        }

        searchResults.forEach((product, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.codigo}</td>
                <td>${product.producto}</td>
                <td>${formatCurrency(product.precio)}</td>
                <td><button onclick="addToCart('${product.codigo}')">Agregar</button></td>
            `;
            searchResultsBody.appendChild(row);
        });

        resultsContainer.classList.remove('hidden');
        
        // Resaltar automáticamente el primer resultado
        if (searchResults.length > 0) {
            highlightedIndex = 0;
            highlightSearchResult(0);
            
            // Asegurar que el contenedor de resultados sea visible
            setTimeout(() => {
                const resultsContainer = document.querySelector('.results-container');
                if (resultsContainer) {
                    resultsContainer.scrollTop = 0; // Reset scroll to top
                }
            }, 100);
        }
    }

    // Función para resaltar fila (OBSOLETA - usar highlightSearchResult)
    /*
    function highlightRow(index) {
        const rows = searchResultsBody.querySelectorAll('tr');
        rows.forEach((row, i) => {
            if (i === index) {
                row.classList.add('highlighted');
            } else {
                row.classList.remove('highlighted');
            }
        });
    }
    */

    // Event listeners
    productSearch.addEventListener('input', (e) => {
        searchProducts(e.target.value);
    });

    productSearch.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (searchResults.length > 0) {
                    highlightedIndex = Math.min(highlightedIndex + 1, searchResults.length - 1);
                    highlightSearchResult(highlightedIndex);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (searchResults.length > 0) {
                    highlightedIndex = Math.max(highlightedIndex - 1, 0);
                    highlightSearchResult(highlightedIndex);
                }
                break;
            case 'Enter':
                e.preventDefault();
                
                const query = productSearch.value.trim();
                
                // Si es código exacto (solo números, 4+ dígitos) → Procesar inmediatamente
                if (/^\d{4,}$/.test(query)) {
                    processEnterKey(); // Sin retraso para códigos exactos
                } 
                // Si es búsqueda por nombre → Esperar 500ms para mostrar resultados
                else {
                    setTimeout(() => {
                        processEnterKey();
                    }, 500);
                }
                break;
        }
    });

    // Función para procesar la tecla Enter
    async function processEnterKey() {
        const query = productSearch.value.trim();
        
        // Si es código exacto (solo números, 4+ dígitos) → Buscar directamente y agregar
        if (/^\d{4,}$/.test(query)) {
            await addProductByCode(query);
        } 
        // Si es búsqueda por nombre → Seleccionar de resultados mostrados
        else if (searchResults.length > 0) {
            const selectedIndex = highlightedIndex >= 0 ? highlightedIndex : 0;
            addToCart(searchResults[selectedIndex].codigo);
        }
    }

    // Función para agregar producto directamente por código
    async function addProductByCode(codigo) {
        try {
            const { data, error } = await supabase
                .from('ferresoluciones_inventario')
                .select('codigo, producto, precio, stock')
                .eq('codigo', codigo)
                .single();

            if (error || !data) {
                alert('Producto no encontrado con código: ' + codigo);
                clearSearchState();
                return;
            }

            // Agregar directamente al carrito
            const existingItem = cart.find(item => item.codigo === data.codigo);
            if (existingItem) {
                existingItem.cantidad += 1;
            } else {
                cart.push({
                    codigo: data.codigo,
                    producto: data.producto,
                    precio: parsePrice(data.precio),
                    cantidad: 1
                });
            }

            updateCartDisplay();
            saveCartToLocalStorage();
            
            // Limpiar búsqueda completamente
            clearSearchState();
            
        } catch (error) {
            console.error('Error buscando producto por código:', error);
            alert('Error al buscar el producto');
            clearSearchState();
        }
    }

    // Event listener para teclas globales (F2 para modo edición)
    document.addEventListener('keydown', (e) => {
        if (e.code === "F2") {
            e.preventDefault();
            toggleEditable();
        }
    });

    clearCartBtn.addEventListener('click', clearCart);
    printReceiptBtn.addEventListener('click', printReceipt);

    // Focus inicial
    productSearch.focus();
}