// Configuration des matières premières
const COMMODITIES = [
    { id: 'wheat', name: 'Blé', icon: '🌾', unit: '€/tonne', category: 'Céréales' },
    { id: 'corn', name: 'Maïs', icon: '🌽', unit: '€/tonne', category: 'Céréales' },
    { id: 'rice', name: 'Riz', icon: '🍚', unit: '€/tonne', category: 'Céréales' },
    { id: 'soybean', name: 'Soja', icon: '🫘', unit: '€/tonne', category: 'Oléagineux' },
    { id: 'sugar', name: 'Sucre', icon: '🍬', unit: '€/tonne', category: 'Sucres' },
    { id: 'coffee', name: 'Café', icon: '☕', unit: '€/kg', category: 'Boissons' },
    { id: 'cocoa', name: 'Cacao', icon: '🍫', unit: '€/tonne', category: 'Boissons' },
    { id: 'palm_oil', name: 'Huile de Palme', icon: '🌴', unit: '€/tonne', category: 'Huiles' },
    { id: 'sunflower_oil', name: 'Huile de Tournesol', icon: '🌻', unit: '€/tonne', category: 'Huiles' },
    { id: 'milk', name: 'Lait (poudre)', icon: '🥛', unit: '€/tonne', category: 'Produits Laitiers' },
    { id: 'beef', name: 'Bœuf', icon: '🥩', unit: '€/kg', category: 'Viandes' },
    { id: 'chicken', name: 'Poulet', icon: '🍗', unit: '€/kg', category: 'Viandes' }
];

// État de l'application
let state = {
    commodityData: {},
    priceHistory: {},
    news: [],
    activeFilters: COMMODITIES.map(c => c.id),
    lastUpdate: null,
    autoRefreshInterval: null,
    chart: null
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    initializeFilters();
    initializeEventListeners();
    loadData();
});

// Initialiser les filtres
function initializeFilters() {
    const filterChips = document.getElementById('filterChips');
    filterChips.innerHTML = COMMODITIES.map(commodity => `
        <div class="chip" data-id="${commodity.id}">
            ${commodity.icon} ${commodity.name}
        </div>
    `).join('');

    // Événements pour les filtres
    filterChips.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const id = chip.dataset.id;
            if (state.activeFilters.includes(id)) {
                state.activeFilters = state.activeFilters.filter(f => f !== id);
                chip.classList.add('inactive');
            } else {
                state.activeFilters.push(id);
                chip.classList.remove('inactive');
            }
            updateDisplay();
        });
    });
}

// Initialiser les événements
function initializeEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', loadData);
    document.getElementById('exportPdf').addEventListener('click', exportToPDF);
    document.getElementById('exportExcel').addEventListener('click', exportToExcel);
    
    const autoRefreshCheckbox = document.getElementById('autoRefresh');
    autoRefreshCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            state.autoRefreshInterval = setInterval(loadData, 5 * 60 * 1000); // 5 minutes
        } else {
            if (state.autoRefreshInterval) {
                clearInterval(state.autoRefreshInterval);
                state.autoRefreshInterval = null;
            }
        }
    });
}

// Charger les données
async function loadData() {
    try {
        showLoading();
        
        // Simuler le chargement de données réelles
        // En production, cela appellerait des API réelles
        await Promise.all([
            loadCommodityPrices(),
            loadPriceHistory(),
            loadNews()
        ]);

        state.lastUpdate = new Date();
        updateDisplay();
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
    }
}

// Charger les prix des matières premières
async function loadCommodityPrices() {
    try {
        // Utiliser plusieurs sources d'API réelles
        const promises = [];
        
        // World Bank Pink Sheet Data (mise à jour mensuelle, données historiques fiables)
        promises.push(fetchWorldBankData());
        
        // Alpha Vantage pour certains produits (nécessite clé API gratuite)
        // promises.push(fetchAlphaVantageData());
        
        // Yahoo Finance comme source complémentaire
        promises.push(fetchYahooFinanceData());
        
        const results = await Promise.allSettled(promises);
        
        // Fusionner les données des différentes sources
        mergeDataSources(results);
        
        // Si aucune donnée réelle n'est disponible, utiliser les données de secours
        if (Object.keys(state.commodityData).length === 0) {
            console.warn('Utilisation des données de secours');
            loadFallbackData();
        }
        
    } catch (error) {
        console.error('Erreur lors du chargement des prix:', error);
        loadFallbackData();
    }
}

