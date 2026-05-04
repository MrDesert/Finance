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
        brokers: [
            {
                id: 'broker1',
                name: 'Тинькофф Инвестиции',
                accounts: [
                    {
                        id: 'acc1',
                        name: 'Брокерский счёт',
                        balance: 150000,
                        assets: [
                            { id: 'ast1', ticker: 'SBER', name: 'Сбербанк', quantity: 10, price: 301.5, lotsize: 1 },
                            { id: 'ast2', ticker: 'YNDX', name: 'Яндекс', quantity: 5, price: 4120, lotsize: 1 }
                        ]
                    },
                    {
                        id: 'acc2',
                        name: 'ИИС',
                        balance: 50000,
                        assets: []
                    }
                ]
            }
        ],
        banks: [
            {
                id: 'bank1',
                name: 'Т-Банк',
                accounts: [
                    {
                        id: 'bankAcc1',
                        name: 'Накопительный счёт',
                        type: 'savings',  // savings, deposit, credit, card
                        balance: 80000,
                        interestRate: 12.5,
                        interestCondition: 'min_balance', // min_balance, daily_balance
                        interestPayment: 'monthly', // monthly, daily, at_end
                        creditLimit: null,
                        hasDebt: false,
                        debtAmount: 0
                    },
                    {
                        id: 'bankAcc2',
                        name: 'Вклад 6%',
                        type: 'deposit',
                        balance: 200000,
                        interestRate: 6.0,
                        interestCondition: 'fix',
                        interestPayment: 'at_end',
                        endDate: '2025-12-31'
                    }
                ]
            },
            {
                id: 'bank2',
                name: 'Сбербанк',
                accounts: [
                    {
                        id: 'bankAcc3',
                        name: 'Дебетовая карта',
                        type: 'card',
                        balance: 35000,
                        interestRate: 5.0,
                        interestCondition: 'daily_balance',
                        interestPayment: 'monthly'
                    },
                    {
                        id: 'bankAcc4',
                        name: 'Кредитная карта',
                        type: 'credit',
                        balance: -15000,
                        creditLimit: 100000,
                        interestRate: 25.0,
                        hasDebt: true,
                        debtAmount: 15000
                    }
                ]
            }
        ]
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

