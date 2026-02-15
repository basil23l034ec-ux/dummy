document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    init();
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
});

function initTheme() {
    const isDark = localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

window.toggleTheme = function () {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    // Refresh charts to apply new theme colors
    if (currentData) {
        initMainChart(currentData);
        updateCategoryChart(currentData);
    }
}

function getThemeColors() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
        text: isDark ? '#ffffff' : '#111827',
        muted: isDark ? '#9ca3af' : '#64748b',
        grid: isDark ? '#232332' : '#e2e8f0',
        card: isDark ? '#181824' : '#ffffff',
        border: isDark ? '#232332' : '#e2e8f0',
        accent: isDark ? '#ccf381' : '#4f46e5' // Neon Lime vs Indigo
    };
}

let charts = {};

async function init() {
    await refreshDashboard();
    await loadInventory();

    // Refresh every 30 seconds
    setInterval(refreshDashboard, 30000);
}

async function refreshDashboard() {
    try {
        let data = await fetchAdminAnalytics();
        if (data.status !== 'success') throw new Error(data.message);
        if (currentTab === 'daily' && selectedDailyEndDate) {
            const dailyData = await fetchAdminAnalytics({ end_date: selectedDailyEndDate });
            if (dailyData.status === 'success' && dailyData.daily_sales)
                data.daily_sales = dailyData.daily_sales;
        }

        // 1. Update Stats (Sales Summary Card)
        document.getElementById('stat-today-sales').textContent = `₹${(data.stats.total_sales || 0).toLocaleString('en-IN')}`;
        // stat-today-bills is now 'Total Products Sold'
        document.getElementById('stat-today-bills').textContent = (data.stats.total_orders || 0).toLocaleString('en-IN');
        // Note: active-trolleys and low-stock might not be in the new summary card, removed or kept elsewhere?
        // Checking HTML: They were removed from the top summary card in previous step.
        // We can ignore updating them if elements don't exist, or log if needed.
        const activeTrolleyEl = document.getElementById('stat-active-trolleys');
        if (activeTrolleyEl) activeTrolleyEl.textContent = data.stats.active_trolleys || 0;

        const lowStockEl = document.getElementById('stat-low-stock');
        if (lowStockEl) lowStockEl.textContent = data.stats.low_stock_count || 0;

        // Trend
        const trend = data.stats.trend_pct || 0;
        const trendEl = document.getElementById('stat-trend');
        trendEl.textContent = `${trend > 0 ? '+' : ''}${trend}% from yesterday`;
        trendEl.className = `text-xs mt-1 font-bold ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`;

        // 2. Update Recent Sales
        loadRecentSales(data.recent_sales);

        // 3. Update Charts
        initMainChart(data);
        updateCategoryChart(data);

    } catch (error) {
        console.error('Dashboard refresh failed:', error);
        const header = document.querySelector('header');
        let errBanner = document.getElementById('error-banner');
        if (!errBanner) {
            errBanner = document.createElement('div');
            errBanner.id = 'error-banner';
            errBanner.className = 'bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded relative mb-4';
            header.parentNode.insertBefore(errBanner, header.nextSibling);
        }
        errBanner.innerHTML = `<strong class="font-bold">Error loading data:</strong> <span class="block sm:inline">${error.message}</span>`;
    }
}

