document.addEventListener('DOMContentLoaded', () => {
    init();
});

let products = {};

async function init() {
    await refreshCart();
    
    // Setup event listeners
    document.getElementById('checkout-btn').addEventListener('click', handleCheckout);
    
    // Start polling for cart updates (if real RFID hardware updates the backend)
    setInterval(refreshCart, 3000);
}

async function refreshCart() {
    try {
        const cart = await fetchCart();
        renderCart(cart);
    } catch (error) {
        console.error('Error refreshing cart:', error);
    }
}

function renderCart(cartData) {
    const cartList = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotalTop = document.getElementById('cart-total');
    const subtotalEl = document.getElementById('subtotal');
    const totalEl = document.getElementById('total-amount');
    const checkoutBtn = document.getElementById('checkout-btn');
    
    const items = Object.values(cartData.items || {});
    const totalAmount = cartData.total || 0;
    
    if (items.length === 0) {
        cartList.innerHTML = '<p class="text-gray-500 text-center py-8">Your cart is empty. Scan an item to start!</p>';
        cartCount.textContent = '0';
        cartTotalTop.textContent = '₹0.00';
        subtotalEl.textContent = '₹0.00';
        totalEl.textContent = '₹0.00';
        checkoutBtn.disabled = true;
        return;
    }
    
    cartList.innerHTML = '';
    let count = 0;
    
    items.forEach(item => {
        const itemTotal = item.price * item.qty;
        count += item.qty;
        
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center p-4 bg-gray-50 rounded-2xl hover:bg-red-50 active:bg-red-100 cursor-pointer transition-all border border-gray-100 hover:border-red-200 relative group';
        
        div.innerHTML = `
            <div class="flex items-center gap-4 flex-1">
                <div class="relative">
                    <img src="${item.image}" alt="${item.name}" class="w-20 h-20 object-cover rounded-xl shadow-md border-2 border-white">
                    <span class="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">
                        ${item.qty}
                    </span>
                </div>
                <div>
                    <p class="font-bold text-gray-800 text-lg leading-tight">${item.name}</p>
                    <p class="text-indigo-600 font-semibold mt-1">₹${item.price}</p>
                    <p class="text-xs text-gray-400 mt-1 uppercase tracking-wider">Tap to remove</p>
                </div>
            </div>
            <div class="flex flex-col items-end gap-2">
                <p class="font-black text-gray-900 text-xl">₹${itemTotal}</p>
                <button class="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 active:scale-95 transition-all shadow-sm">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        
        // Handle click on the whole card or the button
        div.onclick = (e) => {
            e.stopPropagation();
            handleRemove(item.id);
        };
        
        cartList.appendChild(div);
    });
    
    cartCount.textContent = count;
    cartTotalTop.textContent = `₹${totalAmount.toFixed(2)}`;
    subtotalEl.textContent = `₹${totalAmount.toFixed(2)}`;
    totalEl.textContent = `₹${totalAmount.toFixed(2)}`;
    checkoutBtn.disabled = false;
}

async function handleRemove(uid) {
    try {
        await removeItem(uid);
        await refreshCart();
    } catch (error) {
        console.error('Error removing item:', error);
    }
}

async function simulateScan(uid) {
    try {
        await scanItem(uid);
        await refreshCart();
    } catch (error) {
        console.error('Error scanning item:', error);
    }
}

async function handleCheckout() {
    try {
        const result = await checkout();
        if (result.status === 'ok') {
            document.getElementById('success-modal').classList.remove('hidden');
            setTimeout(() => {
                document.getElementById('success-modal').querySelector('div').classList.remove('scale-95');
                document.getElementById('success-modal').querySelector('div').classList.add('scale-100');
            }, 10);
        }
    } catch (error) {
        alert('Checkout failed: ' + error.message);
    }
}

function closeModal() {
    document.getElementById('success-modal').classList.add('hidden');
    refreshCart();
}
