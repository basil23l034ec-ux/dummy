document.addEventListener('DOMContentLoaded', () => {
    init();
});

let allProducts = [];
let checkoutInProgress = false;

async function init() {
    // 1. Load Data
    await loadProducts();
    await refreshCart();

    // 2. Setup Real-time Polling
    setInterval(refreshCart, 2000); // Poll cart every 2s
    updateClock();
    setInterval(updateClock, 1000); // Update time every second

    // Initial Promo Check & Interval
    checkPromo();
    setInterval(checkPromo, 5000); // Poll promo every 5s

    // 3. Setup UI Interactions
    setupCategories();
}



let lastPromoId = null;
let spinWheelShownThisSession = false;

async function checkPromo() {
    try {
        const response = await fetch('/api/promotions/current');
        const promo = await response.json();

        console.log("[PROMO CHECK] Received:", promo);
        console.log("[PROMO CHECK] Spin wheel shown this session:", spinWheelShownThisSession);

        // Handle Spin Wheel - Show ONCE per session when customer first uses trolley
        if (promo.type === 'spin_wheel' && !spinWheelShownThisSession) {
            // Check if user has already seen spin wheel in this session
            const hasSeenSpinWheel = sessionStorage.getItem('spin_wheel_shown');
            console.log("[SPIN WHEEL] Has seen (sessionStorage):", hasSeenSpinWheel);

            if (!hasSeenSpinWheel) {
                // First time this session - show spin wheel
                console.log("[SPIN WHEEL] Showing for first time!");
                sessionStorage.setItem('spin_wheel_shown', 'true');
                spinWheelShownThisSession = true;
                showSpinWheel(promo.title, promo.content);
            } else {
                console.log("[SPIN WHEEL] Already shown, skipping.");
            }
            return; // Don't process as banner
        }

        // Handle Banner Ads - Rotate every 30 minutes
        if (promo.type === 'banner' && promo.id !== lastPromoId) {
            lastPromoId = promo.id;
            showBannerPromo(promo.title, promo.content.image);
        }
    } catch (e) {
        console.error("Promo Check Failed:", e);
    }
}

function showBannerPromo(text, imgUrl) {
    const modal = document.getElementById('promo-modal');
    const txtEl = document.getElementById('promo-text');
    const imgEl = document.getElementById('promo-image');

    txtEl.innerHTML = text;
    if (imgUrl) {
        imgEl.src = imgUrl;
        imgEl.classList.remove('hidden');
    } else {
        imgEl.classList.add('hidden');
    }

    openModal('promo-modal');

    // Reset Animation
    const bar = modal.querySelector('.animate-progress');
    if (bar) {
        bar.style.animation = 'none';
        bar.offsetHeight;
        bar.style.animation = null;
        bar.classList.add('animate-progress');
    }

    setTimeout(() => {
        closeModal('promo-modal');
    }, 10000);
}

// --- Spin Wheel Logic ---
let isSpinning = false;
let currentWheelPromo = null;

function showSpinWheel(title, content) {
    currentWheelPromo = content;
    const modal = document.getElementById('spin-wheel-modal');
    // Reset state
    const resultDiv = document.getElementById('spin-result');
    const controls = document.getElementById('spin-controls');
    const wheel = document.getElementById('the-wheel');

    resultDiv.classList.add('hidden');
    controls.classList.remove('hidden');
    wheel.style.transform = 'rotate(0deg)';
    isSpinning = false;

    openModal('spin-wheel-modal');
}