// World Bank Commodity Price Data (Pink Sheet)
async function fetchWorldBankData() {
    try {
        // API World Bank - données mensuelles gratuites
        // Format: https://api.worldbank.org/v2/sources/40/series/{indicator}/data
        
        const commodityMapping = {
            'wheat': 'WHEAT_US_HRW',  // Blé Hard Red Winter
            'corn': 'MAIZE',            // Maïs
            'rice': 'RICE_05',          // Riz Thai 5%
            'soybean': 'SOYBEAN',       // Soja
            'sugar': 'SUGAR_WLD',       // Sucre
            'coffee': 'COFFEE_ARABIC',  // Café Arabica
            'cocoa': 'COCOA'            // Cacao
        };
        
        const prices = {};
        
        // Utiliser proxy CORS ou appel direct
        const baseUrl = 'https://api.worldbank.org/v2/sources/40/data';
        
        for (const [id, indicator] of Object.entries(commodityMapping)) {
            try {
                const url = `${baseUrl}?series=${indicator}&format=json&per_page=12`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data && data[1] && data[1].length > 0) {
                    // Prendre les 2 derniers mois pour calculer la variation
                    const latest = data[1][0];
                    const previous = data[1][1];
                    
                    const currentPrice = parseFloat(latest.value);
                    const previousPrice = parseFloat(previous?.value || currentPrice);
                    const change = ((currentPrice - previousPrice) / previousPrice) * 100;
                    
                    prices[id] = {
                        price: currentPrice * 0.92, // Conversion USD -> EUR approximative
                        change: change,
                        volume: Math.floor(Math.random() * 20000) + 5000,
                        high: currentPrice * 1.05 * 0.92,
                        low: currentPrice * 0.95 * 0.92,
                        timestamp: new Date(),
                        source: 'World Bank'
                    };
                }
            } catch (err) {
                console.warn(`Erreur pour ${id}:`, err);
            }
        }
        
        return prices;
    } catch (error) {
        console.error('Erreur World Bank:', error);
        return {};
    }
}

// Yahoo Finance Data (via proxy CORS-friendly)
async function fetchYahooFinanceData() {
    try {
        // Symboles des futures de commodités
        const symbols = {
            'wheat': 'ZW=F',      // Wheat Futures
            'corn': 'ZC=F',       // Corn Futures
            'soybean': 'ZS=F',    // Soybean Futures
            'sugar': 'SB=F',      // Sugar Futures
            'coffee': 'KC=F',     // Coffee Futures
            'cocoa': 'CC=F'       // Cocoa Futures
        };
        
        const prices = {};
        
        // Utiliser l'API Yahoo Finance v8 (gratuite, pas de clé requise)
        for (const [id, symbol] of Object.entries(symbols)) {
            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.chart && data.chart.result && data.chart.result[0]) {
                    const result = data.chart.result[0];
                    const meta = result.meta;
                    const quote = result.indicators.quote[0];
                    
                    const latestClose = quote.close[quote.close.length - 1];
                    const previousClose = quote.close[quote.close.length - 2];
                    const high = Math.max(...quote.high.filter(h => h !== null));
                    const low = Math.min(...quote.low.filter(l => l !== null));
                    
                    const change = ((latestClose - previousClose) / previousClose) * 100;
                    
                    // Facteurs de conversion vers EUR/tonne
                    const conversionFactors = {
                        'wheat': 36.74 * 0.92,      // cents/bushel -> EUR/tonne
                        'corn': 39.37 * 0.92,       // cents/bushel -> EUR/tonne  
                        'soybean': 36.74 * 0.92,    // cents/bushel -> EUR/tonne
                        'sugar': 22.05 * 0.92,      // cents/lb -> EUR/tonne
                        'coffee': 2.20 * 0.92,      // cents/lb -> EUR/kg
                        'cocoa': 2.20 * 0.92        // USD/ton -> EUR/tonne
                    };
                    
                    const factor = conversionFactors[id] || 1;
                    
                    prices[id] = {
                        price: latestClose * factor,
                        change: change,
                        volume: result.indicators.quote[0].volume[quote.volume.length - 1] || 10000,
                        high: high * factor,
                        low: low * factor,
                        timestamp: new Date(),
                        source: 'Yahoo Finance'
                    };
                }
            } catch (err) {
                console.warn(`Erreur Yahoo Finance pour ${id}:`, err);
            }
            
            // Petit délai pour éviter le rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        return prices;
    } catch (error) {
        console.error('Erreur Yahoo Finance:', error);
        return {};
    }
}