function loadRecentSales(sales) {
    const listContainer = document.getElementById('recent-sales-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!sales || sales.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-slate-400 text-sm py-8">No recent sales yet.</p>';
        return;
    }

    sales.forEach(sale => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-dark-border/50 rounded-xl transition cursor-default group';
        const time = new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-slate-100 dark:bg-dark-bg text-slate-600 dark:text-dark-muted rounded-full flex items-center justify-center text-xs group-hover:bg-dark-accent group-hover:text-dark-bg transition-colors">
                    <i class="fas fa-shopping-bag"></i>
                </div>
                <div>
                    <p class="text-sm font-bold text-slate-800 dark:text-white">Order #${sale.id.toString().slice(-4)}</p>
                    <p class="text-[10px] text-slate-500 dark:text-dark-muted font-medium">${time}</p>
                </div>
            </div>
            <p class="text-sm font-black text-slate-800 dark:text-white group-hover:text-dark-accent transition-colors">₹${sale.total}</p>
        `;
        listContainer.appendChild(div);
    });
}

async function loadInventory() {
    try {
        const inventory = await fetchInventory();
        const tableBody = document.getElementById('inventory-table');
        tableBody.innerHTML = '';

        Object.values(inventory).forEach(item => {
            const row = document.createElement('tr');
            const stockStatus = item.stock < 5
                ? 'text-red-500 bg-red-500/10 border border-red-500/20'
                : 'text-dark-accent bg-dark-accent/10 border border-dark-accent/20'; // Neon Green for In Stock
            const statusLabel = item.stock < 5 ? 'Low Stock' : 'In Stock';

            row.innerHTML = `
                <td class="px-6 py-4 font-bold text-slate-800 dark:text-white">${item.name}</td>
                <td class="px-6 py-4 text-slate-500 dark:text-white font-medium">₹${item.price}</td>
                <td class="px-6 py-4 text-slate-500 dark:text-dark-muted">${item.stock}</td>
                <td class="px-6 py-4">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase ${stockStatus}">
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

function updateCharts(data) {
    // 1. Daily Sales
    const dailyCtx = document.getElementById('dailySalesChart').getContext('2d');
    if (charts.daily) charts.daily.destroy();
    charts.daily = new Chart(dailyCtx, {
        type: 'line',
        data: {
            labels: data.daily_sales.map(d => d.date),
            datasets: [{
                label: 'Revenue',
                data: data.daily_sales.map(d => d.amount),
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });
} // End of updateCharts

// Initialize Main Tabbed Chart Logic
let mainChart = null;
let currentData = null;
let currentTab = 'daily';
let selectedDailyEndDate = null; // YYYY-MM-DD or null = today

function initMainChart(data) {
    currentData = data;
    selectedDailyEndDate = null;
    const dateInput = document.getElementById('daily-end-date');
    if (dateInput) {
        const today = new Date().toISOString().slice(0, 10);
        dateInput.value = today;
    }
    switchTab('daily');
    setupDailyDatePicker();
}

function setupDailyDatePicker() {
    const wrap = document.getElementById('daily-date-wrap');
    const hint = document.getElementById('daily-date-hint');
    const dateInput = document.getElementById('daily-end-date');
    const chartArea = document.getElementById('main-chart-area');
    
    // Create a floating date input for context menu interactions
    let floatInput = document.getElementById('float-date-input');
    if (!floatInput) {
        floatInput = document.createElement('input');
        floatInput.type = 'date';
        floatInput.id = 'float-date-input';
        // Style to be invisible but present for showPicker positioning
        Object.assign(floatInput.style, {
            position: 'fixed',
            opacity: '0',
            zIndex: '50',
            width: '20px', // Small but non-zero
            height: '20px',
            pointerEvents: 'none', // Allow clicks to pass through if needed, but we toggle it
            left: '0',
            top: '0'
        });
        document.body.appendChild(floatInput);

        // Sync change from floating input
        floatInput.addEventListener('change', async function() {
            const endDate = this.value;
            if (!endDate) return;
            
            // Sync with header input
            if (dateInput) dateInput.value = endDate;
            
            selectedDailyEndDate = endDate;
            try {
                const data = await fetchAdminAnalytics({ end_date: endDate });
                if (data.status === 'success' && data.daily_sales) {
                    currentData.daily_sales = data.daily_sales;
                    switchTab('daily');
                }
            } catch (e) {
                console.error('Failed to load daily sales for date:', e);
            }
        });
    }

    if (!dateInput) return;

    function setDailyVisibility(show) {
        if (wrap) wrap.classList.toggle('hidden', !show);
        if (wrap && show) wrap.classList.add('flex');
        if (hint) hint.classList.toggle('hidden', !show);
    }

    dateInput.addEventListener('change', async function () {
        const endDate = this.value;
        if (!endDate) return;
        selectedDailyEndDate = endDate;
        try {
            const data = await fetchAdminAnalytics({ end_date: endDate });
            if (data.status === 'success' && data.daily_sales) {
                currentData.daily_sales = data.daily_sales;
                switchTab('daily');
            }
        } catch (e) {
            console.error('Failed to load daily sales for date:', e);
        }
    });

    chartArea.addEventListener('contextmenu', function (e) {
        if (currentTab !== 'daily') return;
        e.preventDefault();
        
        // Position float input at cursor
        if (floatInput) {
            floatInput.style.left = `${e.clientX}px`;
            floatInput.style.top = `${e.clientY}px`;
            floatInput.value = selectedDailyEndDate || new Date().toISOString().slice(0, 10);
            
            // Use showPicker if available (Modern Browsers)
            if (floatInput.showPicker) {
                floatInput.showPicker();
            } else {
                // Fallback for older browsers: focus and click
                floatInput.style.pointerEvents = 'auto'; // Enable events temp
                floatInput.focus();
                floatInput.click();
                setTimeout(() => floatInput.style.pointerEvents = 'none', 100);
            }
        }
    });

    window.switchTabDailyDateVisibility = function (tab) {
        setDailyVisibility(tab === 'daily');
        const today = new Date().toISOString().slice(0, 10);
        if (tab === 'daily') {
             if (dateInput && !dateInput.value) dateInput.value = selectedDailyEndDate || today;
        }
    };
}

window.switchTab = function (tab) {
    currentTab = tab;

    if (window.switchTabDailyDateVisibility) window.switchTabDailyDateVisibility(tab);

    // Update Tab Styles
    ['hourly', 'daily', 'weekly', 'monthly'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (btn) {
            if (t === tab) {
                btn.className = 'bg-white dark:bg-dark-card shadow-sm text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-lg text-xs font-bold transition border border-slate-200 dark:border-dark-border';
            } else {
                btn.className = 'px-3 py-1 rounded-lg text-xs font-bold text-slate-500 dark:text-dark-muted hover:text-white transition';
            }
        }
    });

    // Prepare Data
    let labels = [];
    let values = [];

    const hourly = currentData.hourly_sales || [];
    const daily = currentData.daily_sales || [];
    let weekly = currentData.weekly_sales || [];
    const monthly = currentData.monthly_sales || [];

    // Fallback for Weekly if API didn't return it (e.g. old server): 8 weeks with zeros
    if (tab === 'weekly' && weekly.length === 0) {
        weekly = [];
        const now = new Date();
        for (let i = 7; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i * 7);
            const label = i === 0 ? 'This week' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            weekly.push({ week: label, amount: 0 });
        }
    }

    if (tab === 'hourly') {
        labels = hourly.map(d => d.hour);
        values = hourly.map(d => d.amount);
    } else if (tab === 'daily') {
        labels = daily.map(d => d.date);
        values = daily.map(d => d.amount);
    } else if (tab === 'weekly') {
        labels = weekly.map(d => d.week);
        values = weekly.map(d => d.amount);
    } else {
        labels = monthly.map(d => d.month);
        values = monthly.map(d => d.amount);
    }

    // Calculate Stats for Context Row (guard empty values for peak)
    const total = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? total / values.length : 0;
    const peak = values.length ? Math.max(...values, 0) : 0;

    const s1 = document.getElementById('ctx-stat-1');
    const s2 = document.getElementById('ctx-stat-2');
    const s3 = document.getElementById('ctx-stat-3');

    if (s1) s1.textContent = `₹${Math.round(avg).toLocaleString('en-IN')}`;
    if (s2) s2.textContent = `₹${Math.round(peak).toLocaleString('en-IN')}`;
    if (s3) s3.textContent = `₹${Math.round(total).toLocaleString('en-IN')}`;

    // Update Main Chart displayed Total
    const mainTotalEl = document.getElementById('main-chart-total');
    if (mainTotalEl) {
        mainTotalEl.textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Render Table Body
    const tbody = document.getElementById('analytics-table-body');
    if (tbody) {
        tbody.innerHTML = labels.map((l, i) => `
            <tr class="border-b border-slate-200 dark:border-dark-border last:border-0 hover:bg-slate-50 dark:hover:bg-dark-bg transition">
                <td class="py-3 font-medium text-slate-800 dark:text-white pl-2">${l}</td>
                <td class="py-3 text-right font-bold text-slate-800 dark:text-white">₹${values[i].toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td class="py-3 text-right pr-2">
                    <span class="text-xs font-bold ${values[i] > (values[i - 1] || 0) ? 'text-green-500' : 'text-slate-400 dark:text-dark-muted'}">
                        ${i > 0 ? (values[i] >= values[i - 1] ? '↑' : '↓') : '-'}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    // Render Chart
    const ctx = document.getElementById('mainAnalyticsChart').getContext('2d');
    if (mainChart) mainChart.destroy();

    const theme = getThemeColors();

    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue',
                data: values,
                borderColor: theme.accent, // Neon Lime
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                    gradient.addColorStop(0, 'rgba(204, 243, 129, 0.2)'); // Lime Alpha
                    gradient.addColorStop(1, 'rgba(204, 243, 129, 0)');
                    return gradient;
                },
                borderWidth: 3,
                pointBackgroundColor: theme.card,
                pointBorderColor: theme.accent,
                pointBorderWidth: 2,
                pointRadius: 6,         // Larger points
                pointHoverRadius: 8,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: theme.card,
                    titleColor: theme.text,
                    bodyColor: theme.text,
                    borderColor: theme.border,
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `Revenue: ₹${context.raw.toLocaleString('en-IN')}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    min: 0,
                    suggestedMax: (values.length && Math.max(...values) === 0) ? 100 : undefined,
                    grid: { color: theme.grid, drawBorder: false },
                    ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: theme.muted }
                },
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: theme.muted, maxRotation: 45 }
                }
            }
        }
    });
}

