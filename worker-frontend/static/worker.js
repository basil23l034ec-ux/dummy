document.addEventListener('DOMContentLoaded', () => {
    // Initial Setup
    setMode('stock');
    switchStockTab('inventory');
    fetchProducts();

    // Add Product Handle
    const addForm = document.getElementById('addProductForm');
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Adding...';
            btn.disabled = true;

            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            try {
                const res = await fetch('/api/worker/add-product', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await res.json();
                if (result.success) {
                    // Show toast? For now alert is fine, or we can make a custom toast
                    alert('Product added successfully!');
                    e.target.reset();
                    fetchProducts();
                    switchStockTab('inventory');
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (error) {
                console.error('Error adding product:', error);
                alert('Failed to add product.');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    // Modal Close Logic
    const editModal = document.getElementById('editModal');
    const toolModal = document.getElementById('toolModal');
    window.addEventListener('click', (event) => {
        if (editModal && event.target === editModal) {
            editModal.style.display = 'none';
        }
        if (toolModal && event.target === toolModal) {
            closeToolModal();
        }
    });

    // Filter Listeners
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const stockFilter = document.getElementById('stockFilter');
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
    if (stockFilter) stockFilter.addEventListener('change', applyFilters);

    initChat();
});

// Chat Logic
function initChat() {
    const fab = document.getElementById('chatFab');
    const chatWindow = document.getElementById('chatWindow');
    const close = document.getElementById('closeChat');
    const input = document.getElementById('chatInput');
    const send = document.getElementById('sendMessage');
    const messages = document.getElementById('chatMessages');

    if (!fab || !chatWindow || !close || !input || !send || !messages) {
        return;
    }

    // Toggle
    fab.onclick = () => {
        chatWindow.style.display = 'flex';
        fab.style.display = 'none';
        input.focus();
    };

    close.onclick = () => {
        chatWindow.style.display = 'none';
        fab.style.display = 'flex';
    };

    // Send Message
    function handleSend() {
        const text = input.value.trim();
        if (!text) return;

        // User Message
        addMessage(text, 'user');
        input.value = '';

        // Simulate Bot Response
        setTimeout(() => {
            const reply = getBotReply(text);
            addMessage(reply, 'bot');
        }, 600);
    }

    send.onclick = handleSend;
    input.onkeypress = (e) => {
        if (e.key === 'Enter') handleSend();
    };

    function addMessage(text, sender) {
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        div.textContent = text;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }

    function getBotReply(text) {
        text = text.toLowerCase();
        if (text.includes('hello') || text.includes('hi')) return 'Hello! How can I help you today?';
        if (text.includes('stock')) {
            const lowStock = allProducts.filter(p => p.stock < 5).length;
            return `We have ${allProducts.length} products total. There are ${lowStock} items with low stock.`;
        }
        if (text.includes('price')) return 'You can check prices in the "Price" column of the inventory table.';
        if (text.includes('add')) return 'To add a product, click the "Add Product" tab at the top.';
        if (text.includes('thank')) return 'You\'re welcome! Happy working! 🚀';
        return 'I can verify stock levels, item prices, or help you add products. Try asking "How is the stock?"';
    }
}

let allProducts = [];

async function fetchProducts() {
    try {
        const res = await fetch('/api/worker/products');
        const data = await res.json();

        // Handle both array and dict formats (just in case)
        allProducts = Array.isArray(data) ? data : Object.values(data);

        updateStats();
        populateCategories();
        applyFilters();

    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

function updateStats() {
    // Check if elements exist (in case we haven't added HTML yet, but we will)
    const totalEl = document.getElementById('statTotal');
    const lowStockEl = document.getElementById('statLow');
    const valueEl = document.getElementById('statValue');

    if (!totalEl) return;

    const totalCount = allProducts.length;
    const lowStockCount = allProducts.filter(p => p.stock > 0 && p.stock < 5).length;
    const totalValue = allProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);

    totalEl.textContent = totalCount;
    lowStockEl.textContent = lowStockCount;
    valueEl.textContent = '₹' + totalValue.toLocaleString('en-IN');
}

function populateCategories() {
    const categorySelect = document.getElementById('categoryFilter');
    if (!categorySelect) return;

    const currentVal = categorySelect.value;
    const categories = new Set(allProducts.map(p => p.category || 'General').filter(c => c));

    // Keep "All"
    categorySelect.innerHTML = '<option value="all">All</option>';

    Array.from(categories).sort().forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });

    // Restore selection if possible
    categorySelect.value = currentVal;
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const stockStatus = document.getElementById('stockFilter').value;

    const filtered = allProducts.filter(p => {
        // Search
        const nameMatch = (p.name || '').toLowerCase().includes(searchTerm);
        const idMatch = (p.id || '').toLowerCase().includes(searchTerm);
        const matchSearch = nameMatch || idMatch;

        // Category
        const matchCategory = category === 'all' || (p.category || 'General') === category;

        // Stock
        let matchStock = true;
        if (stockStatus === 'instock') matchStock = p.stock > 0;
        else if (stockStatus === 'lowstock') matchStock = p.stock > 0 && p.stock < 5;
        else if (stockStatus === 'outstock') matchStock = p.stock == 0;

        return matchSearch && matchCategory && matchStock;
    });

    renderTable(filtered);
}

function renderTable(products) {
    const tbody = document.getElementById('inventoryTable');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No products found</td></tr>';
        return;
    }

    products.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/5 transition duration-150';
        tr.innerHTML = `
            <td class="font-mono text-xs opacity-70">${p.id}</td>
            <td>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg overflow-hidden bg-white/10 border border-white/20">
                        <img src="${p.image || ''}" 
                             onerror="this.src='https://via.placeholder.com/40?text=📦'" 
                             alt="" 
                             class="w-full h-full object-cover">
                    </div>
                    <div class="font-medium">${p.name}</div>
                </div>
            </td>
            <td>
                <span class="px-2 py-1 rounded text-xs font-medium bg-white/5 border border-white/10">
                    ${p.category || 'General'}
                </span>
            </td>
            <td class="font-bold">₹${p.price}</td>
            <td>
                <span class="px-2 py-1 rounded text-xs font-bold ${getStockClass(p.stock)}">
                    ${p.stock}
                </span>
            </td>
            <td class="text-sm font-medium opacity-80">
                ${p.unit ? p.unit : '-'}
            </td>
            <td class="text-sm font-bold text-green-400">
                ${p.discount > 0 ? p.discount + '%' : '-'}
                ${p.promotion_description ? `<div class="text-[10px] text-blue-300">${p.promotion_description}</div>` : ''}
            </td>
            <td class="text-xs opacity-60">${p.last_updated || 'Never'}</td>
            <td>
                <div class="flex gap-2 justify-end">
                    <button class="bg-[#282e39] hover:text-white text-[#9ca6ba] p-1.5 rounded transition-colors" onclick="openEdit('${p.id}', ${p.price}, ${p.stock}, ${p.discount || 0}, '${p.promotion_description || ''}', '${p.promotion_expiry || ''}', '${p.image || ''}')">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button class="bg-[#282e39] hover:text-red-500 text-[#9ca6ba] p-1.5 rounded transition-colors" onclick="deleteProduct('${p.id}')">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getStockClass(stock) {
    if (stock == 0) return 'text-red-500 bg-red-500/10 px-2 py-1 rounded-full text-xs font-bold w-max';
    if (stock < 5) return 'text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full text-xs font-bold w-max';
    return 'text-green-500 bg-green-500/10 px-2 py-1 rounded-full text-xs font-bold w-max';
}

// --- MODE SWITCHER ---
function setMode(mode) {
    const stockApp = document.getElementById('stock-mode-app');
    const designApp = document.getElementById('design-mode-app');
    const btnStock = document.getElementById('btn-mode-stock');
    const btnDesign = document.getElementById('btn-mode-design');
    const searchBar = document.getElementById('global-search');

    if (mode === 'stock') {
        stockApp.classList.remove('hidden');
        designApp.classList.add('hidden');

        btnStock.classList.replace('text-[#9ca6ba]', 'text-white');
        btnStock.classList.add('bg-primary', 'shadow-lg');

        btnDesign.classList.remove('bg-primary', 'shadow-lg', 'text-white');
        btnDesign.classList.add('text-[#9ca6ba]');

        if (searchBar) searchBar.classList.remove('hidden');

    } else {
        stockApp.classList.add('hidden');
        designApp.classList.remove('hidden');

        btnDesign.classList.replace('text-[#9ca6ba]', 'text-white');
        btnDesign.classList.add('bg-primary', 'shadow-lg');

        btnStock.classList.remove('bg-primary', 'shadow-lg', 'text-white');
        btnStock.classList.add('text-[#9ca6ba]');

        if (searchBar) searchBar.classList.add('hidden');
    }
}

// --- STOCK TAB SWITCHER ---
function switchStockTab(tabName) {
    const sections = {
        'inventory': document.getElementById('inventorySection'),
        'add-product': document.getElementById('addProductSection'),
        'settings': document.getElementById('settingsSection')
    };

    // Hide all
    Object.values(sections).forEach(el => {
        if (el) el.classList.add('hidden');
    });

    // Reset Nav Styles
    ['inventory', 'add-product', 'settings'].forEach(t => {
        const nav = document.getElementById(`nav-${t}`);
        if (nav) {
            nav.classList.remove('bg-primary/10', 'text-primary');
            nav.classList.add('text-[#9ca6ba]');
        }
    });

    // Show Selected
    if (sections[tabName]) sections[tabName].classList.remove('hidden');

    const activeNav = document.getElementById(`nav-${tabName}`);
    if (activeNav) {
        activeNav.classList.remove('text-[#9ca6ba]');
        activeNav.classList.add('bg-primary/10', 'text-primary');
    }

    // Load settings for settings tab
    if (tabName === 'settings') loadSettings();
}

function openEdit(id, price, stock, discount, promoDesc, promoExpiry, image) {
    document.getElementById('editId').value = id;
    document.getElementById('editPrice').value = price;
    document.getElementById('editStock').value = stock;
    document.getElementById('editDiscount').value = discount;
    document.getElementById('editPromoDesc').value = promoDesc === 'undefined' ? '' : promoDesc;
    document.getElementById('editPromoExpiry').value = promoExpiry === 'undefined' || promoExpiry === 'null' ? '' : promoExpiry;
    document.getElementById('editImage').value = image;
    document.getElementById('editModal').style.display = 'flex'; // Flex for centering
}

async function saveEdit() {
    const id = document.getElementById('editId').value;
    const price = document.getElementById('editPrice').value;
    const stock = document.getElementById('editStock').value;
    const discount = document.getElementById('editDiscount').value;
    const promoDesc = document.getElementById('editPromoDesc').value;
    const promoExpiry = document.getElementById('editPromoExpiry').value;
    const image = document.getElementById('editImage').value;

    const data = { id: id };
    if (price) data.price = price;
    if (stock) data.stock = stock;
    if (discount !== '') data.discount = discount;
    if (promoDesc) data.promotion_description = promoDesc;
    if (promoExpiry) data.promotion_expiry = promoExpiry;
    if (image) data.image = image;

    try {
        const res = await fetch('/api/worker/update-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        if (result.success) {
            document.getElementById('editModal').style.display = 'none';
            fetchProducts();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error saving product:', error);
        alert('Failed to save changes.');
    }
}

async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();

        const fields = {
            'theme_bg_color': ['themeBgColor', 'themeBgColorText'],
            'theme_text_color': ['themeTextColor', 'themeTextColorText'],
            'theme_nav_color': ['themeNavColor', 'themeNavColorText'],
            'theme_button_color': ['themeButtonColor', 'themeButtonColorText'],
            'promo_banner_text': ['promoBannerText'],
            'promo_banner_image': ['promoBannerImage']
        };

        for (const [key, ids] of Object.entries(fields)) {
            if (settings[key]) {
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = settings[key];
                });
            }
        }

        // Sync color inputs
        ['themeBgColor', 'themeTextColor', 'themeNavColor', 'themeButtonColor'].forEach(id => {
            const picker = document.getElementById(id);
            const text = document.getElementById(id + 'Text');

            picker.onchange = () => text.value = picker.value;
            text.onchange = () => picker.value = text.value;
        });

    } catch (error) {
        console.error("Failed to load settings", error);
    }
}

async function saveSettings() {
    const data = {
        theme_bg_color: document.getElementById('themeBgColor').value,
        theme_text_color: document.getElementById('themeTextColor').value,
        theme_nav_color: document.getElementById('themeNavColor').value,
        theme_button_color: document.getElementById('themeButtonColor').value,
        promo_banner_text: document.getElementById('promoBannerText').value,
        promo_banner_image: document.getElementById('promoBannerImage').value
    };

    try {
        const response = await fetch('/api/worker/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            alert('Settings saved! Customer UI will update shortly.');
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error("Failed to save settings", error);
        alert("Failed to save settings.");
    }
}

async function deleteProduct(id) {
    if (!confirm(`Are you sure you want to delete product ${id}?`)) {
        return;
    }

    try {
        const res = await fetch('/api/worker/delete-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });

        const result = await res.json();
        if (result.success) {
            fetchProducts();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        alert('Failed to delete product.');
    }
}

function switchTab(tabName) {
    const inventorySection = document.getElementById('inventorySection');
    const addProductSection = document.getElementById('addProductSection');
    const navInventory = document.getElementById('nav-inventory');
    const navAddProduct = document.getElementById('nav-add-product');
    const navSettings = document.getElementById('nav-settings');

    const sections = {
        'inventory': document.getElementById('inventorySection'),
        'add-product': document.getElementById('addProductSection'),
        'settings': document.getElementById('settingsSection')
    };

    // Hide all
    Object.values(sections).forEach(el => el.classList.add('hidden'));

    // Reset Nav
    [navInventory, navAddProduct, navSettings].forEach(nav => {
        nav.classList.remove('bg-white/20', 'text-white', 'shadow-lg');
        nav.classList.add('bg-white/10', 'text-white/80');
    });

    // Show Selected
    sections[tabName].classList.remove('hidden'); // Changed 'tab' to 'tabName'
    const activeNav = document.getElementById(`nav-${tabName}`); // Changed 'tab' to 'tabName'
    activeNav.classList.remove('bg-white/10', 'text-white/80');
    activeNav.classList.add('bg-white/20', 'text-white', 'shadow-lg');

    // Load settings if tab is settings
    if (tabName === 'settings') {
        loadSettings();
    }
}

// --- DESIGN MODE LOGIC ---
// --- DESIGN MODE LOGIC ---
function updateCanvas() {
    const text = document.getElementById('model-text').value;
    const subtext = document.getElementById('model-subtext').value;
    const image = document.getElementById('model-image').value;

    const headingEl = document.getElementById('design-canvas-heading');
    const subtextEl = document.getElementById('design-canvas-subtext');
    const bgEl = document.getElementById('design-canvas-bg');

    if (headingEl) headingEl.innerHTML = text;
    if (subtextEl) subtextEl.innerText = subtext;
    if (bgEl) bgEl.style.backgroundImage = image ? `url('${image}')` : 'none';
}

async function deployPromotion() {
    if (confirm("Confirm deployment of this promotion to the Main Display?")) {
        const btn = event.currentTarget || event.target;
        const button = btn.closest('button');
        if (!button) return;

        const originalContent = button.innerHTML;
        button.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">sync</span> Deploying...';
        button.disabled = true;

        // Gather Data
        const text = document.getElementById('model-text').value;
        const subtext = document.getElementById('model-subtext').value;
        const image = document.getElementById('model-image').value;

        // Prepare Payload
        // Note: For now, we combine text or just use main text as the backend schema is simple.
        // Ideally we update backend to store subtext too.
        const payload = {
            promo_banner_text: text + (subtext ? " | " + subtext : ""), // Simple concatenation for now
            promo_banner_image: image
        };

        try {
            const res = await fetch('/api/worker/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            if (result.success) {
                alert("Promotion Deployed Successfully! 🚀\nThe Customer UI has been updated.");
            } else {
                alert("Error deploying: " + result.message);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to deploy promotion.");
        } finally {
            button.innerHTML = originalContent;
            button.disabled = false;
        }
    }
}

// --- SIDEBAR TOOLS LOGIC ---
const TEMPLATES = [
    { title: "Fresh Deals", text: "FRESH<br/><span class='text-primary'>DEALS</span>", subtext: "Get up to 40% OFF on all seasonal organic vegetables today.", image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBSOGf4Vm8zvhPyzdwVhUPo05LPP36PFUEB3SZVDuTYJE5iK58KKvTrsWEM0MjoKWBKz4xjBbVkohZg_Z5x-9etNg-_U1TWAWv0pDR-gI99fHq2Y8I-2uyNcl2qORZuu6BjYLvGlZXobnFz8WnjleQbLdJLeKyysAWs8d_7mCV22Vk-0cYk257EG48bsAHfJT1j0gI5yh7ILTTpchLOB2EbO17HueFWiMbRIyiJLCFPJtkmUxbxb5lvfti7OpUVzQrua2rPrlR5QGQ" },
    { title: "Summer Sale", text: "SUMMER<br/><span class='text-yellow-400'>SALE</span>", subtext: "Cool down with our refreshing beverages. Buy 2 Get 1 Free!", image: "https://images.unsplash.com/photo-1560963689-02e0d7730e6e?w=800&auto=format&fit=crop&q=60" },
    { title: "Mega Offer", text: "MEGA<br/><span class='text-red-500'>OFFER</span>", subtext: "Huge discounts on all electronics and gadgets. Limited time only.", image: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=60" },
    { title: "New Arrivals", text: "NEW<br/><span class='text-green-400'>ARRIVALS</span>", subtext: "Check out the latest fashion trends in our store now.", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&auto=format&fit=crop&q=60" }
];

const GRAPHICS = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBSOGf4Vm8zvhPyzdwVhUPo05LPP36PFUEB3SZVDuTYJE5iK58KKvTrsWEM0MjoKWBKz4xjBbVkohZg_Z5x-9etNg-_U1TWAWv0pDR-gI99fHq2Y8I-2uyNcl2qORZuu6BjYLvGlZXobnFz8WnjleQbLdJLeKyysAWs8d_7mCV22Vk-0cYk257EG48bsAHfJT1j0gI5yh7ILTTpchLOB2EbO17HueFWiMbRIyiJLCFPJtkmUxbxb5lvfti7OpUVzQrua2rPrlR5QGQ",
    "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=800&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1557683316-973673baf926?w=800&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1557682250-33bd973ae291?w=800&auto=format&fit=crop&q=60"
];

function closeToolModal() {
    const modal = document.getElementById('toolModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.classList.add('hidden');
}

function openLocalBackgroundPicker() {
    const input = document.getElementById('localBackgroundImageInput');
    if (!input) return;
    input.value = '';
    input.click();
}

function handleLocalBackgroundImage(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert("Please select a valid image file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = reader.result;
        if (!dataUrl) return;

        document.getElementById('model-image').value = dataUrl;
        updateCanvas();
        closeToolModal();
    };
    reader.onerror = () => {
        alert("Failed to load selected image.");
    };
    reader.readAsDataURL(file);
}

function showToolModal() {
    const modal = document.getElementById('toolModal');
    if (!modal) return false;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    return true;
}

function canLoadImage(url, timeoutMs = 10000) {
    return new Promise((resolve) => {
        if (!url || !url.trim()) {
            resolve(false);
            return;
        }

        const img = new Image();
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                resolve(false);
            }
        }, timeoutMs);

        img.onload = () => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve(true);
            }
        };
        img.onerror = () => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve(false);
            }
        };
        img.src = url;
    });
}

async function getFirstWorkingImage(primaryUrl) {
    const candidates = [primaryUrl, ...GRAPHICS]
        .filter(Boolean)
        .map((url) => url.trim());
    const uniqueCandidates = [...new Set(candidates)];

    for (const url of uniqueCandidates) {
        if (await canLoadImage(url)) {
            return url;
        }
    }
    return '';
}

function openTemplates() {
    const modal = document.getElementById('toolModal');
    const title = document.getElementById('toolModalTitle');
    const content = document.getElementById('toolModalContent');

    if (!modal || !title || !content) return;

    title.textContent = "Select Template";
    content.innerHTML = TEMPLATES.map((t, index) => `
        <div onclick="applyTemplate(${index})" class="cursor-pointer group relative rounded-lg overflow-hidden border border-[#282e39] hover:border-primary transition-all">
            <img src="${t.image}" class="w-full h-32 object-cover opacity-60 group-hover:opacity-100 transition-opacity">
            <div class="absolute inset-0 bg-black/60 flex items-center justify-center p-2 text-center">
                <span class="font-bold text-white text-sm">${t.title}</span>
            </div>
        </div>
    `).join('');

    showToolModal();
}

function openGraphics() {
    const modal = document.getElementById('toolModal');
    const title = document.getElementById('toolModalTitle');
    const content = document.getElementById('toolModalContent');

    if (!modal || !title || !content) return;

    title.textContent = "Select Background";
    const uploadTile = `
        <div onclick="openLocalBackgroundPicker()"
            class="cursor-pointer rounded-lg border border-dashed border-primary/60 hover:border-primary transition-all h-32 bg-primary/10 flex flex-col items-center justify-center gap-2 text-primary hover:text-white hover:bg-primary/20">
            <span class="material-symbols-outlined">upload_file</span>
            <span class="text-sm font-semibold">Upload Local Image</span>
        </div>
    `;

    content.innerHTML = uploadTile + GRAPHICS.map(url => `
        <div onclick='applyGraphic(${JSON.stringify(url)})' class="cursor-pointer rounded-lg overflow-hidden border border-[#282e39] hover:border-primary transition-all h-32">
            <img src="${url}" class="w-full h-full object-cover">
        </div>
    `).join('');

    showToolModal();
}

function applyTemplate(index) {
    const t = TEMPLATES[index];
    document.getElementById('model-text').value = t.text;
    document.getElementById('model-subtext').value = t.subtext;
    document.getElementById('model-image').value = t.image;
    updateCanvas();
    closeToolModal();
}

function applyGraphic(url) {
    document.getElementById('model-image').value = url;
    updateCanvas();
    closeToolModal();
}

// --- AI ASSISTANT LOGIC ---
function openAIAssistant() {
    document.getElementById('aiModal').style.display = 'flex';
    document.getElementById('ai-prompt').focus();
}

function setPrompt(text) {
    document.getElementById('ai-prompt').value = text;
}

async function generateDesign() {
    const promptDef = document.getElementById('ai-prompt').value.trim();
    const btn = document.getElementById('ai-gen-btn');
    const errorBox = document.getElementById('ai-error');

    if (!promptDef) {
        errorBox.textContent = "Please enter a description.";
        errorBox.classList.remove('hidden');
        return;
    }

    errorBox.classList.add('hidden');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Generating...';
    btn.disabled = true;
    btn.classList.add('opacity-70');

    try {
        const res = await fetch('/api/ai/design', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptDef })
        });

        let result;
        try {
            result = await res.json();
        } catch {
            throw new Error("Received an invalid response from the design service.");
        }

        if (!res.ok) {
            if (res.status === 401) {
                throw new Error("Your worker session expired. Please login again.");
            }
            throw new Error(result.message || `Request failed with status ${res.status}.`);
        }

        if (!result.success) {
            throw new Error(result.message || "Failed to generate design.");
        }

        const d = result.design || {};
        document.getElementById('model-text').value = d.title || '';
        document.getElementById('model-subtext').value = d.subtitle || '';

        const chosenImage = await getFirstWorkingImage(d.image || '');
        if (!chosenImage) {
            throw new Error("Design generated, but no background image could be loaded.");
        }
        document.getElementById('model-image').value = chosenImage;

        updateCanvas();
        document.getElementById('aiModal').style.display = 'none';

        if (chosenImage !== (d.image || '').trim()) {
            alert("Design generated. The original background failed to load, so a fallback image was applied.");
        } else if (result.note) {
            alert(result.note);
        } else {
            alert("Design generated successfully.");
        }
    } catch (e) {
        console.error(e);
        errorBox.textContent = e.message || "Failed to generate design. Please try again.";
        errorBox.classList.remove('hidden');
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
        btn.classList.remove('opacity-70');
    }
}

// --- OVERRIDE / NEW PROMOTION LOGIC ---

async function deployPromotion() {
    if (!confirm("Add this promotion to the Rotation Pool?")) return;

    // Fix event targeting
    const btn = document.querySelector('button[onclick="deployPromotion()"]');
    if (!btn) return;

    const originalContent = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">sync</span> Deploying...';
    btn.disabled = true;

    const text = document.getElementById('model-text').value;
    const subtext = document.getElementById('model-subtext').value;
    const image = document.getElementById('model-image').value;

    const data = {
        type: 'banner',
        title: text.replace(/<[^>]*>?/gm, '').substring(0, 30) || 'Promo',
        content: {
            text: text,
            image: image,
            subtext: subtext
        }
    };

    try {
        const res = await fetch('/api/worker/promotions/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
            alert("Promotion Added to Rotation! 🚀");
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) {
        console.error(e);
        alert("Failed to deploy.");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

// --- PROMOTION MANAGER LOGIC ---
let rotationTimerInterval = null;

function updateRotationTimer() {
    const timerEl = document.getElementById('rotation-timer');
    if (!timerEl) return;

    // Calculate time until next 30-minute interval
    const now = Math.floor(Date.now() / 1000);
    const intervalTime = 1800; // 30 minutes in seconds
    const secondsElapsed = now % intervalTime;
    const secondsRemaining = intervalTime - secondsElapsed;

    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;

    timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startRotationTimer() {
    updateRotationTimer();
    if (rotationTimerInterval) clearInterval(rotationTimerInterval);
    rotationTimerInterval = setInterval(updateRotationTimer, 1000);
}

function stopRotationTimer() {
    if (rotationTimerInterval) {
        clearInterval(rotationTimerInterval);
        rotationTimerInterval = null;
    }
}

function openPromotionsManager() {
    const modal = document.getElementById('promotionsManagerModal');
    if (modal) {
        modal.style.display = 'flex';
        fetchPromotionsList();
        startRotationTimer();
    }
}

// Make sure to stop timer when modal closes
document.addEventListener('click', (e) => {
    if (e.target.id === 'promotionsManagerModal') {
        stopRotationTimer();
    }
});

async function fetchPromotionsList() {
    const listEl = document.getElementById('promotionsList');
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-center py-12 text-[#9ca6ba]">Loading...</div>';

    try {
        const res = await fetch('/api/worker/promotions/list');
        const promos = await res.json();

        if (promos.length === 0) {
            listEl.innerHTML = '<div class="text-center py-8 text-[#9ca6ba]">No active promotions.</div>';
            return;
        }

        listEl.innerHTML = promos.map(p => {
            const isSpinWheel = p.type === 'spin_wheel';
            const prizes = isSpinWheel && p.content && p.content.prizes ? p.content.prizes : [];
            const prizesText = prizes.length > 0 ? prizes.slice(0, 3).join(', ') + (prizes.length > 3 ? '...' : '') : 'Default prizes';

            return `
            <div class="flex items-start justify-between bg-[#161c2b] p-4 rounded-lg border ${isSpinWheel ? 'border-orange-500/30 bg-gradient-to-r from-orange-500/5 to-transparent' : 'border-[#282e39]'} mb-3 hover:border-opacity-60 transition-all">
                <div class="flex items-start gap-3 flex-1">
                    <div class="p-2 ${isSpinWheel ? 'bg-orange-500/20' : 'bg-blue-500/20'} rounded-lg">
                        <span class="material-symbols-outlined ${isSpinWheel ? 'text-orange-400' : 'text-blue-400'}">
                            ${isSpinWheel ? 'toys' : 'image'}
                        </span>
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <h4 class="text-white font-bold text-sm">${p.title || 'Untitled'}</h4>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isSpinWheel ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}">
                                ${p.type.replace('_', ' ')}
                            </span>
                        </div>
                        ${isSpinWheel ? `
                            <p class="text-[#9ca6ba] text-xs">Prizes: ${prizesText}</p>
                        ` : `
                            <p class="text-[#9ca6ba] text-xs">Banner Ad Campaign</p>
                        `}
                        <p class="text-[#6b7280] text-[10px] mt-1">
                            <span class="${p.active ? 'text-green-400' : 'text-gray-500'}">●</span> 
                            ${p.active ? 'Active' : 'Inactive'}
                        </p>
                    </div>
                </div>
                <button onclick="deleteWorkerPromotion(${p.id})" class="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded transition-colors">
                    <span class="material-symbols-outlined text-[20px]">delete</span>
                </button>
            </div>
        `}).join('');

    } catch (e) {
        console.error(e);
        listEl.innerHTML = '<div class="text-red-400 text-center">Failed to load.</div>';
    }
}

async function deleteWorkerPromotion(id) {
    if (!confirm("Delete this promotion?")) return;
    try {
        const res = await fetch(`/api/worker/promotions/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) fetchPromotionsList();
        else alert(result.message);
    } catch (e) { alert("Delete failed"); }
}

// --- SPIN WHEEL LOGIC ---
function openSpinWheelCreator() {
    const m = document.getElementById('spinWheelCreatorModal');
    if (m) m.style.display = 'flex';
}

async function deploySpinWheel() {
    const title = document.getElementById('wheel-title').value;
    const prizesText = document.getElementById('wheel-prizes').value;

    if (!title) return alert("Enter title");

    // Parse prizes
    const rawPrizes = prizesText.split(',').map(p => p.trim()).filter(p => p);
    let prizes = rawPrizes;

    if (prizes.length < 4) {
        if (prizes.length === 0) prizes = ["10% OFF", "5% OFF", "Free Item", "Try Again"];
        else return alert("Please enter at least 4 prizes.");
    }

    try {
        const res = await fetch('/api/worker/promotions/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'spin_wheel',
                title: title,
                content: { prizes: prizes }
            })
        });
        if ((await res.json()).success) {
            alert("Spin Wheel Launched! 🎡");
            document.getElementById('spinWheelCreatorModal').style.display = 'none';
        }
    } catch (e) { alert("Error launching"); }
}