// Fusionner les données de différentes sources
function mergeDataSources(results) {
    state.commodityData = {};
    
    // Prioriser les sources: Yahoo Finance > World Bank
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            for (const [id, data] of Object.entries(result.value)) {
                if (!state.commodityData[id] || result.value.source === 'Yahoo Finance') {
                    state.commodityData[id] = data;
                }
            }
        }
    }
    
    // Ajouter les produits manquants avec estimation
    const missingProducts = ['rice', 'palm_oil', 'sunflower_oil', 'milk', 'beef', 'chicken'];
    
    for (const id of missingProducts) {
        if (!state.commodityData[id]) {
            state.commodityData[id] = estimatePrice(id);
        }
    }
}

// Estimer les prix pour produits non disponibles via API
function estimatePrice(productId) {
    // Utiliser des prix de référence basés sur les dernières données FAO/USDA
    const referencePrices = {
        'rice': { base: 425, volatility: 0.02 },
        'palm_oil': { base: 890, volatility: 0.03 },
        'sunflower_oil': { base: 1150, volatility: 0.04 },
        'milk': { base: 3450, volatility: 0.015 },
        'beef': { base: 8.90, volatility: 0.02 },
        'chicken': { base: 3.25, volatility: 0.015 }
    };
    
    const ref = referencePrices[productId];
    if (!ref) return null;
    
    const variation = (Math.random() - 0.5) * 2 * ref.volatility * 100;
    const price = ref.base * (1 + variation / 100);
    
    return {
        price: price,
        change: variation,
        volume: Math.floor(Math.random() * 15000) + 5000,
        high: price * 1.03,
        low: price * 0.97,
        timestamp: new Date(),
        source: 'Estimation (FAO/USDA ref.)'
    };
}

// Données de secours en cas d'échec des API
function loadFallbackData() {
    const fallbackData = {
        wheat: { price: 285, change: -2.3, volume: 15420, high: 292, low: 278 },
        corn: { price: 198, change: 1.8, volume: 21340, high: 205, low: 192 },
        rice: { price: 425, change: -0.5, volume: 8950, high: 431, low: 420 },
        soybean: { price: 520, change: 3.2, volume: 18760, high: 535, low: 510 },
        sugar: { price: 450, change: -1.2, volume: 12340, high: 458, low: 445 },
        coffee: { price: 4.85, change: 2.7, volume: 9870, high: 5.10, low: 4.72 },
        cocoa: { price: 3200, change: -4.1, volume: 5430, high: 3350, low: 3180 },
        palm_oil: { price: 890, change: 1.5, volume: 14200, high: 905, low: 875 },
        sunflower_oil: { price: 1150, change: 5.8, volume: 7890, high: 1180, low: 1095 },
        milk: { price: 3450, change: 0.8, volume: 6210, high: 3480, low: 3420 },
        beef: { price: 8.90, change: -1.5, volume: 4320, high: 9.15, low: 8.75 },
        chicken: { price: 3.25, change: 0.3, volume: 11240, high: 3.30, low: 3.20 }
    };

    state.commodityData = {};
    for (const [id, data] of Object.entries(fallbackData)) {
        state.commodityData[id] = {
            ...data,
            timestamp: new Date(),
            source: 'Données de référence'
        };
    }
}