function spinWheel() {
    if (isSpinning) return;
    isSpinning = true;

    const wheel = document.getElementById('the-wheel');
    const resultDiv = document.getElementById('spin-result');
    const controls = document.getElementById('spin-controls');

    // Reset UI
    console.log("Spinning wheel...");
    controls.classList.add('hidden');
    resultDiv.classList.add('hidden');

    // Force Reflow
    wheel.offsetHeight;

    // Calculate rotation
    const extraSpins = 5 * 360; // minimum 5 spins
    const randomDegree = Math.floor(Math.random() * 360);
    const totalRotation = extraSpins + randomDegree;

    // Apply rotation
    wheel.style.transform = `rotate(${totalRotation}deg)`;

    // Wait for animation
    setTimeout(() => {
        console.log("Spin finished.");
        // Determine Prize from Promo or Default
        let prizes = ["10% OFF", "5% OFF", "Free Item", "15% OFF", "20% OFF", "Try Again"];
        if (currentWheelPromo && currentWheelPromo.prizes && Array.isArray(currentWheelPromo.prizes)) {
            prizes = currentWheelPromo.prizes;
        }

        // Pick Prize
        const prize = prizes[Math.floor(Math.random() * prizes.length)];

        // Show Result
        resultDiv.classList.remove('hidden');
        document.getElementById('spin-prize-text').textContent = prize;
        document.getElementById('spin-code').textContent = `LUCKY-${Date.now().toString().slice(-4)}`;

        // Save Discount
        localStorage.setItem('spin_discount', prize);

        if (typeof fireConfetti === 'function') fireConfetti();

        isSpinning = false;

        // Auto-refresh cart to show discount if items exist
        refreshCart();

    }, 4000);
}

function fireConfetti() {
    for (let i = 0; i < 50; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + 'vw';
        c.style.animationDuration = (Math.random() * 2 + 1) + 's';
        c.style.backgroundColor = ['#f00', '#0f0', '#00f', '#ff0', '#f0f'][Math.floor(Math.random() * 5)];
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 3000);
    }
}

async function loadProducts() {
    try {
        const products = await fetchProducts();
        allProducts = Object.values(products);
        renderProducts(allProducts);
    } catch (error) {
        console.error("Failed to load products:", error);
    }
}

