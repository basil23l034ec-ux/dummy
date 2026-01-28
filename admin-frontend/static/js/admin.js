document.addEventListener('DOMContentLoaded', () => {
    init();
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
});

let charts = {};

async function init() {
    await updateStats();
    await loadInventory();
    await initCharts();
    
    // Refresh every 30 seconds
    setInterval(updateStats, 30000);
}

async function updateStats() {
    try {
        const data = await fetchAdminData();
        document.getElementById('stat-sales').textContent = `₹${data.total_sales.toFixed(2)}`;
        document.getElementById('stat-orders').textContent = data.total_orders;
        document.getElementById('stat-inventory').textContent = data.total_products;
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

async function loadInventory() {
    try {
        const inventory = await fetchInventory();
        const tableBody = document.getElementById('inventory-table');
        tableBody.innerHTML = '';
        
        Object.values(inventory).forEach(item => {
            const row = document.createElement('tr');
            const stockStatus = item.stock < 10 ? 'text-orange-500 bg-orange-50' : 'text-green-500 bg-green-50';
            const statusLabel = item.stock < 10 ? 'Low Stock' : 'In Stock';
            
            row.innerHTML = `
                <td class="px-6 py-4 font-medium text-slate-800">${item.name}</td>
                <td class="px-6 py-4 text-slate-500">₹${item.price}</td>
                <td class="px-6 py-4 text-slate-500">${item.stock}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase ${stockStatus}">
                        ${statusLabel}
                    </span>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading inventory:', error);
    }
}

async function initCharts() {
    try {
        const dailyData = await fetchDailySales();
        const monthlyData = await fetchMonthlySales();
        
        // Daily Sales Chart
        const dailyCtx = document.getElementById('dailySalesChart').getContext('2d');
        charts.daily = new Chart(dailyCtx, {
            type: 'line',
            data: {
                labels: dailyData.map(d => d.date.split('-').slice(2).join('/')),
                datasets: [{
                    label: 'Revenue (₹)',
                    data: dailyData.map(d => d.amount),
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });

        // Monthly Growth Chart
        const monthlyCtx = document.getElementById('monthlySalesChart').getContext('2d');
        charts.monthly = new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: monthlyData.map(d => d.month),
                datasets: [{
                    label: 'Sales (₹)',
                    data: monthlyData.map(d => d.amount),
                    backgroundColor: '#6366f1',
                    borderRadius: 8
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
}

// --- Chatbot Functionality ---

function toggleChat() {
    const window = document.getElementById('chat-window');
    window.classList.toggle('hidden');
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    appendMessage('user', message);
    input.value = '';

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const data = await response.json();
        appendMessage('bot', data.reply);
    } catch (error) {
        appendMessage('bot', 'Sorry, I am having trouble connecting to the server.');
    }
}

function appendMessage(sender, text) {
    const chatMessages = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = sender === 'user' 
        ? 'bg-indigo-50 p-2 rounded-lg text-indigo-700 self-end ml-8' 
        : 'bg-slate-100 p-2 rounded-lg text-slate-700 mr-8';
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Handle Enter key for chat
document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