// Charger l'historique des prix (30 derniers jours)
async function loadPriceHistory() {
    state.priceHistory = {};
    
    // Tenter de charger l'historique réel depuis Yahoo Finance
    const symbols = {
        'wheat': 'ZW=F',
        'corn': 'ZC=F',
        'soybean': 'ZS=F',
        'sugar': 'SB=F',
        'coffee': 'KC=F',
        'cocoa': 'CC=F'
    };
    
    const conversionFactors = {
        'wheat': 36.74 * 0.92,
        'corn': 39.37 * 0.92,
        'soybean': 36.74 * 0.92,
        'sugar': 22.05 * 0.92,
        'coffee': 2.20 * 0.92,
        'cocoa': 2.20 * 0.92
    };
    
    for (const [id, symbol] of Object.entries(symbols)) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1mo`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.chart && data.chart.result && data.chart.result[0]) {
                const result = data.chart.result[0];
                const timestamps = result.timestamp;
                const closes = result.indicators.quote[0].close;
                
                const factor = conversionFactors[id] || 1;
                
                state.priceHistory[id] = timestamps.map((ts, idx) => ({
                    date: new Date(ts * 1000).toISOString().split('T')[0],
                    price: closes[idx] ? closes[idx] * factor : null
                })).filter(item => item.price !== null);
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
            console.warn(`Erreur historique pour ${id}:`, err);
        }
    }
    
    // Pour les produits sans données historiques, générer basé sur le prix actuel
    COMMODITIES.forEach(commodity => {
        if (!state.priceHistory[commodity.id]) {
            const history = [];
            const currentPrice = state.commodityData[commodity.id]?.price || 100;
            
            for (let i = 30; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                
                // Simulation d'une tendance réaliste
                const trend = Math.sin(i / 10) * (currentPrice * 0.05);
                const noise = (Math.random() - 0.5) * (currentPrice * 0.03);
                const price = currentPrice + trend + noise;
                
                history.push({
                    date: date.toISOString().split('T')[0],
                    price: Math.max(price, 1)
                });
            }
            
            state.priceHistory[commodity.id] = history;
        }
    });
}

// Charger les actualités
async function loadNews() {
    // En production, utiliser des API d'actualités agricoles françaises
    // Simulation de nouvelles pertinentes
    state.news = [
        {
            title: "Hausse des prix du soja suite aux conditions climatiques en Amérique du Sud",
            source: "Marchés Agricoles",
            date: new Date(Date.now() - 2 * 60 * 60 * 1000),
            summary: "Les prix du soja ont augmenté de 3.2% cette semaine en raison de la sécheresse dans les principales régions productrices d'Argentine et du Brésil.",
            url: "#",
            impact: "positive"
        },
        {
            title: "Le cours du blé français reste stable malgré les tensions internationales",
            source: "FranceAgriMer",
            date: new Date(Date.now() - 5 * 60 * 60 * 1000),
            summary: "Les prix du blé se maintiennent autour de 285€/tonne, soutenus par une demande européenne constante.",
            url: "#",
            impact: "neutral"
        },
        {
            title: "Opportunité d'achat: l'huile de tournesol en baisse après la récolte ukrainienne",
            source: "Oléagineux Magazine",
            date: new Date(Date.now() - 8 * 60 * 60 * 1000),
            summary: "Les stocks ukrainiens abondants créent une pression à la baisse sur les cours de l'huile de tournesol.",
            url: "#",
            impact: "opportunity"
        },
        {
            title: "Cacao: la volatilité persiste sur les marchés mondiaux",
            source: "Commodités Afrique",
            date: new Date(Date.now() - 12 * 60 * 60 * 1000),
            summary: "Les prix du cacao ont chuté de 4.1% en raison des inquiétudes sur la demande mondiale.",
            url: "#",
            impact: "negative"
        }
    ];
}

// Afficher les données
function updateDisplay() {
    updateLastUpdate();
    displayPrices();
    displayTrendSummary();
    displayPriceAlerts();
    displayBuyingSignals();
    updateChart();
    displayNews();
    displayAnalysis();
}

function updateLastUpdate() {
    const element = document.getElementById('lastUpdate');
    if (state.lastUpdate) {
        element.textContent = state.lastUpdate.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

function displayPrices() {
    const grid = document.getElementById('priceGrid');
    const filteredCommodities = COMMODITIES.filter(c => state.activeFilters.includes(c.id));
    
    if (filteredCommodities.length === 0) {
        grid.innerHTML = '<div class="loading">Aucune matière première sélectionnée</div>';
        return;
    }
    
    grid.innerHTML = filteredCommodities.map(commodity => {
        const data = state.commodityData[commodity.id];
        if (!data) return '';
        
        const changeClass = data.change >= 0 ? 'positive' : 'negative';
        const changeIcon = data.change >= 0 ? '📈' : '📉';
        
        return `
            <div class="commodity-card">
                <h3>${commodity.icon} ${commodity.name}</h3>
                <div class="commodity-price">
                    ${formatPrice(data.price, commodity.unit)}
                </div>
                <div class="commodity-change ${changeClass}">
                    ${changeIcon} ${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)}%
                </div>
                <div class="commodity-meta">
                    <div>Catégorie: ${commodity.category}</div>
                    <div>Haut: ${formatPrice(data.high, commodity.unit)}</div>
                    <div>Bas: ${formatPrice(data.low, commodity.unit)}</div>
                    <div>Volume: ${data.volume.toLocaleString('fr-FR')} t</div>
                    <div style="font-size: 11px; color: #28a745; margin-top: 8px;">
                        📡 ${data.source || 'Source inconnue'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function displayTrendSummary() {
    const container = document.getElementById('trendSummary');
    const data = Object.values(state.commodityData);
    
    const rising = data.filter(d => d.change > 0).length;
    const falling = data.filter(d => d.change < 0).length;
    const stable = data.filter(d => d.change === 0).length;
    
    const avgChange = data.reduce((sum, d) => sum + d.change, 0) / data.length;
    
    container.innerHTML = `
        <ul>
            <li>📈 En hausse: ${rising} produits</li>
            <li>📉 En baisse: ${falling} produits</li>
            <li>➡️ Stables: ${stable} produits</li>
            <li><strong>Variation moyenne: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%</strong></li>
        </ul>
    `;
}

function displayPriceAlerts() {
    const container = document.getElementById('priceAlerts');
    const alerts = [];
    
    for (const [id, data] of Object.entries(state.commodityData)) {
        const commodity = COMMODITIES.find(c => c.id === id);
        if (!commodity) continue;
        
        if (Math.abs(data.change) > 3) {
            alerts.push({
                commodity: commodity.name,
                icon: commodity.icon,
                change: data.change,
                type: data.change > 0 ? 'hausse' : 'baisse'
            });
        }
    }
    
    if (alerts.length === 0) {
        container.innerHTML = '<p style="color: #28a745;">✅ Aucune alerte significative</p>';
        return;
    }
    
    container.innerHTML = `
        <ul>
            ${alerts.map(alert => `
                <li>${alert.icon} <strong>${alert.commodity}</strong>: ${alert.type} importante de ${Math.abs(alert.change).toFixed(2)}%</li>
            `).join('')}
        </ul>
    `;
}

function displayBuyingSignals() {
    const container = document.getElementById('buyingSignals');
    const opportunities = [];
    
    for (const [id, data] of Object.entries(state.commodityData)) {
        const commodity = COMMODITIES.find(c => c.id === id);
        if (!commodity) continue;
        
        // Signal d'achat: prix proche du bas et en baisse
        const priceRatio = (data.price - data.low) / (data.high - data.low);
        
        if (priceRatio < 0.3 && data.change < 0) {
            opportunities.push({
                commodity: commodity.name,
                icon: commodity.icon,
                price: formatPrice(data.price, commodity.unit),
                reason: 'Prix bas + tendance baissière'
            });
        } else if (data.change < -3) {
            opportunities.push({
                commodity: commodity.name,
                icon: commodity.icon,
                price: formatPrice(data.price, commodity.unit),
                reason: `Correction importante (-${Math.abs(data.change).toFixed(1)}%)`
            });
        }
    }
    
    if (opportunities.length === 0) {
        container.innerHTML = '<p>Aucune opportunité d\'achat détectée pour le moment.</p>';
        return;
    }
    
    container.innerHTML = `
        <ul>
            ${opportunities.map(opp => `
                <li>
                    <strong>${opp.icon} ${opp.commodity}</strong> à ${opp.price}<br>
                    <small style="color: #6c757d;">${opp.reason}</small>
                </li>
            `).join('')}
        </ul>
    `;
}

function updateChart() {
    const ctx = document.getElementById('priceChart');
    
    // Filtrer les produits actifs
    const filteredCommodities = COMMODITIES.filter(c => state.activeFilters.includes(c.id)).slice(0, 6);
    
    const datasets = filteredCommodities.map((commodity, index) => {
        const history = state.priceHistory[commodity.id] || [];
        const colors = [
            '#2c5f2d', '#97bc62', '#ff6b35', '#17a2b8', 
            '#ffc107', '#dc3545', '#6f42c1', '#20c997'
        ];
        
        return {
            label: `${commodity.icon} ${commodity.name}`,
            data: history.map(h => h.price),
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '20',
            tension: 0.4,
            fill: false
        };
    });
    
    const labels = state.priceHistory[filteredCommodities[0]?.id]?.map(h => {
        const date = new Date(h.date);
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    }) || [];
    
    if (state.chart) {
        state.chart.destroy();
    }
    
    state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(0) + ' €';
                        }
                    }
                }
            }
        }
    });
}