function renderProducts(products) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';

    if (products.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-12">No products found.</div>';
        return;
    }

    products.forEach(p => {
        // Calculate Discount
        const discount = p.discount || 0;
        const price = p.price;
        const finalPrice = discount > 0 ? price * (1 - discount / 100) : price;

        // Check "Hot" status (Mock logic: Discount > 0 or specific items)
        const isHot = discount > 0 || p.promotion_description;

        const card = document.createElement('div');
        card.className = "bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative border border-transparent hover:border-blue-50 group flex flex-col";

        card.innerHTML = `
            <!-- Badges -->
            ${isHot ? `<div class="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm z-10">HOT</div>` : ''}
            
            <!-- Image Area -->
            <div class="h-40 w-full mb-4 flex items-center justify-center bg-gray-50 rounded-xl overflow-hidden relative group-hover:bg-white transition-colors">
                <img src="${p.image}" alt="${p.name}" class="h-32 object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500">
            </div>

            <!-- Content -->
            <div class="flex-1 flex flex-col">
                <h3 class="font-bold text-gray-800 text-sm leading-tight mb-1 line-clamp-2 h-10">${p.name}</h3>
                <p class="text-xs text-gray-400 font-medium mb-3">${p.unit || 'Each'}</p>
                
                <div class="mt-auto flex justify-between items-end">
                    <div>
                        ${discount > 0 ? `<p class="text-[10px] text-gray-400 line-through mb-0.5">₹${price}</p>` : ''}
                        <p class="text-lg font-black text-gray-900">₹${finalPrice.toFixed(2)}</p>
                    </div>
                    <button onclick="addToCart('${p.id}')" class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-200 hover:bg-blue-600 active:scale-90 transition-transform">
                        <i class="fas fa-plus text-xs"></i>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function refreshCart() {
    if (checkoutInProgress) return; // Don't refresh during checkout modal
    fetchCart().then(renderCart).catch(e => console.error("Cart sync failed", e));
}

function renderCart(cartData) {
    const items = Object.values(cartData.items || {});
    const total = cartData.total || 0;

    // Toggle Basket Visibility
    const basketContainer = document.getElementById('basket-container');
    if (items.length > 0) {
        basketContainer.classList.remove('hidden');
    } else {
        basketContainer.classList.add('hidden');
    }

    // Update Badge
    const countBadge = document.getElementById('basket-count-badge');
    const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
    countBadge.textContent = `${totalQty} Items`;

    // Update List
    const list = document.getElementById('basket-items');

    if (items.length === 0) {
        list.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-gray-300 animate-fade-in">
                <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <i class="fas fa-shopping-basket text-2xl text-gray-300"></i>
                </div>
                <p class="font-medium text-sm">Your basket is empty</p>
                <p class="text-xs text-gray-400 mt-1">Scan items to add them</p>
            </div>`;
    } else {
        list.innerHTML = items.map(item => `
            <div class="flex gap-4 p-3 bg-white rounded-xl border border-gray-100 shadow-sm relative group hover:border-blue-100 transition-colors">
                <!-- Image -->
                <div class="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <img src="${item.image}" class="w-12 h-12 object-contain mix-blend-multiply">
                </div>
                
                <!-- Info -->
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start">
                        <h4 class="font-bold text-gray-800 text-sm truncate pr-6">${item.name}</h4>
                        <button onclick="removeFromCart('${item.id}')" class="text-gray-300 hover:text-red-500 transition-colors absolute top-2 right-2 p-1">
                            <i class="fas fa-times text-xs"></i>
                        </button>
                    </div>
                    <p class="text-[10px] text-gray-400 font-medium mb-2">${item.unit || '1 Unit'} x ${item.qty}</p>
                    
                    <div class="flex justify-between items-end">
                        <div class="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1">
                            <button onclick="removeItem('${item.id}')" class="text-gray-400 hover:text-gray-600 text-[10px] w-4 text-center">-</button>
                            <span class="text-xs font-bold text-gray-700 w-4 text-center">${item.qty}</span>
                            <button onclick="addToCart('${item.id}')" class="text-gray-400 hover:text-blue-500 text-[10px] w-4 text-center">+</button>
                        </div>
                        <span class="font-bold text-gray-900 text-sm">₹${(item.final_price * item.qty).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Update Footer Calculations
    // const total already exists from top of function
    const tax = total * 0.05; // 5% Mock Tax

    // Apply Discount if exists
    let discountAmount = 0;
    let discountLabel = "No Discount";

    // Check if user has won a discount
    const wonDiscount = localStorage.getItem('spin_discount');
    if (wonDiscount) {
        if (wonDiscount.includes('%')) {
            const percent = parseFloat(wonDiscount);
            discountAmount = total * (percent / 100);
            discountLabel = `${percent}% OFF`;
        } else if (wonDiscount.includes('Free')) {
            // Logic for 'Free Item' - for now just high discount or specific handling
            // Let's assume Free Item means 100% off smallest item, but simpler: flat discount
            discountAmount = 50; // Flat 50 off for free item for now
            discountLabel = "Free Item (-₹50)";
        }
    }

    const finalTotal = Math.max(0, total + tax - discountAmount);

    document.getElementById('basket-subtotal').textContent = `₹${total.toFixed(2)}`;
    document.getElementById('basket-tax').textContent = `₹${tax.toFixed(2)}`;

    // Add discount row
    const discountRow = document.getElementById('basket-discount-row');
    if (discountRow) {
        discountRow.innerHTML = `
            <span class="text-xs text-green-500 font-medium">${discountLabel}</span>
            <span class="text-sm font-bold text-green-500">-₹${discountAmount.toFixed(2)}</span>
        `;
    }

    document.getElementById('basket-total').textContent = `₹${finalTotal.toFixed(2)}`;

    // Enable/Disable Checkout
    const btn = document.getElementById('checkout-btn');
    if (btn) {
        btn.disabled = items.length === 0;
        // Pass discount info to payment
        btn.onclick = () => openPaymentModal(finalTotal, discountAmount, discountLabel);
    }
}

// --- Interactions ---

function setupCategories() {
    const buttons = document.querySelectorAll('.category-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Visual toggle
            buttons.forEach(b => {
                b.classList.remove('active', 'bg-teal-50', 'text-teal-600', 'ring-1', 'ring-teal-100');
                b.classList.add('bg-white', 'text-gray-600');
                // Remove existing badge if present
                const badge = b.querySelector('.absolute');
                if (badge) badge.remove();
            });

            // Add active style to clicked
            btn.classList.remove('bg-white', 'text-gray-600');
            btn.classList.add('active', 'bg-teal-50', 'text-teal-600', 'ring-1', 'ring-teal-100');

            // Filter Logic
            const cat = btn.dataset.category;
            filterProducts(cat);
        });
    });
}

function filterProducts(category) {
    if (category === 'best-seller') {
        renderProducts(allProducts);
    } else if (category === 'promo') {
        // Show ONLY items with discount
        const filtered = allProducts.filter(p => p.discount && p.discount > 0);
        renderProducts(filtered);
    } else {
        const filtered = allProducts.filter(p =>
            p.category && p.category.toLowerCase().includes(category)
        );
        renderProducts(filtered.length ? filtered : allProducts);
    }
}

async function addToCart(id) {
    await scanItem(id); // Use existing API helper
    await refreshCart();
}

async function removeFromCart(id) {
    await removeItem(id); // -1 qty
    await refreshCart();
}

// --- Navigation & UI ---

function handleNav(page) {
    // Special Case: Map (Coming Soon)
    if (page === 'map') {
        showToast('Store Map Coming Soon!', 'info');
        return; // Stop here, don't change active tab
    }

    // 1. Update Nav Visuals
    updateNavVisuals(page);

    // 2. Handle Action / View Switching
    if (page === 'home') {
        switchView('home');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Default behavior when clicking Home: Reset to Best Seller
        filterProducts('best-seller');
        updateCategoryBarVisuals('best-seller');
    } else if (page === 'category') {
        switchView('category');
    } else if (page === 'account') {
        openModal('account-modal');
    }
}

function switchView(viewName) {
    const homeView = document.getElementById('home-view');
    const catView = document.getElementById('category-view');

    if (viewName === 'home') {
        if (catView) {
            catView.classList.add('opacity-0');
            setTimeout(() => catView.classList.add('hidden'), 300);
        }
        if (homeView) {
            homeView.classList.remove('hidden');
        }
    } else if (viewName === 'category') {
        if (homeView) {
            homeView.classList.add('hidden');
        }
        if (catView) {
            catView.classList.remove('hidden');
            // Trigger reflow/delay for transition if needed
            setTimeout(() => catView.classList.remove('opacity-0'), 10);
        }
    }
}

function selectCategory(category) {
    // Called from Category View
    // 1. Switch to Home View
    switchView('home');
    // 2. Update Nav to Home
    updateNavVisuals('home');
    // 3. Apply Filter
    filterProducts(category);
    updateCategoryBarVisuals(category);
}

function updateNavVisuals(activePage) {
    const navs = ['home', 'category', 'map', 'account'];
    navs.forEach(n => {
        const btn = document.getElementById(`nav-${n}`);
        if (btn) {
            if (n === activePage) {
                btn.classList.remove('text-gray-400', 'hover:text-gray-600');
                btn.classList.add('text-blue-500');
                const label = btn.querySelector('span');
                if (label) label.classList.replace('font-medium', 'font-bold');
            } else {
                btn.classList.remove('text-blue-500');
                btn.classList.add('text-gray-400', 'hover:text-gray-600');
                const label = btn.querySelector('span');
                if (label) label.classList.replace('font-bold', 'font-medium');
            }
        }
    });
}

function updateCategoryBarVisuals(activeCat) {
    document.querySelectorAll('.category-btn').forEach(b => {
        b.classList.remove('active', 'bg-teal-50', 'text-teal-600', 'ring-1', 'ring-teal-100');
        b.classList.add('bg-white', 'text-gray-600');
        if (b.dataset.category === activeCat) {
            b.classList.add('active', 'bg-teal-50', 'text-teal-600', 'ring-1', 'ring-teal-100');
            b.classList.remove('bg-white', 'text-gray-600');
        }
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast-notification');
    const msg = document.getElementById('toast-message');
    const icon = document.getElementById('toast-icon');

    if (!toast) return;

    msg.textContent = message;

    // Reset classes
    toast.className = "fixed top-24 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full shadow-xl z-[100] flex items-center gap-3 transition-all duration-300 pointer-events-none";

    // Add active classes
    toast.classList.remove('opacity-0', 'translate-y-[-20px]');

    if (type === 'error') {
        toast.classList.add('bg-red-900', 'text-white');
        icon.className = 'fas fa-exclamation-circle text-red-500';
    } else {
        toast.classList.add('bg-gray-900', 'text-white');
        icon.className = 'fas fa-info-circle text-yellow-400';
    }

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-[-20px]');
    }, 3000);
}

// --- Generic Modal Helpers ---

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        if (modal.querySelector('div')) modal.querySelector('div').classList.remove('scale-95');
    }, 10);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('opacity-0');
    if (modal.querySelector('div')) modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// --- Payment Flows ---

function setupPaymentToggles() {
    const radios = document.querySelectorAll('input[name="payment"]');
    const qrSection = document.getElementById('upi-qr-section');

    radios.forEach(r => {
        r.addEventListener('change', (e) => {
            if (e.target.value === 'upi') {
                qrSection.classList.remove('hidden');
            } else {
                qrSection.classList.add('hidden');
            }
        });
    });
}


let currentDiscountPercent = 0;

function openPaymentModal(totalAmount, discountAmount = 0, discountLabel = "") {
    checkoutInProgress = true;
    openModal('payment-modal');

    // Store discount % for API call
    if (discountLabel.includes('%')) {
        currentDiscountPercent = parseFloat(discountLabel);
    } else if (discountLabel.includes('Free')) {
        currentDiscountPercent = 100; // technically 100% off an item, but simplified
    } else {
        currentDiscountPercent = 0;
    }

    // Update UI text
    document.getElementById('payment-modal-total').innerHTML = `
        <div class="flex flex-col items-center">
            <span class="text-3xl">₹${totalAmount.toFixed(2)}</span>
            ${discountAmount > 0 ? `<span class="text-xs text-green-500 bg-green-50 px-2 py-1 rounded mt-1">Includes ${discountLabel}</span>` : ''}
        </div>
    `;

    // Reset to UPI by default
    const upiRadio = document.querySelector('input[name="payment"][value="upi"]');
    if (upiRadio) upiRadio.checked = true;

    const qrSection = document.getElementById('upi-qr-section');
    qrSection.classList.remove('hidden'); // Ensure visible start

    // Generate QR
    const upiId = "basilmuhammad627@oksbi";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=Smart Trolley&am=${totalAmount}&cu=INR`)}`;
    document.getElementById('upi-qr-image').src = qrUrl;

    // Ensure toggles are bound
    setupPaymentToggles();
}

function closePaymentModal() {
    closeModal('payment-modal');
    setTimeout(() => { checkoutInProgress = false; }, 300);
}

async function processPayment() {
    // Show spinner on button
    const btn = document.querySelector('#payment-modal button:last-child');
    const originalText = btn.innerHTML; // Fixed: was textContent
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Processing';
    btn.disabled = true;

    await new Promise(r => setTimeout(r, 2000)); // Simulate delay

    try {
        await checkout(currentDiscountPercent); // Call backend with discount
        localStorage.removeItem('spin_discount'); // Clear used discount
        closePaymentModal();
        openModal('success-modal'); // Reusing generic helper

    } catch (e) {
        alert('Payment Failed');
        console.error(e);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function closeSuccessModal() {
    closeModal('success-modal');
    setTimeout(() => {
        checkoutInProgress = false;
        refreshCart();
    }, 300);
}

// --- Clock ---

function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateString = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const timeEl = document.getElementById('current-time');
    const dateEl = document.getElementById('current-date');

    if (timeEl) timeEl.textContent = timeString;
    if (dateEl) dateEl.textContent = dateString;
}

// Global simulation helper for the dev panel
window.simulateScan = addToCart;
