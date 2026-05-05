// Глобальные данные
let portfolio = {
    brokers: [],   // брокерские счета (с активами)
    banks: []      // банковские счета (только баланс)
};

let currentBrokerId = null;
let currentAccountId = null;

// Для автокомплита
let allTickers = [];
let currentSuggestions = [];
let selectedSuggestionIndex = -1;

// Для модалки подтверждения
let pendingDeleteAction = null;

// Загрузка данных
async function loadData() {
    try {
        const response = await fetch('data.json');
        if (response.ok) {
            portfolio = await response.json();
            if (!portfolio.brokers) portfolio.brokers = [];
        } else {
            initDemoData();
        }
    } catch (e) {
        initDemoData();
    }
    render();
}

function initDemoData() {
    portfolio = {
        brokers: [{
            id: 'broker1', name: 'Брокер',
            accounts: [{
                id: 'acc1', name: 'Брокерский счёт', balance: 150000,
                assets: [{ id: 'ast1', ticker: 'SBER', name: 'Сбербанк', quantity: 10, price: 301.5, lotsize: 1 }]
            }]
        }],
        banks: [{
            id: 'bank1', name: 'Банк',
            accounts: [{
                id: 'bankAcc1', name: 'Накопительный счёт',
                type: 'savings',  // savings, deposit, credit, card
                balance: 80000,
                interestRate: 12.5,
                interestCondition: 'min_balance', // min_balance, daily_balance
                interestPayment: 'monthly', // monthly, daily, at_end
                creditLimit: null,
                hasDebt: false,
                debtAmount: 0
            }]
        }]
    };
}

// Сохранение
function saveData() {
    const jsonStr = JSON.stringify(portfolio, null, 2);
    // Сохраняем в localStorage для автозагрузки
    localStorage.setItem('lastPortfolioFile', jsonStr);
    
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'data.json';
    link.click();
    URL.revokeObjectURL(link.href);
    showNotification('✅ Портфель сохранён!', '#10b981');
}

// Красивое уведомление
function showNotification(message, bgColor = '#1e293b', duration = 3000) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
        max-width: 350px;
    `;
    notification.innerHTML = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// Добавляем анимации в head
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Прогресс-уведомление (верхний правый угол)
function showProgressNotification(total, current, message) {
    let progressDiv = document.getElementById('progressNotification');
    if (!progressDiv) {
        progressDiv = document.createElement('div');
        progressDiv.id = 'progressNotification';
        progressDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1e293b;
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            min-width: 200px;
            text-align: center;
        `;
        document.body.appendChild(progressDiv);
    }
    progressDiv.innerHTML = `${message}<br>${current}/${total}`;
    
    if (current === total) {
        setTimeout(() => {
            if (progressDiv) progressDiv.remove();
        }, 2000);
    }
}

function hideProgressNotification() {
    const div = document.getElementById('progressNotification');
    if (div) div.remove();
}

// Показать модалку добавления банковского счёта
function showAddBankAccountModal(bankId) {
    currentBankId = bankId;
    document.getElementById('modalBankAccount').style.display = 'block';
    
    // Показываем/скрываем доп поля в зависимости от типа счёта
    const typeSelect = document.getElementById('bankAccountType');
    const extraFields = document.getElementById('bankExtraFields');
    
    typeSelect.onchange = () => {
        const type = typeSelect.value;
        if (type === 'savings' || type === 'deposit' || type === 'credit') {
            extraFields.style.display = 'block';
        } else {
            extraFields.style.display = 'none';
        }
    };
    typeSelect.onchange();
}

// Добавление банковского счёта
function confirmAddBankAccount() {
    const name = document.getElementById('bankAccountName').value.trim();
    const balance = parseFloat(document.getElementById('bankAccountBalance').value) || 0;
    const type = document.getElementById('bankAccountType').value;
    
    if (!name) {
        showNotification('❌ Введите название счёта', '#ef4444');
        return;
    }
    
    const bank = portfolio.banks.find(b => b.id === currentBankId);
    if (bank) {
        const newAccount = {
            id: Date.now().toString(),
            name: name,
            type: type,
            balance: balance
        };
        
        // Добавляем доп поля для определенных типов
        if (type === 'savings' || type === 'deposit') {
            newAccount.interestRate = parseFloat(document.getElementById('bankInterestRate').value) || 0;
            newAccount.interestCondition = document.getElementById('bankInterestCondition').value;
            newAccount.interestPayment = document.getElementById('bankInterestPayment').value;
        }
        
        if (type === 'deposit') {
            newAccount.endDate = ''; // можно добавить выбор даты позже
        }
        
        if (type === 'credit') {
            newAccount.creditLimit = parseFloat(document.getElementById('bankCreditLimit').value) || 0;
            newAccount.hasDebt = balance < 0;
            newAccount.debtAmount = balance < 0 ? Math.abs(balance) : 0;
        }
        
        bank.accounts.push(newAccount);
        showNotification(`📁 Счёт "${name}" добавлен`, '#667eea');
    }
    
    // Очистка формы
    document.getElementById('bankAccountName').value = '';
    document.getElementById('bankAccountBalance').value = '';
    document.getElementById('bankInterestRate').value = '';
    document.getElementById('bankCreditLimit').value = '';
    document.getElementById('modalBankAccount').style.display = 'none';
    render();
}

// Редактирование банковского счёта
function editBankAccount(bankId, accountId) {
    currentBankId = bankId;
    currentBankAccountId = accountId;
    
    const bank = portfolio.banks.find(b => b.id === bankId);
    if (bank) {
        const account = bank.accounts.find(a => a.id === accountId);
        if (account) {
            document.getElementById('editBankBalance').value = account.balance;
            document.getElementById('editBankInterestRate').value = account.interestRate || 0;
            document.getElementById('modalBankAccountEdit').style.display = 'block';
        }
    }
}

function confirmEditBankAccount() {
    const newBalance = parseFloat(document.getElementById('editBankBalance').value);
    const newInterestRate = parseFloat(document.getElementById('editBankInterestRate').value);
    
    const bank = portfolio.banks.find(b => b.id === currentBankId);
    if (bank) {
        const account = bank.accounts.find(a => a.id === currentBankAccountId);
        if (account) {
            account.balance = newBalance;
            if (account.type === 'credit' && newBalance < 0) {
                account.hasDebt = true;
                account.debtAmount = Math.abs(newBalance);
            } else if (account.type === 'credit') {
                account.hasDebt = false;
                account.debtAmount = 0;
            }
            if (newInterestRate) account.interestRate = newInterestRate;
            showNotification(`💰 Счёт "${account.name}" обновлён`, '#10b981');
        }
    }
    
    document.getElementById('modalBankAccountEdit').style.display = 'none';
    render();
}

// Расчёт дохода по банковскому счёту
function calculateBankInterest(account) {
    if (!account.interestRate || account.interestRate === 0) return 0;
    if (account.type === 'credit' && account.balance >= 0) return 0;
    
    let balance = Math.abs(account.balance);
    let yearlyInterest = balance * (account.interestRate / 100);
    
    if (account.interestPayment === 'monthly') {
        return yearlyInterest / 12;
    } else if (account.interestPayment === 'daily') {
        return yearlyInterest / 365;
    }
    return yearlyInterest;
}

// Получить иконку типа банковского счёта
function getBankAccountIcon(type) {
    const icons = {
        'savings': '💰',
        'deposit': '🏦',
        'card': '💳',
        'credit': '⚠️'
    };
    return icons[type] || '📁';
}

function getBankAccountTypeName(type) {
    const names = {
        'savings': 'Накопительный',
        'deposit': 'Вклад',
        'card': 'Дебетовая карта',
        'credit': 'Кредитная карта'
    };
    return names[type] || 'Счёт';
}