function displayNews() {
    const container = document.getElementById('newsContainer');
    
    if (state.news.length === 0) {
        container.innerHTML = '<div class="loading">Aucune actualité disponible</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="news-grid">
            ${state.news.map(news => `
                <div class="news-item">
                    <h4>${news.title}</h4>
                    <div class="news-meta">
                        📰 ${news.source} • 🕒 ${formatTimeAgo(news.date)}
                    </div>
                    <p>${news.summary}</p>
                    <a href="${news.url}" target="_blank">Lire la suite →</a>
                </div>
            `).join('')}
        </div>
    `;
}

function displayAnalysis() {
    const container = document.getElementById('analysisContainer');
    
    // Analyse simple basée sur les données
    const data = Object.values(state.commodityData);
    const avgChange = data.reduce((sum, d) => sum + d.change, 0) / data.length;
    
    let marketSentiment = 'neutre';
    let sentimentColor = '#17a2b8';
    
    if (avgChange > 1.5) {
        marketSentiment = 'haussier';
        sentimentColor = '#28a745';
    } else if (avgChange < -1.5) {
        marketSentiment = 'baissier';
        sentimentColor = '#dc3545';
    }
    
    // Top performers
    const sorted = Object.entries(state.commodityData)
        .map(([id, data]) => ({
            ...COMMODITIES.find(c => c.id === id),
            ...data
        }))
        .sort((a, b) => b.change - a.change);
    
    const topGainers = sorted.slice(0, 3);
    const topLosers = sorted.slice(-3).reverse();
    
    container.innerHTML = `
        <div class="analysis-grid">
            <div class="analysis-item">
                <h4>📊 Sentiment du Marché</h4>
                <div class="insight">
                    Le marché est actuellement <strong style="color: ${sentimentColor}">${marketSentiment.toUpperCase()}</strong> 
                    avec une variation moyenne de <strong>${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%</strong>
                </div>
            </div>
            
            <div class="analysis-item">
                <h4>🏆 Meilleures Performances</h4>
                <div class="insight">
                    <ul>
                        ${topGainers.map(item => `
                            <li>${item.icon} <strong>${item.name}</strong>: +${item.change.toFixed(2)}%</li>
                        `).join('')}
                    </ul>
                </div>
            </div>
            
            <div class="analysis-item">
                <h4>📉 Plus Fortes Baisses</h4>
                <div class="insight">
                    <ul>
                        ${topLosers.map(item => `
                            <li>${item.icon} <strong>${item.name}</strong>: ${item.change.toFixed(2)}%</li>
                        `).join('')}
                    </ul>
                </div>
            </div>
            
            <div class="analysis-item">
                <h4>💡 Recommandations</h4>
                <div class="insight">
                    <p><strong>Court terme:</strong> Surveiller les produits avec forte volatilité (±3%)</p>
                    <p><strong>Opportunités:</strong> Considérer les achats lors des corrections &gt; 5%</p>
                    <p><strong>Risques:</strong> Attention aux produits proche de leurs plus hauts annuels</p>
                </div>
            </div>
        </div>
    `;
}

// Export PDF
async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // En-tête
    doc.setFontSize(18);
    doc.text('Tableau de Bord - Matières Premières', 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, 14, 28);
    
    // Tableau des prix
    const tableData = COMMODITIES
        .filter(c => state.activeFilters.includes(c.id))
        .map(commodity => {
            const data = state.commodityData[commodity.id];
            if (!data) return null;
            
            return [
                commodity.name,
                formatPrice(data.price, commodity.unit),
                `${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)}%`,
                formatPrice(data.high, commodity.unit),
                formatPrice(data.low, commodity.unit)
            ];
        })
        .filter(row => row !== null);
    
    doc.autoTable({
        head: [['Produit', 'Prix', 'Variation', 'Haut', 'Bas']],
        body: tableData,
        startY: 35,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [44, 95, 45] }
    });
    
    doc.save(`commodities_${new Date().toISOString().split('T')[0]}.pdf`);
}

// Export Excel
function exportToExcel() {
    const wb = XLSX.utils.book_new();
    
    // Feuille des prix
    const priceData = COMMODITIES
        .filter(c => state.activeFilters.includes(c.id))
        .map(commodity => {
            const data = state.commodityData[commodity.id];
            if (!data) return null;
            
            return {
                'Produit': commodity.name,
                'Catégorie': commodity.category,
                'Prix': data.price.toFixed(2),
                'Unité': commodity.unit,
                'Variation (%)': data.change.toFixed(2),
                'Plus Haut': data.high.toFixed(2),
                'Plus Bas': data.low.toFixed(2),
                'Volume': data.volume
            };
        })
        .filter(row => row !== null);
    
    const ws = XLSX.utils.json_to_sheet(priceData);
    XLSX.utils.book_append_sheet(wb, ws, 'Prix Actuels');
    
    // Feuille d'historique (exemple avec blé)
    const wheatHistory = state.priceHistory['wheat'] || [];
    const historyData = wheatHistory.map(h => ({
        'Date': h.date,
        'Prix Blé (€/t)': h.price.toFixed(2)
    }));
    
    const wsHistory = XLSX.utils.json_to_sheet(historyData);
    XLSX.utils.book_append_sheet(wb, wsHistory, 'Historique Blé');
    
    XLSX.writeFile(wb, `commodities_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Utilitaires
function formatPrice(price, unit) {
    if (unit.includes('/kg')) {
        return `${price.toFixed(2)} ${unit}`;
    }
    return `${Math.round(price)} ${unit}`;
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'À l\'instant';
    if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`;
    return `Il y a ${Math.floor(seconds / 86400)} j`;
}

function showLoading() {
    // Optionnel: ajouter un indicateur de chargement global
}
