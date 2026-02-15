const API_BASE_URL = '';

async function fetchAdminAnalytics(opts) {
    const params = new URLSearchParams();
    if (opts && opts.end_date) params.set('end_date', opts.end_date);
    const url = params.toString() ? `${API_BASE_URL}/api/admin/analytics?${params}` : `${API_BASE_URL}/api/admin/analytics`;
    const response = await fetch(url);
    return await response.json();
}

async function fetchInventory() {
    const response = await fetch(`${API_BASE_URL}/inventory`);
    return await response.json();
}
