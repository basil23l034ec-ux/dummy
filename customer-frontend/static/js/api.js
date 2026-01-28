const API_BASE_URL = '';

async function fetchProducts() {
    const response = await fetch(`${API_BASE_URL}/products`);
    return await response.json();
}

async function fetchCart() {
    const response = await fetch(`${API_BASE_URL}/cart`);
    return await response.json();
}

async function scanItem(uid) {
    const response = await fetch(`${API_BASE_URL}/rfid`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid }),
    });
    return await response.json();
}

async function removeItem(uid) {
    const response = await fetch(`${API_BASE_URL}/cart/remove`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid }),
    });
    return await response.json();
}

async function checkout() {
    const response = await fetch(`${API_BASE_URL}/checkout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    });
    return await response.json();
}