function updateCategoryChart(data) {
    // 3. Category Distribution (Aesthetic/Vibrant Palette)
    const categoryCtx = document.getElementById('categorySalesChart').getContext('2d');
    if (charts.category) charts.category.destroy();

    // Use a more vibrant palette for better distinction
    const colors = ['#ccf381', '#8b5cf6', '#3b82f6', '#f43f5e', '#a8a29e']; // Lime, Purple, Blue, Rose, Gray

    charts.category = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: data.category_sales.map(d => d.category),
            datasets: [{
                data: data.category_sales.map(d => d.amount),
                backgroundColor: colors,
                borderWidth: 0, // No border for cleaner look
                hoverOffset: 15,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%',  // Thinner ring
            plugins: { legend: { display: false } }
        }
    });

    // Update Legend
    const legendContainer = document.getElementById('category-legend');
    legendContainer.innerHTML = '';
    data.category_sales.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center text-sm';
        div.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full" style="background-color: ${colors[index % colors.length]}"></div>
                <span class="text-slate-500 dark:text-dark-muted font-bold">${item.category}</span>
            </div>
            <span class="font-bold text-slate-800 dark:text-white">${item.percentage}%</span>
        `;
        legendContainer.appendChild(div);
    });
}

// --- Chatbot Functionality ---
function toggleChat() {
    const win = document.getElementById('chat-window');
    win.classList.toggle('hidden');
}

function formatBotText(text) {
    if (!text) return '';
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function appendMessage(sender, text, isHtml) {
    const chatMessages = document.getElementById('chat-messages');
    const wrap = document.createElement('div');
    wrap.className = 'flex gap-2 ' + (sender === 'user' ? 'flex-row-reverse' : '');
    const bubble = document.createElement('div');
    if (sender === 'user') {
        bubble.className = 'bg-indigo-500/20 p-3 rounded-xl rounded-tr-none text-indigo-100 dark:text-indigo-200 border border-indigo-500/30 max-w-[85%]';
        bubble.textContent = text;
    } else {
        bubble.className = 'bg-slate-100 dark:bg-dark-bg p-3 rounded-xl rounded-tl-none text-slate-700 dark:text-dark-text border border-slate-200 dark:border-dark-border max-w-[85%]';
        if (isHtml) bubble.innerHTML = formatBotText(text);
        else bubble.textContent = text;
    }
    if (sender === 'bot') {
        const icon = document.createElement('div');
        icon.className = 'w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0 text-indigo-600 dark:text-indigo-400';
        icon.innerHTML = '<i class="fas fa-robot text-sm"></i>';
        wrap.appendChild(icon);
    }
    wrap.appendChild(bubble);
    chatMessages.appendChild(wrap);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator(show) {
    const container = document.getElementById('chat-messages');
    let el = document.getElementById('chat-typing');
    if (show) {
        if (!el) {
            el = document.createElement('div');
            el.id = 'chat-typing';
            el.className = 'flex gap-2';
            el.innerHTML = '<div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0"><i class="fas fa-robot text-sm text-indigo-600"></i></div><div class="bg-slate-100 dark:bg-dark-bg p-3 rounded-xl rounded-tl-none border border-slate-200 dark:border-dark-border"><span class="animate-pulse text-slate-500">Thinking...</span></div>';
        }
        container.appendChild(el);
        container.scrollTop = container.scrollHeight;
    } else if (el && el.parentNode) {
        el.remove();
    }
}

window.chatQuickReply = function (text) {
    const input = document.getElementById('chat-input');
    if (input) {
        input.value = text;
        sendMessage();
    }
};

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = (input && input.value) ? input.value.trim() : '';
    if (!message) return;

    appendMessage('user', message);
    if (input) input.value = '';

    const sendBtn = document.getElementById('chat-send');
    if (sendBtn) sendBtn.disabled = true;
    showTypingIndicator(true);

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const data = await response.json();
        showTypingIndicator(false);
        appendMessage('bot', data.reply || 'No response.', true);
    } catch (error) {
        showTypingIndicator(false);
        appendMessage('bot', 'Sorry, I couldn\'t connect. Please try again.');
    }
    if (sendBtn) sendBtn.disabled = false;
}

document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