function calculateTotalCapital() {
    let total = 0;
    // Брокеры
    if (portfolio.brokers && Array.isArray(portfolio.brokers)) {
        portfolio.brokers.forEach(broker => {
            if (broker.accounts) {
                broker.accounts.forEach(account => {
                    let accountTotal = account.balance || 0;
                    if (account.assets) {
                        account.assets.forEach(asset => {
                            accountTotal += (asset.quantity || 0) * (asset.price || 0);
                        });
                    }
                    total += accountTotal;
                });
            }
        });
    }
    // Банки
    if (portfolio.banks && Array.isArray(portfolio.banks)) {
        portfolio.banks.forEach(bank => {
            if (bank.accounts) {
                bank.accounts.forEach(account => {
                    total += account.balance || 0;
                });
            }
        });
    }
    return total;
}
// ========== API МОСБИРЖИ ==========
async function getMoexPrice(ticker) {
    try {
        const url = `https://iss.moex.com/iss/engines/stock/markets/shares/boards/tqbr/securities/${ticker}.json`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка');
        const data = await response.json();
        if (data.marketdata?.data?.length > 0) {
            let price = data.marketdata.data[0][2];
            if (price && !isNaN(price) && price > 0) return parseFloat(price);
            price = data.marketdata.data[0][12];
            if (price && !isNaN(price) && price > 0) return parseFloat(price);
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function refreshAllPrices() {
    let totalAssets = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const changes = [];
    
    // Собираем все активы
    const assetsList = [];
    portfolio.brokers.forEach(broker => {
        broker.accounts.forEach(account => {
            account.assets.forEach(asset => {
                assetsList.push({ broker, account, asset });
                totalAssets++;
            });
        });
    });
    
    if (totalAssets === 0) {
        showNotification('⚠️ Нет активов для обновления', '#f59e0b');
        return;
    }
    
    showProgressNotification(totalAssets, 0, '🔄 Обновление цен с Мосбиржи...');
    
    // Обновляем цены
    for (let i = 0; i < assetsList.length; i++) {
        const { asset } = assetsList[i];
        const oldPrice = asset.price;
        const newPrice = await getMoexPrice(asset.ticker);
        
        if (newPrice !== null && newPrice > 0) {
            asset.price = newPrice;
            updatedCount++;
            if (oldPrice !== newPrice) {
                changes.push(`${asset.ticker}: ${oldPrice.toFixed(2)} → ${newPrice.toFixed(2)} ₽`);
            }
        } else {
            failedCount++;
        }
        
        showProgressNotification(totalAssets, i + 1, '🔄 Обновление цен с Мосбиржи...');
    }
    
    hideProgressNotification();
    
    // Показываем результат
    if (updatedCount > 0) {
        let resultMsg = `✅ Обновлено: ${updatedCount} активов`;
        if (failedCount > 0) resultMsg += `, ошибок: ${failedCount}`;
        
        if (changes.length > 0 && changes.length <= 5) {
            showNotification(`${resultMsg}<br><small style="font-size:11px">${changes.join('<br>')}</small>`, '#10b981', 5000);
        } else if (changes.length > 5) {
            showNotification(`${resultMsg}<br><small style="font-size:11px">${changes.slice(0, 5).join('<br>')}<br>и ещё ${changes.length - 5} изменений...</small>`, '#10b981', 5000);
        } else {
            showNotification(resultMsg, '#10b981');
        }
        
        render();
    } else {
        showNotification(`❌ Не удалось обновить цены. Проверьте тикеры`, '#ef4444');
    }
}

async function refreshSinglePrice(brokerId, accountId, assetId) {
    const broker = portfolio.brokers.find(b => b.id === brokerId);
    if (broker) {
        const account = broker.accounts.find(a => a.id === accountId);
        if (account) {
            const asset = account.assets.find(a => a.id === assetId);
            if (asset) {
                const oldPrice = asset.price;
                
                // Показываем кнопку загрузки
                const btn = document.querySelector(`[data-refresh="${assetId}"]`);
                if (btn) {
                    btn.textContent = '⏳';
                    btn.disabled = true;
                }
                
                const newPrice = await getMoexPrice(asset.ticker);
                
                if (newPrice !== null && newPrice > 0) {
                    asset.price = newPrice;
                    render();
                    showNotification(`${asset.ticker}: ${oldPrice.toFixed(2)} → ${newPrice.toFixed(2)} ₽`, '#10b981', 2500);
                } else {
                    showNotification(`❌ Не удалось получить цену для ${asset.ticker}`, '#ef4444', 2000);
                }
                
                if (btn) {
                    btn.textContent = '🔄';
                    btn.disabled = false;
                }
            }
        }
    }
}

// ========== УПРАВЛЕНИЕ ==========
function addBroker() {
    document.getElementById('modalBroker').style.display = 'block';
}

function confirmAddBroker() {
    const name = document.getElementById('brokerName').value.trim();
    if (!name) return;
    portfolio.brokers.push({
        id: Date.now().toString(),
        name: name,
        accounts: []
    });
    document.getElementById('brokerName').value = '';
    document.getElementById('modalBroker').style.display = 'none';
    render();
    showNotification(`➕ Брокер "${name}" добавлен`, '#667eea');
}

function deleteBroker(brokerId) {
    const broker = portfolio.brokers.find(b => b.id === brokerId);
    if (!broker) return;
    
    showConfirmModal(
        '🗑️ Удалить брокера?',
        `Вы действительно хотите удалить брокера <strong>${escapeHtml(broker.name)}</strong>?<br>Все счета и активы внутри будут удалены безвозвратно.`,
        () => {
            portfolio.brokers = portfolio.brokers.filter(b => b.id !== brokerId);
            render();
            showNotification(`🗑️ Брокер "${broker.name}" удалён`, '#ef4444');
            hideConfirmModal();
        }
    );
}

function deleteBank(bankId) {
    const bank = portfolio.banks.find(b => b.id === bankId);
    if (!bank) return;
    
    showConfirmModal(
        '🗑️ Удалить банк?',
        `Вы действительно хотите удалить банк <strong>${escapeHtml(bank.name)}</strong>?<br>Все счета внутри будут удалены.`,
        () => {
            portfolio.banks = portfolio.banks.filter(b => b.id !== bankId);
            render();
            showNotification(`🗑️ Банк "${bank.name}" удалён`, '#ef4444');
            hideConfirmModal();
        }
    );
}

function confirmAddAccount() {
    const name = document.getElementById('accountName').value.trim();
    const type = document.getElementById('accountType').value;
    if (!name) return;
    const broker = portfolio.brokers.find(b => b.id === currentBrokerId);
    if (broker) {
        broker.accounts.push({
            id: Date.now().toString(),
            name: name,
            type: type,
            balance: 0,
            assets: []
        });
        showNotification(`📁 Счёт "${name}" добавлен`, '#667eea');
    }
    document.getElementById('accountName').value = '';
    document.getElementById('modalAccount').style.display = 'none';
    render();
}

function deleteAccount(type, parentId, accountId) {
    let account = null;
    let parentName = '';
    
    if (type === 'broker') {
        const broker = portfolio.brokers.find(b => b.id === parentId);
        if (broker) {
            account = broker.accounts.find(a => a.id === accountId);
            parentName = broker.name;
        }
    } else if (type === 'bank') {
        const bank = portfolio.banks.find(b => b.id === parentId);
        if (bank) {
            account = bank.accounts.find(a => a.id === accountId);
            parentName = bank.name;
        }
    }
    
    if (!account) return;
    
    showConfirmModal(
        '🗑️ Удалить счёт?',
        `Вы действительно хотите удалить счёт <strong>${escapeHtml(account.name)}</strong> у <strong>${escapeHtml(parentName)}</strong>?`,
        () => {
            if (type === 'broker') {
                const broker = portfolio.brokers.find(b => b.id === parentId);
                if (broker) {
                    broker.accounts = broker.accounts.filter(a => a.id !== accountId);
                }
            } else if (type === 'bank') {
                const bank = portfolio.banks.find(b => b.id === parentId);
                if (bank) {
                    bank.accounts = bank.accounts.filter(a => a.id !== accountId);
                }
            }
            render();
            showNotification(`🗑️ Счёт "${account.name}" удалён`, '#ef4444');
            hideConfirmModal();
        }
    );
}

function showModal(type, brokerId, accountId){
    currentBrokerId = brokerId;
    currentAccountId = accountId;
    document.getElementById('modal'+type).style.display = 'block';
}

function showAssetModal(brokerId, accountId) {
    currentBrokerId = brokerId;
    currentAccountId = accountId;
    document.getElementById('modalAsset').style.display = 'block';
}

function confirmBalance() {
    const amount = parseFloat(document.getElementById('balanceAmount').value);
    if (isNaN(amount)) return;
    const broker = portfolio.brokers.find(b => b.id === currentBrokerId);
    if (broker) {
        const account = broker.accounts.find(a => a.id === currentAccountId);
        if (account) {
            account.balance = amount;
            showNotification(`💰 Остаток изменён: ${amount.toLocaleString()} ₽`, '#10b981');
        }
    }
    document.getElementById('balanceAmount').value = '';
    document.getElementById('modalBalance').style.display = 'none';
    render();
}

async function confirmAddAsset() {
    const ticker = document.getElementById('assetTicker').value.trim().toUpperCase();
    const name = document.getElementById('assetName').value.trim();
    const quantity = parseFloat(document.getElementById('assetQuantity').value);
    let price = parseFloat(document.getElementById('assetPrice').value);
    const lotsize = parseInt(document.getElementById('assetLotsize').value) || 1;
    
    // ВАЛИДАЦИЯ
    if (!ticker || !name || isNaN(quantity) || quantity <= 0) {
        showNotification('❌ Заполните все поля правильно', '#ef4444');
        return;
    }
    
    // Если цена не загрузилась, пробуем ещё раз
    if (isNaN(price) || price <= 0) {
        showNotification('🔄 Подтягиваем цену с Мосбиржи...', '#f59e0b');
        await loadAssetDetails(ticker);
        price = parseFloat(document.getElementById('assetPrice').value);
        if (isNaN(price) || price <= 0) {
            showNotification('❌ Не удалось получить цену, попробуйте позже', '#ef4444');
            return;
        }
    }
    
    // ИЩЕМ БРОКЕРА И СЧЁТ
    const broker = portfolio.brokers.find(b => b.id === currentBrokerId);
    if (broker) {
        const account = broker.accounts.find(a => a.id === currentAccountId);
        if (account) {
            account.assets.push({
                id: Date.now().toString(),
                ticker: ticker,
                name: name,
                quantity: quantity,
                price: price,
                lotsize: lotsize,
                assetType: window.lastAssetType || 'stock'
            });
            showNotification(`➕ ${name} (${ticker}) добавлен, ${quantity} шт. по ${price.toFixed(2)} ₽`, '#10b981');
        } else {
            showNotification('❌ Счёт не найден', '#ef4444');
            return;
        }
    } else {
        showNotification('❌ Брокер не найден', '#ef4444');
        return;
    }
    
    // Очистка
    document.getElementById('assetTicker').value = '';
    document.getElementById('assetName').value = '';
    document.getElementById('assetQuantity').value = '';
    document.getElementById('assetPrice').value = '';
    document.getElementById('assetLotsize').value = '';
    document.getElementById('tickerSuggestions').style.display = 'none';
    document.getElementById('modalAsset').style.display = 'none';
    render();
}

function updateQuantity(brokerId, accountId, assetId, delta) {
    // Только меняем значение в input, НЕ сохраняем
    const input = document.getElementById(`qty_input_${assetId}`);
    if (input) {
        let currentVal = parseFloat(input.value);
        if (isNaN(currentVal)) currentVal = 0;
        let newVal = currentVal + delta;
        if (newVal < 0) newVal = 0;
        input.value = newVal;
    }
}

// Определение типа бумаги по тикеру (простое правило)
function getAssetTypeIcon(type) {
    if(type === "stock"){return '📊'}
    if(type === "облигация"){return '📜'}
    return '📈';
}

// Показать модалку изменения количества актива
function editAssetQuantity(brokerId, accountId, assetId) {
    closeAllMenus();
    
    const broker = portfolio.brokers.find(b => b.id === brokerId);
    if (broker) {
        const account = broker.accounts.find(a => a.id === accountId);
        if (account) {
            const asset = account.assets.find(a => a.id === assetId);
            if (asset) {
                const newQuantity = prompt(`Изменить количество ${asset.name} (${asset.ticker}):\nТекущее: ${asset.quantity} шт.`, asset.quantity);
                if (newQuantity !== null && !isNaN(parseFloat(newQuantity)) && parseFloat(newQuantity) >= 0) {
                    if (parseFloat(newQuantity) === 0) {
                        showConfirmModal('🗑️ Удалить актив?', `Удалить ${asset.name}?`, () => {
                            account.assets = account.assets.filter(a => a.id !== assetId);
                            render();
                            showNotification(`🗑️ ${asset.name} удалён`, '#ef4444');
                            hideConfirmModal();
                        });
                    } else {
                        asset.quantity = parseFloat(newQuantity);
                        render();
                        showNotification(`✏️ ${asset.name}: количество изменено на ${asset.quantity}`, '#667eea');
                    }
                }
            }
        }
    }
}

// Переключение меню
function toggleMenu(menuId) {
    closeAllMenus();
    const menu = document.getElementById(menuId);
    if (menu) {
        menu.classList.add('show');
        event.stopPropagation();
    }
}


// ========== РЕНДЕР ==========
function render() {
    const totalCapital = calculateTotalCapital();
    document.getElementById('totalCapital').innerText = totalCapital.toLocaleString() + ' ₽';
    
    const container = document.getElementById('brokersContainer');
    container.innerHTML = '';
    
    // === БЛОК БРОКЕРОВ ===
    container.innerHTML += '<h2 style="margin: 20px 0 10px 0;">📈 Брокерские счета</h2>';
    
    portfolio.brokers.forEach(broker => {
        const brokerDiv = document.createElement('div');
        brokerDiv.className = 'broker-card';
        
        let brokerTotal = 0;
        broker.accounts.forEach(acc => {
            brokerTotal += acc.balance + acc.assets.reduce((s, a) => s + a.quantity * a.price, 0);
        });
        
        brokerDiv.innerHTML = `
<div class="broker-header">
    <span class="broker-title">🏦 ${escapeHtml(broker.name)} <span style="font-size:14px; color:#64748b">(${brokerTotal.toLocaleString()} ₽)</span></span>
    <div class="menu-container">
        <button class="menu-btn" onclick="event.stopPropagation(); toggleMenu('broker_menu_${broker.id}')">⋮</button>
        <div id="broker_menu_${broker.id}" class="dropdown-menu">
            <button class="delete-btn" onclick="deleteBroker('${broker.id}')">🗑️ Удалить брокера</button>
        </div>
    </div>
</div>
            <div id="accounts-${broker.id}"></div>
            <button class="btn-add-account" onclick="showModal('Account','${broker.id}')">➕ Добавить счёт</button>
        `;
        
        const accountsContainer = brokerDiv.querySelector(`#accounts-${broker.id}`);
        broker.accounts.forEach(account => {
            const accountTotal = account.balance + account.assets.reduce((s, a) => s + a.quantity * a.price, 0);
            
            const accountDiv = document.createElement('div');
            accountDiv.className = 'account-card';
            accountDiv.innerHTML = `
<div class="account-header">
    <div>
        <span class="account-title">📁 ${escapeHtml(account.name)}</span>
        <span class="account-type type-broker">📈 Брокерский</span>
    </div>
    <div class="menu-container">
        <button class="menu-btn" onclick="event.stopPropagation(); toggleMenu('account_menu_${account.id}')">⋮</button>
        <div id="account_menu_${account.id}" class="dropdown-menu">
            <button onclick="showModal('Balance', '${broker.id}', '${account.id}')">💰 Изменить баланс</button>
            <button onclick="showModal('Asset', '${broker.id}', '${account.id}')">➕ Добавить актив</button>
            <button class="delete-btn" onclick="deleteAccount('broker', '${broker.id}', '${account.id}')">🗑️ Удалить счёт</button>
        </div>
    </div>
</div>
                <div class="account-balance-row">
                    <div class="account-balance">💰 ${accountTotal.toLocaleString()} ₽</div>
                    <div class="account-actions">
                        <button class="btn-icon" onclick="showModal('Balance', '${broker.id}', '${account.id}')">💰 Остаток рублей: ${account.balance.toLocaleString()} ₽</button>
                        <button class="btn-icon" onclick="showModal('Asset', '${broker.id}', '${account.id}')">➕ Актив</button>
                    </div>
                </div>
            `;
            
            if (account.assets.length > 0) {
                const assetsDiv = document.createElement('div');
                assetsDiv.className = 'assets-section';
                assetsDiv.innerHTML = '<div class="assets-title">📋 Активы:</div>';
account.assets.forEach(asset => {
    const total = asset.quantity * asset.price;
    const menuId = `menu_${asset.id}`;
    const controlsId = `controls_${asset.id}`;
    const staticId = `static_${asset.id}`;
    
    assetsDiv.innerHTML += `
        <div class="asset-item" id="asset_${asset.id}">
            <div class="asset-info">
                <div class="asset-name">
                    ${getAssetTypeIcon(asset.assetType)} ${escapeHtml(asset.name)}
                </div>
                <div class="asset-ticker">${asset.ticker}</div>
            </div>
            <div class="asset-quantity">
                <div id="${staticId}" class="quantity-static">
                    <span>${asset.quantity}</span>
                    ${asset.lotsize && asset.lotsize > 1 ? `<span class="lots-hint">(лот: ${asset.quantity / asset.lotsize})</span>` : ''}
                </div>
                <div id="${controlsId}" class="quantity-controls">
                    <button class="qty-minus" onclick="updateQuantity('${broker.id}', '${account.id}', '${asset.id}', -${asset.lotsize || 1})">-${asset.lotsize || 1}</button>
                    <input type="number" id="qty_input_${asset.id}" class="qty-input" value="${asset.quantity}" step="${asset.lotsize || 1}">
                    <button class="qty-plus" onclick="updateQuantity('${broker.id}', '${account.id}', '${asset.id}', ${asset.lotsize || 1})">+${asset.lotsize || 1}</button>
                    <button class="edit-mode-btn" onclick="exitEditMode('${asset.id}', '${broker.id}', '${account.id}', '${asset.id}')">✅ Готово</button>
                </div>
            </div>
            <div class="asset-price">${asset.price.toLocaleString()} ₽</div>
            <div class="asset-total">${total.toLocaleString()} ₽</div>
            <div class="menu-container">
                <button class="menu-btn" onclick="event.stopPropagation(); toggleMenu('${menuId}')">⋮</button>
                <div id="${menuId}" class="dropdown-menu">
                    <button onclick="refreshSinglePrice('${broker.id}', '${account.id}', '${asset.id}')">🔄 Обновить цену</button>
                    <button onclick="enterEditMode('${asset.id}')">✏️ Изменить количество</button>
                    <button class="delete-btn" onclick="deleteAsset('${broker.id}', '${account.id}', '${asset.id}')">🗑️ Удалить</button>
                </div>
            </div>
        </div>
    `;
});
                accountDiv.appendChild(assetsDiv);
            }
            accountsContainer.appendChild(accountDiv);
        });
        
        container.appendChild(brokerDiv);
    });
    
// === БЛОК БАНКОВ ===
container.innerHTML += '<h2 style="margin: 30px 0 10px 0;">🏦 Банковские счета</h2>';

portfolio.banks.forEach(bank => {
    const bankDiv = document.createElement('div');
    bankDiv.className = 'broker-card';
    
    let bankTotal = 0;
    let bankDebt = 0;
    let bankPotentialIncome = 0;
    
    bank.accounts.forEach(acc => {
        bankTotal += acc.balance;
        if (acc.type === 'credit' && acc.balance < 0) {
            bankDebt += Math.abs(acc.balance);
        }
        if (acc.interestRate) {
            bankPotentialIncome += calculateBankInterest(acc);
        }
    });
    
    bankDiv.innerHTML = `
        <div class="broker-header">
            <span class="broker-title">🏛️ ${escapeHtml(bank.name)} 
                <span style="font-size:14px; color:#64748b">(${bankTotal.toLocaleString()} ₽)</span>
                ${bankDebt > 0 ? `<span style="font-size:12px; color:#ef4444; margin-left:10px;">🔴 Долг: ${bankDebt.toLocaleString()} ₽</span>` : ''}
                ${bankPotentialIncome > 0 ? `<span style="font-size:12px; color:#10b981; margin-left:10px;">📈 Доход в месяц: ~${bankPotentialIncome.toLocaleString()} ₽</span>` : ''}
            </span>
            <div class="menu-container">
                <button class="menu-btn" onclick="event.stopPropagation(); toggleMenu('bank_menu_${bank.id}')">⋮</button>
                <div id="bank_menu_${bank.id}" class="dropdown-menu">
                    <button class="delete-btn" onclick="deleteBank('${bank.id}')">🗑️ Удалить банк</button>
                </div>
            </div>
        </div>
        <div id="bank-accounts-${bank.id}"></div>
        <button class="btn-add-account" onclick="showAddBankAccountModal('${bank.id}')">➕ Добавить счёт</button>
    `;
    
    const accountsContainer = bankDiv.querySelector(`#bank-accounts-${bank.id}`);
    bank.accounts.forEach(account => {
        const icon = getBankAccountIcon(account.type);
        const typeName = getBankAccountTypeName(account.type);
        const monthlyIncome = calculateBankInterest(account);
        const balanceColor = account.type === 'credit' && account.balance < 0 ? '#ef4444' : '#059669';
        
        const accountDiv = document.createElement('div');
        accountDiv.className = 'account-card';
        accountDiv.innerHTML = `
            <div class="account-header">
                <div>
                    <span class="account-title">${icon} ${escapeHtml(account.name)}</span>
                    <span class="account-type type-bank">${typeName}</span>
                </div>
                <div class="menu-container">
                    <button class="menu-btn" onclick="event.stopPropagation(); toggleMenu('bank_account_menu_${account.id}')">⋮</button>
                    <div id="bank_account_menu_${account.id}" class="dropdown-menu">
                        <button onclick="editBankAccount('${bank.id}', '${account.id}')">✏️ Редактировать</button>
                        <button onclick="showBankBalanceModal('${bank.id}', '${account.id}')">💰 Изменить баланс</button>
                        <button class="delete-btn" onclick="deleteAccount('bank', '${bank.id}', '${account.id}')">🗑️ Удалить счёт</button>
                    </div>
                </div>
            </div>
            <div class="account-balance-row">
                <div class="account-balance" style="color: ${balanceColor};">💰 ${account.balance.toLocaleString()} ₽</div>
                <div class="account-actions">
                    ${account.interestRate ? `<span style="font-size:12px; background:#e2e8f0; padding:4px 8px; border-radius:12px;">📊 ${account.interestRate}%</span>` : ''}
                    ${monthlyIncome > 0 ? `<span style="font-size:12px; background:#dcfce7; padding:4px 8px; border-radius:12px;">💹 +${monthlyIncome.toFixed(2)} ₽/мес</span>` : ''}
                </div>
            </div>
            ${account.creditLimit ? `<div style="font-size:12px; color:#64748b;">💳 Кредитный лимит: ${account.creditLimit.toLocaleString()} ₽</div>` : ''}
        `;
        accountsContainer.appendChild(accountDiv);
    });
    
    container.appendChild(bankDiv);
});
    
    // Кнопка добавления банка
    const addBankBtn = document.createElement('button');
    addBankBtn.className = 'btn-add-broker';
    addBankBtn.innerHTML = '➕ Добавить банк';
    addBankBtn.onclick = () => showAddBankModal();
    container.appendChild(addBankBtn);
}

function showAddBankModal() {
    document.getElementById('modalBank').style.display = 'block';
}

function confirmAddBank() {
    const name = document.getElementById('bankName').value.trim();
    if (!name) return;
    portfolio.banks.push({
        id: Date.now().toString(),
        name: name,
        accounts: []
    });
    document.getElementById('bankName').value = '';
    document.getElementById('modalBank').style.display = 'none';
    render();
    showNotification(`🏛️ Банк "${name}" добавлен`, '#667eea');
}

function showAddBankAccountModal(bankId) {
    currentBankId = bankId;
    document.getElementById('modalBankAccount').style.display = 'block';
}

function confirmAddBankAccount() {
    const name = document.getElementById('bankAccountName').value.trim();
    const balance = parseFloat(document.getElementById('bankAccountBalance').value) || 0;
    if (!name) return;
    const bank = portfolio.banks.find(b => b.id === currentBankId);
    if (bank) {
        bank.accounts.push({
            id: Date.now().toString(),
            name: name,
            balance: balance
        });
    }
    document.getElementById('bankAccountName').value = '';
    document.getElementById('bankAccountBalance').value = '';
    document.getElementById('modalBankAccount').style.display = 'none';
    render();
    showNotification(`📁 Счёт "${name}" добавлен`, '#667eea');
}

function showBankBalanceModal(bankId, accountId) {
    currentBankId = bankId;
    currentBankAccountId = accountId;
    document.getElementById('modalBankBalance').style.display = 'block';
}

// Войти в режим редактирования количества
function enterEditMode(assetId) {
    const controls = document.getElementById(`controls_${assetId}`);
    const static = document.getElementById(`static_${assetId}`);
    
    if (controls) controls.classList.add('active');
    if (static) static.classList.add('hide');
    closeAllMenus();
}

// Выйти из режима редактирования
function exitEditMode(assetId, brokerId, accountId, assetIdFull) {
    const controls = document.getElementById(`controls_${assetId}`);
    const static = document.getElementById(`static_${assetId}`);
    
    // Сохраняем текущее значение из input
    const input = document.getElementById(`qty_input_${assetId}`);
    if (input) {
        const newValue = parseFloat(input.value);
        if (!isNaN(newValue) && newValue >= 0) {
            const broker = portfolio.brokers.find(b => b.id === brokerId);
            if (broker) {
                const account = broker.accounts.find(a => a.id === accountId);
                if (account) {
                    const asset = account.assets.find(a => a.id === assetIdFull);
                    if (asset) {
                        if (newValue === 0) {
                            showConfirmModal('🗑️ Удалить актив?', `Удалить ${asset.name}?`, () => {
                                account.assets = account.assets.filter(a => a.id !== assetIdFull);
                                render();
                                showNotification(`🗑️ ${asset.name} удалён`, '#ef4444');
                                hideConfirmModal();
                            });
                        } else {
                            asset.quantity = newValue;
                            render();
                            showNotification(`✏️ Количество изменено на ${newValue}`, '#667eea');
                        }
                    }
                }
            }
        }
    }
    
    if (controls) controls.classList.remove('active');
    if (static) static.classList.remove('hide');
}

// // Обновлённая функция updateQuantity (оставляем как была, но с выходом из режима)
// function updateQuantity(brokerId, accountId, assetId, delta) {
//     const broker = portfolio.brokers.find(b => b.id === brokerId);
//     if (broker) {
//         const account = broker.accounts.find(a => a.id === accountId);
//         if (account) {
//             const asset = account.assets.find(a => a.id === assetId);
//             if (asset) {
//                 const newQ = asset.quantity + delta;
//                 if (newQ >= 0) {
//                     if (newQ === 0) {
//                         showConfirmModal('🗑️ Удалить актив?', `Удалить ${asset.name}?`, () => {
//                             account.assets = account.assets.filter(a => a.id !== assetId);
//                             render();
//                             showNotification(`🗑️ ${asset.name} удалён`, '#ef4444');
//                             hideConfirmModal();
//                         });
//                     } else {
//                         asset.quantity = newQ;
//                         render();
//                         // Автоматически выходим из режима редактирования
//                         const input = document.getElementById(`qty_input_${assetId}`);
//                         if (input) {
//                             const controls = document.getElementById(`controls_${assetId}`);
//                             const static = document.getElementById(`static_${assetId}`);
//                             if (controls) controls.classList.remove('active');
//                             if (static) static.classList.remove('hide');
//                         }
//                     }
//                 }
//             }
//         }
//     }
// }

function confirmBankBalance() {
    const amount = parseFloat(document.getElementById('bankBalanceAmount').value);
    if (isNaN(amount)) return;
    const bank = portfolio.banks.find(b => b.id === currentBankId);
    if (bank) {
        const account = bank.accounts.find(a => a.id === currentBankAccountId);
        if (account) {
            account.balance = amount;
            showNotification(`💰 Баланс изменён: ${amount.toLocaleString()} ₽`, '#10b981');
        }
    }
    document.getElementById('bankBalanceAmount').value = '';
    document.getElementById('modalBankBalance').style.display = 'none';
    render();
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function deleteAsset(brokerId, accountId, assetId) {
    const broker = portfolio.brokers.find(b => b.id === brokerId);
    if (broker) {
        const account = broker.accounts.find(a => a.id === accountId);
        if (account) {
            const asset = account.assets.find(a => a.id === assetId);
            if (asset) {
                showConfirmModal(
                    '🗑️ Удалить актив?',
                    `Вы действительно хотите удалить актив<br><strong>${escapeHtml(asset.name)} (${asset.ticker})</strong>?`,
                    () => {
                        account.assets = account.assets.filter(a => a.id !== assetId);
                        render();
                        showNotification(`🗑️ ${asset.name} удалён`, '#ef4444');
                        hideConfirmModal();
                    }
                );
            }
        }
    }
}

// Показать модалку подтверждения
function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMessage').innerHTML = message;
    pendingDeleteAction = onConfirm;
    document.getElementById('modalConfirm').style.display = 'block';
}

// Скрыть модалку
function hideConfirmModal() {
    document.getElementById('modalConfirm').style.display = 'none';
    pendingDeleteAction = null;
}

async function getMoexLotsize(ticker) {
    try {
        const url = `https://iss.moex.com/iss/engines/stock/markets/shares/boards/tqbr/securities/${ticker}.json`;
        const response = await fetch(url);
        const data = await response.json();
        // Ищем поле LOTSIZE в данных
        if (data.securities?.data?.length > 0) {
            const headers = data.securities.columns;
            const row = data.securities.data[0];
            const lotsizeIndex = headers.findIndex(h => h === 'LOTSIZE');
            if (lotsizeIndex !== -1 && row[lotsizeIndex]) {
                return parseInt(row[lotsizeIndex]);
            }
        }
        return 1;
    } catch(e) {
        return 1;
    }
}

// Загрузка всех тикеров (акции + облигации + фонды)
async function loadAllTickers() {
    const all = [];
    const uniqueTickers = new Map();
    
    // 1. ЗАГРУЖАЕМ АКЦИИ И ФОНДЫ (через общий список)
    console.log('🔄 Загрузка акций и фондов...');
    const sharesUrl = 'https://iss.moex.com/iss/engines/stock/markets/shares/securities.json?limit=5000';
    
    try {
        const response = await fetch(sharesUrl);
        const data = await response.json();
        
        if (data.securities?.data) {
            const headers = data.securities.columns;
            const tickerIndex = headers.findIndex(h => h === 'SECID');
            const nameIndex = headers.findIndex(h => h === 'SHORTNAME');
            const typeNameIndex = headers.findIndex(h => h === 'TYPENAME');
            
            for (const row of data.securities.data) {
                const ticker = row[tickerIndex];
                if (!ticker || ticker.includes('.')) continue;
                
                const typeName = typeNameIndex !== -1 ? row[typeNameIndex] : '';
                const name = row[nameIndex] || ticker;
                
                // Определяем тип
                let type = '📈 Акция';
                if (typeName === 'ETF' || typeName === 'ETP' || typeName === 'ПИФ' || typeName === 'БПИФ') {
                    type = '📊 Фонд (ETF/БПИФ)';
                }
                
                if (!uniqueTickers.has(ticker)) {
                    uniqueTickers.set(ticker, { ticker, name, type });
                }
            }
            
            console.log(`✅ Загружено акций и фондов: ${uniqueTickers.size}`);
        }
    } catch(e) {
        console.warn('Ошибка загрузки акций/фондов:', e);
    }
    
    // 2. ЗАГРУЖАЕМ ОБЛИГАЦИИ КАК БЫЛО (ОТДЕЛЬНЫЕ ЗАПРОСЫ)
    console.log('🔄 Загрузка облигаций...');
    
    const bondsCategories = [
        { type: '📜 Облигация (корпоративные)', url: 'https://iss.moex.com/iss/engines/stock/markets/bonds/boards/tqcb/securities.json?limit=2000' },
        { type: '📜 Облигация (ОФЗ и другие)', url: 'https://iss.moex.com/iss/engines/stock/markets/bonds/boards/tqob/securities.json?limit=2000' }
    ];
    
    for (let cat of bondsCategories) {
        try {
            const response = await fetch(cat.url);
            const data = await response.json();
            
            if (data.securities?.data) {
                const headers = data.securities.columns;
                const tickerIndex = headers.findIndex(h => h === 'SECID');
                const nameIndex = headers.findIndex(h => h === 'SHORTNAME');
                
                const bonds = data.securities.data
                    .filter(row => row[tickerIndex] && !row[tickerIndex].includes('.'))
                    .map(row => ({
                        ticker: row[tickerIndex],
                        name: (row[nameIndex] || row[tickerIndex]),
                        type: cat.type
                    }));
                
                // Добавляем уникальные облигации
                let addedCount = 0;
                for (const bond of bonds) {
                    if (!uniqueTickers.has(bond.ticker)) {
                        uniqueTickers.set(bond.ticker, bond);
                        addedCount++;
                    }
                }
                console.log(`✅ ${cat.type}: загружено ${bonds.length}, добавлено ${addedCount}`);
            }
        } catch(e) {
            console.warn(`Не загружены ${cat.type}:`, e);
        }
    }

     // 3. ЗАГРУЖАЕМ ВАЛЮТЫ
    console.log('🔄 Загрузка валют...');
    
    try {
        // Валюты торгуются на рынке currency
        const currencyUrl = 'https://iss.moex.com/iss/engines/currency/markets/selt/securities.json?limit=100';
        const response = await fetch(currencyUrl);
        const data = await response.json();
        
        if (data.securities?.data) {
            const headers = data.securities.columns;
            const tickerIndex = headers.findIndex(h => h === 'SECID');
            const nameIndex = headers.findIndex(h => h === 'SHORTNAME');
            
            // Популярные валютные пары для торговли
            const popularCurrencies = ['USD000UTSTOM', 'EUR000UTSTOM', 'CNY000UTSTOM', 'GBP000UTSTOM', 'CHF000UTSTOM', 'TRY000UTSTOM', 'KZT000UTSTOM', 'BYN000UTSTOM'];
            
            const currencies = data.securities.data
                .filter(row => {
                    const ticker = row[tickerIndex];
                    if (!ticker || ticker.includes('.')) return false;
                    // Оставляем только популярные валюты или все, если нужно
                    return popularCurrencies.includes(ticker) || ticker.includes('UTSTOM');
                })
                .map(row => {
                    const ticker = row[tickerIndex];
                    const name = row[nameIndex] || ticker;
                    
                    // Красивое название для отображения
                    let displayName = name;
                    if (ticker === 'USD000UTSTOM') displayName = 'USD/RUB';
                    else if (ticker === 'EUR000UTSTOM') displayName = 'EUR/RUB';
                    else if (ticker === 'CNY000UTSTOM') displayName = 'CNY/RUB';
                    else if (ticker === 'GBP000UTSTOM') displayName = 'GBP/RUB';
                    else if (ticker === 'CHF000UTSTOM') displayName = 'CHF/RUB';
                    else if (ticker === 'TRY000UTSTOM') displayName = 'TRY/RUB';
                    else if (ticker === 'KZT000UTSTOM') displayName = 'KZT/RUB';
                    else if (ticker === 'BYN000UTSTOM') displayName = 'BYN/RUB';
                    
                    return {
                        ticker: ticker,
                        name: displayName,
                        type: '💱 Валюта'
                    };
                });
            
            let addedCount = 0;
            for (const currency of currencies) {
                if (!uniqueTickers.has(currency.ticker)) {
                    uniqueTickers.set(currency.ticker, currency);
                    addedCount++;
                }
            }
            console.log(`✅ Валюты: загружено ${currencies.length}, добавлено ${addedCount}`);
        }
    } catch(e) {
        console.warn('Ошибка загрузки валют:', e);
    }
    
    // Преобразуем Map в массив
    for (const item of uniqueTickers.values()) {
        all.push(item);
    }
    
    // Итоговая статистика
    const stocksCount = all.filter(t => t.type === '📈 Акция').length;
    const bondsCount = all.filter(t => t.type.includes('📜 Облигация')).length;
    const fundsCount = all.filter(t => t.type === '📊 Фонд (ETF/БПИФ)').length;
    
    console.log('\n📊 ИТОГО:');
    console.log(`📈 Акции: ${stocksCount}`);
    console.log(`📜 Облигации: ${bondsCount}`);
    console.log(`✅ Всего тикеров: ${all.length}`);
    
    allTickers = all;
    return all;
}

// Поиск тикеров по вводу
function searchTickers(query) {
    if (!query || query.length < 1) return [];
    const upperQuery = query.toUpperCase();
    return allTickers.filter(t => t.ticker.startsWith(upperQuery)).slice(0, 20);
}

// Отображение выпадающего списка
function showSuggestions(suggestions) {
    const container = document.getElementById('tickerSuggestions');
    if (!suggestions.length) {
        container.style.display = 'none';
        return;
    }
    currentSuggestions = suggestions;
container.innerHTML = suggestions.map((s, i) => `
    <div class="suggestion-item" data-index="${i}" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #e2e8f0;">
        <strong>${s.ticker}</strong> 
        <span style="font-size: 11px; background: #e2e8f0; padding: 2px 6px; border-radius: 12px; margin-left: 8px;">${s.type || '📈'}</span>
        <br><small style="color: #64748b;">${s.name}</small>
    </div>
`).join('');
    container.style.display = 'block';
    
    // Добавляем обработчики кликов
    document.querySelectorAll('.suggestion-item').forEach(el => {
        el.onclick = () => {
            const idx = parseInt(el.dataset.index);
            selectTicker(currentSuggestions[idx]);
        };
    });
}

// Выбор тикера и загрузка данных
async function selectTicker(tickerData) {
    document.getElementById('assetTicker').value = tickerData.ticker;
    document.getElementById('assetName').value = tickerData.name;
    document.getElementById('tickerSuggestions').style.display = 'none';
    
    // Подтягиваем цену и лотность
    await loadAssetDetails(tickerData.ticker);
}

async function loadAssetDetails(ticker) {
    // Определяем тип актива по тикеру
    const isBond = ticker.match(/^[A-Z]{2}\d{6}[A-Z]{2}$|^SU\d{6}[A-Z]{0,2}$|^ОФЗ/i);
    const isEtf = ticker.match(/^FX|^SB|^TR|^TM|^AK/i);
    const isCurrency = ticker.includes('UTSTOM') || ticker.match(/^USD|^EUR|^CNY|^GBP|^CHF|^TRY|^KZT|^BYN/);
    
    let url = '';
    
    // Выбираем правильный эндпоинт
    if (isBond) {
        // Облигации грузим с рынка bonds
        url = `https://iss.moex.com/iss/engines/stock/markets/bonds/securities/${ticker}.json`;
    } else if (isCurrency) {
        // Валюты грузим с рынка currency
        url = `https://iss.moex.com/iss/engines/currency/markets/selt/securities/${ticker}.json`;
    } else {
        // Акции и фонды с рынка shares
        url = `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${ticker}.json`;
    }
    
    try {
        console.log(`🔍 Загружаем данные для ${ticker}...`);
        const response = await fetch(url);
        const data = await response.json();
        
        let price = null;
        let shortName = null;
        let lotsize = 1;
        
        // ========== ПРАВИЛЬНОЕ ПОЛУЧЕНИЕ ЦЕНЫ ==========
        if (data.marketdata?.data?.length > 0) {
            const headers = data.marketdata.columns;
            const row = data.marketdata.data[0];
            
            // Пробуем разные поля в правильном порядке
            const priceFields = ['LAST', 'CURRENTPRICE', 'CLOSE', 'WAPRICE', 'OPEN'];
            
            for (const field of priceFields) {
                const idx = headers.findIndex(h => h === field);
                if (idx !== -1 && row[idx] && !isNaN(parseFloat(row[idx]))) {
                    price = parseFloat(row[idx]);
                    console.log(`✅ Нашли цену в поле ${field}: ${price}`);
                    break;
                }
            }
            
            // Для валют отдельная проверка (часто цена в поле 'LAST' или 'SETTLEMENTPRICE')
            if (isCurrency && !price) {
                const settleIdx = headers.findIndex(h => h === 'SETTLEMENTPRICE');
                if (settleIdx !== -1 && row[settleIdx] && !isNaN(parseFloat(row[settleIdx]))) {
                    price = parseFloat(row[settleIdx]);
                    console.log(`✅ Нашли цену валюты в SETTLEMENTPRICE: ${price}`);
                }
            }
            
            // Если цена не найдена, пробуем PREVPRICE (предыдущее закрытие)
            if (!price) {
                const prevIdx = headers.findIndex(h => h === 'PREVPRICE');
                if (prevIdx !== -1 && row[prevIdx] && !isNaN(parseFloat(row[prevIdx]))) {
                    price = parseFloat(row[prevIdx]);
                    console.log(`✅ Используем PREVPRICE: ${price}`);
                }
            }
        }
        
        // Если цена не найдена в marketdata, пробуем из securities
        if (!price && data.securities?.data?.length > 0) {
            const headers = data.securities.columns;
            const row = data.securities.data[0];
            
            // Пробуем PREVADMITTEDQUOTE или PREVPRICE
            const prevIdx = headers.findIndex(h => h === 'PREVADMITTEDQUOTE');
            const prevPriceIdx = headers.findIndex(h => h === 'PREVPRICE');
            
            if (prevIdx !== -1 && row[prevIdx] && !isNaN(parseFloat(row[prevIdx]))) {
                price = parseFloat(row[prevIdx]);
                console.log(`✅ Нашли цену в securities.PREVADMITTEDQUOTE: ${price}`);
            } else if (prevPriceIdx !== -1 && row[prevPriceIdx] && !isNaN(parseFloat(row[prevPriceIdx]))) {
                price = parseFloat(row[prevPriceIdx]);
                console.log(`✅ Нашли цену в securities.PREVPRICE: ${price}`);
            }
        }
        
        // ========== ПОЛУЧАЕМ НАЗВАНИЕ ==========
        if (data.description?.data?.length > 0) {
            const headers = data.description.columns;
            const row = data.description.data[0];
            const nameIdx = headers.findIndex(h => h === 'SHORTNAME');
            const fullNameIdx = headers.findIndex(h => h === 'NAME');
            
            if (nameIdx !== -1 && row[nameIdx]) {
                shortName = row[nameIdx];
            } else if (fullNameIdx !== -1 && row[fullNameIdx]) {
                shortName = row[fullNameIdx];
            }
        } else if (data.securities?.data?.length > 0) {
            const headers = data.securities.columns;
            const row = data.securities.data[0];
            const shortNameIdx = headers.findIndex(h => h === 'SHORTNAME');
            
            if (shortNameIdx !== -1 && row[shortNameIdx]) {
                shortName = row[shortNameIdx];
            }
        }
        
        // Для валют делаем красивое название, если не нашли
        if (isCurrency && !shortName) {
            if (ticker === 'USD000UTSTOM') shortName = 'USD/RUB';
            else if (ticker === 'EUR000UTSTOM') shortName = 'EUR/RUB';
            else if (ticker === 'CNY000UTSTOM') shortName = 'CNY/RUB';
            else if (ticker === 'GBP000UTSTOM') shortName = 'GBP/RUB';
            else if (ticker === 'CHF000UTSTOM') shortName = 'CHF/RUB';
            else if (ticker === 'TRY000UTSTOM') shortName = 'TRY/RUB';
            else if (ticker === 'KZT000UTSTOM') shortName = 'KZT/RUB';
            else if (ticker === 'BYN000UTSTOM') shortName = 'BYN/RUB';
            else shortName = ticker.replace('000UTSTOM', '/RUB');
        }
        
        // ========== ПОЛУЧАЕМ ЛОТНОСТЬ ==========
        if (data.securities?.data?.length > 0) {
            const headers = data.securities.columns;
            const row = data.securities.data[0];
            const lotsizeIdx = headers.findIndex(h => h === 'LOTSIZE');
            const faceValueIdx = headers.findIndex(h => h === 'FACEVALUE'); // для облигаций
            
            if (lotsizeIdx !== -1 && row[lotsizeIdx]) {
                lotsize = parseInt(row[lotsizeIdx]);
            }
            
            // Для валют лотность обычно 1
            if (isCurrency && lotsize === 1) {
                // У валют лотность может быть 1000, но оставляем как есть
                console.log(`💰 Лотность валюты: ${lotsize}`);
            }
            
            // Для облигаций номинал может быть нужен
            if (isBond && faceValueIdx !== -1 && row[faceValueIdx]) {
                const faceValue = parseFloat(row[faceValueIdx]);
                if (faceValue && !price) {
                    price = faceValue; // Если нет цены, используем номинал
                    console.log(`✅ Используем номинал облигации: ${price}`);
                }
            }
            
            if (lotsize < 1) lotsize = 1;
        }
        
        // Для валют, если цена всё ещё не найдена, пробуем отдельный запрос к orderbook
        if (isCurrency && !price) {
            try {
                const orderbookUrl = `https://iss.moex.com/iss/engines/currency/markets/selt/securities/${ticker}/orderbook.json`;
                const obResponse = await fetch(orderbookUrl);
                const obData = await obResponse.json();
                
                if (obData.orderbook?.data?.length > 0) {
                    const headers = obData.orderbook.columns;
                    const row = obData.orderbook.data[0];
                    const lastIdx = headers.findIndex(h => h === 'LAST');
                    const bidIdx = headers.findIndex(h => h === 'BID');
                    const askIdx = headers.findIndex(h => h === 'OFFER');
                    
                    if (lastIdx !== -1 && row[lastIdx]) {
                        price = parseFloat(row[lastIdx]);
                        console.log(`✅ Нашли цену валюты в orderbook.LAST: ${price}`);
                    } else if (bidIdx !== -1 && row[bidIdx]) {
                        price = parseFloat(row[bidIdx]);
                        console.log(`✅ Нашли цену валюты в orderbook.BID: ${price}`);
                    } else if (askIdx !== -1 && row[askIdx]) {
                        price = parseFloat(row[askIdx]);
                        console.log(`✅ Нашли цену валюты в orderbook.OFFER: ${price}`);
                    }
                }
            } catch(obErr) {
                console.warn('Не удалось загрузить orderbook для валюты:', obErr);
            }
        }
        
        // Обновляем форму
        if (price && price > 0) {
            document.getElementById('assetPrice').value = price.toFixed(4); // Для валют 4 знака
            document.getElementById('assetName').value = shortName || ticker;
            document.getElementById('assetLotsize').value = lotsize;
            console.log(`✅ Загружено: ${ticker} | Цена: ${price} | Лотность: ${lotsize}`);
        } else {
            throw new Error('Цена не найдена');
        }
        
    } catch(e) {
        console.warn(`⚠️ Ошибка загрузки ${ticker}:`, e);
        document.getElementById('assetPrice').value = '';
        document.getElementById('assetLotsize').value = '1';
        document.getElementById('assetName').value = ticker;
        showNotification(`❌ Не удалось получить цену для ${ticker}. Введите вручную.`, '#f59e0b', 4000);
    }
}
// Показать модалку добавления банка
function showAddBankModal() {
    document.getElementById('modalBank').style.display = 'block';
}

// Подтверждение добавления банка
function confirmAddBank() {
    const name = document.getElementById('bankName').value.trim();
    if (!name) {
        showNotification('❌ Введите название банка', '#ef4444');
        return;
    }
    
    portfolio.banks.push({
        id: Date.now().toString(),
        name: name,
        accounts: []
    });
    
    document.getElementById('bankName').value = '';
    document.getElementById('modalBank').style.display = 'none';
    render();
    showNotification(`🏛️ Банк "${name}" добавлен`, '#10b981');
}

// Подтверждение изменения баланса банка
function confirmBankBalance() {
    const amount = parseFloat(document.getElementById('bankBalanceAmount').value);
    if (isNaN(amount)) return;
    
    const bank = portfolio.banks.find(b => b.id === currentBankId);
    if (bank) {
        const account = bank.accounts.find(a => a.id === currentBankAccountId);
        if (account) {
            account.balance = amount;
            showNotification(`💰 Баланс изменён: ${amount.toLocaleString()} ₽`, '#10b981');
        }
    }
    
    document.getElementById('bankBalanceAmount').value = '';
    document.getElementById('modalBankBalance').style.display = 'none';
    render();
}

// Загрузка из JSON файла
function loadFromFile() {
    // Создаём скрытый input для выбора файла
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const loadedData = JSON.parse(event.target.result);
                
                // Проверяем структуру
                if (!loadedData.brokers) loadedData.brokers = [];
                if (!loadedData.banks) loadedData.banks = [];
                
                portfolio = loadedData;
                render();
                showNotification('✅ Портфель загружен из файла!', '#10b981');
            } catch (error) {
                showNotification('❌ Ошибка при загрузке файла. Неверный формат JSON', '#ef4444');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

// Закрыть все открытые меню
function closeAllMenus() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
    });
}

// Клик вне меню закрывает его
document.addEventListener('click', function(e) {
    if (!e.target.closest('.menu-container')) {
        closeAllMenus();
    }
});

// ========== ИНИЦИАЛИЗАЦИЯ ==========
window.onload = async () => {
    await loadData();
    await loadAllTickers();
    
    
    document.getElementById('saveBtn').onclick = saveData;
    document.getElementById('refreshPricesBtn').onclick = refreshAllPrices;
    document.getElementById('addBrokerBtn').onclick = addBroker;
    document.getElementById('confirmBrokerBtn').onclick = confirmAddBroker;
    document.getElementById('confirmAccountBtn').onclick = confirmAddAccount;
    document.getElementById('confirmAssetBtn').onclick = confirmAddAsset;
    document.getElementById('confirmBalanceBtn').onclick = confirmBalance;
   document.getElementById('confirmBankAccountBtn').onclick = confirmAddBankAccount;
   document.getElementById('loadBtn').onclick = loadFromFile;
document.getElementById('confirmBankAccountEditBtn').onclick = confirmEditBankAccount;
window.editBankAccount = editBankAccount;

    document.getElementById('confirmNoBtn').onclick = () => {
    hideConfirmModal();
};
document.getElementById('confirmYesBtn').onclick = () => {
    if (pendingDeleteAction) {
        pendingDeleteAction();
    }
};

// Попытка загрузить последний сохранённый файл из localStorage
const lastFile = localStorage.getItem('lastPortfolioFile');
if (lastFile) {
    try {
        portfolio = JSON.parse(lastFile);
        if (!portfolio.brokers) portfolio.brokers = [];
        if (!portfolio.banks) portfolio.banks = [];
        render();
        showNotification('📁 Автозагрузка последнего портфеля', '#667eea');
    } catch(e) {}
}

    // Закрытие модалок
    document.querySelectorAll('.close').forEach(close => {
        close.onclick = function() {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        };
    });
    window.onclick = function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    };
    
    window.deleteBroker = deleteBroker;
    window.deleteAccount = deleteAccount;
    window.updateQuantity = updateQuantity;
    window.refreshSinglePrice = refreshSinglePrice;
    window.showModal = showModal;
    window.deleteAsset = deleteAsset;
    window.toggleMenu = toggleMenu;
    window.lastAssetType = null;
window.closeAllMenus = closeAllMenus;
window.editAssetQuantity = editAssetQuantity;
window.enterEditMode = enterEditMode;
window.exitEditMode = exitEditMode;
    // Обработчики для банков
const addBankBtn = document.getElementById('addBankBtn');
if (addBankBtn) addBankBtn.onclick = showAddBankModal;

const confirmBankBtn = document.getElementById('confirmBankBtn');
if (confirmBankBtn) confirmBankBtn.onclick = confirmAddBank;

const confirmBankBalanceBtn = document.getElementById('confirmBankBalanceBtn');
if (confirmBankBalanceBtn) confirmBankBalanceBtn.onclick = confirmBankBalance;

// Экспорт функций для глобального доступа
window.showAddBankModal = showAddBankModal;
window.confirmAddBank = confirmAddBank;
window.showBankBalanceModal = showBankBalanceModal;
window.confirmBankBalance = confirmBankBalance;
    
    showNotification('📊 Портфель загружен!', '#667eea', 2000);

    // Автокомплит для тикера
const tickerInput = document.getElementById('assetTicker');
tickerInput.addEventListener('input', (e) => {
    const query = e.target.value;
    if (query.length >= 1) {
        const suggestions = searchTickers(query);
        showSuggestions(suggestions);
    } else {
        document.getElementById('tickerSuggestions').style.display = 'none';
    }
});

tickerInput.addEventListener('keydown', (e) => {
    const items = document.querySelectorAll('.suggestion-item');
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, items.length - 1);
        highlightSuggestion(selectedSuggestionIndex, items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
        highlightSuggestion(selectedSuggestionIndex, items);
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0 && currentSuggestions[selectedSuggestionIndex]) {
        e.preventDefault();
        selectTicker(currentSuggestions[selectedSuggestionIndex]);
    }
});

function highlightSuggestion(index, items) {
    items.forEach((item, i) => {
        item.style.background = i === index ? '#e2e8f0' : 'white';
    });
}
};