const API_BASE_URL = '';

async function fetchAdminData() {
    const response = await fetch(`${API_BASE_URL}/admin/data`);
    return await response.json();
}

async function fetchInventory() {
    const response = await fetch(`${API_BASE_URL}/inventory`);
    return await response.json();
}

async function fetchDailySales() {
    const response = await fetch(`${API_BASE_URL}/sales/daily`);
    return await response.json();
}

async function fetchMonthlySales() {
    const response = await fetch(`${API_BASE_URL}/sales/monthly`);
    return await response.json();
}