function showAddAccountModal(brokerId) {
    currentBrokerId = brokerId;
    document.getElementById('modalAccount').style.display = 'block';
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

function showBalanceModal(brokerId, accountId) {
    currentBrokerId = brokerId;
    currentAccountId = accountId;
    document.getElementById('modalBalance').style.display = 'block';
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

function showAssetModal(brokerId, accountId) {
    currentBrokerId = brokerId;
    currentAccountId = accountId;
    document.getElementById('modalAsset').style.display = 'block';
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
function getAssetTypeIcon(ticker) {
    // Известные фонды/ETF
    const etfList = ['FXRL', 'FXRU', 'TMOS', 'SBMX', 'SBMO', 'AKMM', 'EQMX', 'TGLD', 'TRUR', 'VTBR'];
    if (etfList.includes(ticker)) {
        return '📊';
    }
    // Для облигаций — если тикер длинный или начинается с SU/RU
    if (ticker.length > 6 || ticker.startsWith('SU') || ticker.startsWith('RU')) {
        return '📜';
    }
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
            <button class="btn-add-account" onclick="showAddAccountModal('${broker.id}')">➕ Добавить счёт</button>
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
            <button onclick="showBalanceModal('${broker.id}', '${account.id}')">💰 Изменить баланс</button>
            <button onclick="showAssetModal('${broker.id}', '${account.id}')">➕ Добавить актив</button>
            <button class="delete-btn" onclick="deleteAccount('broker', '${broker.id}', '${account.id}')">🗑️ Удалить счёт</button>
        </div>
    </div>
</div>
                <div class="account-balance-row">
                    <div class="account-balance">💰 ${accountTotal.toLocaleString()} ₽</div>
                    <div class="account-actions">
                        <button class="btn-icon" onclick="showBalanceModal('broker', '${broker.id}', '${account.id}')">💰 Остаток рублей: ${account.balance.toLocaleString()} ₽</button>
                        <button class="btn-icon" onclick="showAssetModal('${broker.id}', '${account.id}')">➕ Актив</button>
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
                    ${getAssetTypeIcon(asset.ticker)} ${escapeHtml(asset.name)}
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
                    <input type="number" id="qty_input_${asset.id}" class="qty-input" value="${asset.quantity}" step="${asset.lotsize || 1}" onchange="setQuantity('${broker.id}', '${account.id}', '${asset.id}', this.value)">
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

// Установить точное количество (из input)
function setQuantity(brokerId, accountId, assetId, newValue) {
    // Эта функция теперь вызывается из onchange input
    // Но сохраняем только когда нажали "Готово"
    // Поэтому просто сохраняем значение, рендер будет при выходе
    return;
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
    
    const categories = [
        { engine: 'stock', market: 'shares', board: 'tqbr', type: '📈 Акция', limit: 1000 },
        { engine: 'stock', market: 'bonds', board: 'tqcb', type: '📜 Облигация', limit: 1000 },
        { engine: 'stock', market: 'shares', board: 'tqtd', type: '📊 Фонд (ETF/БПИФ)', limit: 1000 },
        { engine: 'stock', market: 'shares', board: 'tqte', type: '📊 Фонд (ETF)', limit: 500 }  // дополнительная доска
    ];
    
    for (let cat of categories) {
        try {
            const url = `https://iss.moex.com/iss/engines/${cat.engine}/markets/${cat.market}/boards/${cat.board}/securities.json?limit=${cat.limit}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.securities?.data) {
                const headers = data.securities.columns;
                const tickerIndex = headers.findIndex(h => h === 'SECID');
                const nameIndex = headers.findIndex(h => h === 'SHORTNAME');
                
                const tickers = data.securities.data
                    .filter(row => row[tickerIndex] && !row[tickerIndex].includes('.') && row[tickerIndex].length <= 6)
                    .map(row => ({
                        ticker: row[tickerIndex],
                        name: (row[nameIndex] || row[tickerIndex]),
                        type: cat.type
                    }));
                
                all.push(...tickers);
            }
        } catch(e) {
            console.warn(`Не загружены ${cat.type}:`, e);
        }
    }
    
    // Убираем дубликаты (один тикер может быть на нескольких досках)
    const uniqueTickers = new Map();
    for (const t of all) {
        if (!uniqueTickers.has(t.ticker)) {
            uniqueTickers.set(t.ticker, t);
        }
    }
    
    allTickers = Array.from(uniqueTickers.values());
    console.log(`✅ Загружено тикеров: ${allTickers.length} (акции/облигации/фонды)`);
    
    // Специально известные фонды, если не загрузились
    const knownETFs = ['FXRL', 'FXRU', 'TMOS', 'SBMX', 'SBMO', 'AKMM', 'EQMX', 'TGLD', 'TRUR', 'VTBR'];
    for (const etf of knownETFs) {
        if (!uniqueTickers.has(etf)) {
            allTickers.push({ ticker: etf, name: etf, type: '📊 Фонд (ETF)' });
        }
    }
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

// Загрузка цены и лотности (автоопределение типа бумаги)
// Загрузка всех тикеров (акции + облигации + фонды)
async function loadAllTickers() {
    const all = [];
    
    const categories = [
        { engine: 'stock', market: 'bonds', board: 'tqcb', type: '📜 Облигация (корпоративные)', limit: 2000 },
        { engine: 'stock', market: 'bonds', board: 'tqob', type: '📜 Облигация (ОФЗ и другие)', limit: 2000 },  // ДОБАВЛЕНО!
        { engine: 'stock', market: 'shares', board: 'tqbr', type: '📈 Акция', limit: 2000 },
        { engine: 'stock', market: 'shares', board: 'tqtd', type: '📊 Фонд (ETF/БПИФ)', limit: 2000 }
    ];
    
    for (let cat of categories) {
        try {
            const url = `https://iss.moex.com/iss/engines/${cat.engine}/markets/${cat.market}/boards/${cat.board}/securities.json?limit=${cat.limit}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.securities?.data) {
                const headers = data.securities.columns;
                const tickerIndex = headers.findIndex(h => h === 'SECID');
                const nameIndex = headers.findIndex(h => h === 'SHORTNAME');
                
                const tickers = data.securities.data
                    .filter(row => row[tickerIndex] && !row[tickerIndex].includes('.'))
                    .map(row => ({
                        ticker: row[tickerIndex],
                        name: (row[nameIndex] || row[tickerIndex]),
                        type: cat.type
                    }));
                
                all.push(...tickers);
            }
        } catch(e) {
            console.warn(`Не загружены ${cat.type}:`, e);
        }
    }
    
    // Убираем дубликаты
    const uniqueTickers = new Map();
    for (const t of all) {
        if (!uniqueTickers.has(t.ticker)) {
            uniqueTickers.set(t.ticker, t);
        }
    }
    
    allTickers = Array.from(uniqueTickers.values());
    console.log(`✅ Загружено тикеров: ${allTickers.length}`);
}

// Загрузка цены и лотности (автоопределение типа бумаги)
async function loadAssetDetails(ticker) {
    const endpoints = [
        { engine: 'stock', market: 'bonds', board: 'tqob', name: 'облигация', lotsizeField: 'LOTSIZE' },  // ОФЗ и другие
        { engine: 'stock', market: 'bonds', board: 'tqcb', name: 'облигация', lotsizeField: 'LOTSIZE' },  // корпоративные
        { engine: 'stock', market: 'shares', board: 'tqtd', name: 'фонд', lotsizeField: 'LOTSIZE' },
        { engine: 'stock', market: 'shares', board: 'tqbr', name: 'акция', lotsizeField: 'LOTSIZE' }
    ];
    
    for (let ep of endpoints) {
        try {
            const url = `https://iss.moex.com/iss/engines/${ep.engine}/markets/${ep.market}/boards/${ep.board}/securities/${ticker}.json`;
            const response = await fetch(url);
            const data = await response.json();
            
            let price = null;
            let lotsize = 1;
            let shortName = null;
            let faceValue = 1000; // Номинал по умолчанию
            
            // Получаем номинал для облигаций
            if (ep.name === 'облигация' && data.securities?.data?.length > 0) {
                const headers = data.securities.columns;
                const row = data.securities.data[0];
                const faceIdx = headers.findIndex(h => h === 'FACEVALUE');
                if (faceIdx !== -1 && row[faceIdx]) {
                    faceValue = parseFloat(row[faceIdx]);
                }
            }
            
            // Пытаемся найти цену
            if (data.marketdata?.data?.length > 0) {
                const headers = data.marketdata.columns;
                const row = data.marketdata.data[0];
                
                const lastIdx = headers.findIndex(h => h === 'LAST');
                const closeIdx = headers.findIndex(h => h === 'CLOSE');
                
                if (lastIdx !== -1 && row[lastIdx] && !isNaN(parseFloat(row[lastIdx]))) {
                    price = parseFloat(row[lastIdx]);
                } else if (closeIdx !== -1 && row[closeIdx] && !isNaN(parseFloat(row[closeIdx]))) {
                    price = parseFloat(row[closeIdx]);
                } else if (row[2] && !isNaN(parseFloat(row[2]))) {
                    price = parseFloat(row[2]);
                }
            }
            
            if (!price && data.securities?.data?.length > 0) {
                const headers = data.securities.columns;
                const row = data.securities.data[0];
                const prevPriceIdx = headers.findIndex(h => h === 'PREVPRICE');
                if (prevPriceIdx !== -1 && row[prevPriceIdx] && !isNaN(parseFloat(row[prevPriceIdx]))) {
                    price = parseFloat(row[prevPriceIdx]);
                }
            }
            
            // Лотность и название
            if (data.securities?.data?.length > 0) {
                const headers = data.securities.columns;
                const row = data.securities.data[0];
                
                const lotsizeIdx = headers.findIndex(h => h === 'LOTSIZE');
                if (lotsizeIdx !== -1 && row[lotsizeIdx]) {
                    lotsize = parseInt(row[lotsizeIdx]);
                    if (lotsize < 1) lotsize = 1;
                }
                
                const nameIdx = headers.findIndex(h => h === 'SHORTNAME');
                if (nameIdx !== -1 && row[nameIdx]) {
                    shortName = row[nameIdx];
                }
            }
            
            if (price && price > 0) {
                let displayPrice = price;
                let displayName = shortName || ticker;
                const typeIcon = ep.name === 'акция' ? '📈' : (ep.name === 'облигация' ? '📜' : '📊');
                
                // КОНВЕРТАЦИЯ ДЛЯ ОБЛИГАЦИЙ
                if (ep.name === 'облигация') {
                    // Цена в процентах от номинала → в рубли
                    const priceInRub = (price / 100) * faceValue;
                    displayPrice = priceInRub;
                    document.getElementById('assetPrice').value = displayPrice.toFixed(2);
                    document.getElementById('assetName').value = `${displayName} ${typeIcon} (${price.toFixed(2)}% от ${faceValue}₽)`;
                } else {
                    document.getElementById('assetPrice').value = displayPrice.toFixed(2);
                    document.getElementById('assetName').value = `${displayName} ${typeIcon}`;
                }
                
                document.getElementById('assetLotsize').value = lotsize;
                window.lastAssetType = ep.name;
                return;
            }
        } catch(e) {
            // Идём дальше
        }
    }
    
    document.getElementById('assetPrice').value = '';
    document.getElementById('assetLotsize').value = '1';
    showNotification(`❌ Не удалось получить цену для ${ticker}. Введите вручную.`, '#f59e0b', 4000);
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

// Показать модалку изменения баланса банка
function showBankBalanceModal(bankId, accountId) {
    currentBankId = bankId;
    currentBankAccountId = accountId;
    document.getElementById('modalBankBalance').style.display = 'block';
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
    window.showAddAccountModal = showAddAccountModal;
    window.showBalanceModal = showBalanceModal;
    window.showAssetModal = showAssetModal;
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

// // Показать модалку подтверждения
// function showConfirmModal(title, message, onConfirm) {
//     document.getElementById('confirmTitle').innerText = title;
//     document.getElementById('confirmMessage').innerHTML = message;
//     pendingDeleteAction = onConfirm;
//     document.getElementById('modalConfirm').style.display = 'block';
// }

// // Скрыть модалку
// function hideConfirmModal() {
//     document.getElementById('modalConfirm').style.display = 'none';
//     pendingDeleteAction = null;
// }

// При открытии модалки очищаем автокомплит
const modalAsset = document.getElementById('modalAsset');
const originalModalDisplay = modalAsset.style.display;
window.oldShowAssetModal = window.showAssetModal;
window.showAssetModal = function(brokerId, accountId) {
    document.getElementById('assetTicker').value = '';
    document.getElementById('assetName').value = '';
    document.getElementById('assetQuantity').value = '';
    document.getElementById('assetPrice').value = '';
    document.getElementById('assetLotsize').value = '';
    document.getElementById('tickerSuggestions').style.display = 'none';
    currentBrokerId = brokerId;
    currentAccountId = accountId;
    modalAsset.style.display = 'block';
};
};