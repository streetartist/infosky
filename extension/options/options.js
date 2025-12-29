// InfoSky Browser Extension - Options Script

const DEFAULT_SETTINGS = {
    apiUrl: 'http://localhost:8000',
    autoCheckRelated: true,
    showFloatingBtn: true,
    highlightSaved: true
};

// DOM Elements
const apiUrlInput = document.getElementById('api-url');
const autoCheckRelatedToggle = document.getElementById('auto-check-related');
const showFloatingBtnToggle = document.getElementById('show-floating-btn');
const highlightSavedToggle = document.getElementById('highlight-saved');
const btnSave = document.getElementById('btn-save');
const btnReset = document.getElementById('btn-reset');
const messageEl = document.getElementById('message');

// Load settings on page load
document.addEventListener('DOMContentLoaded', loadSettings);

// Event listeners
btnSave.addEventListener('click', saveSettings);
btnReset.addEventListener('click', resetSettings);

async function loadSettings() {
    const settings = await chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS));

    apiUrlInput.value = settings.apiUrl || DEFAULT_SETTINGS.apiUrl;
    autoCheckRelatedToggle.checked = settings.autoCheckRelated !== false;
    showFloatingBtnToggle.checked = settings.showFloatingBtn !== false;
    highlightSavedToggle.checked = settings.highlightSaved !== false;
}

async function saveSettings() {
    const settings = {
        apiUrl: apiUrlInput.value.trim() || DEFAULT_SETTINGS.apiUrl,
        autoCheckRelated: autoCheckRelatedToggle.checked,
        showFloatingBtn: showFloatingBtnToggle.checked,
        highlightSaved: highlightSavedToggle.checked
    };

    // Validate API URL
    if (!settings.apiUrl.startsWith('http://') && !settings.apiUrl.startsWith('https://')) {
        showMessage('API 地址格式不正确', 'error');
        return;
    }

    // Test connection
    try {
        const response = await fetch(`${settings.apiUrl}/api/extension/status`);
        if (!response.ok) {
            showMessage('无法连接到指定的 API 服务器', 'error');
            return;
        }
    } catch (error) {
        showMessage('无法连接到指定的 API 服务器，请检查地址是否正确', 'error');
        return;
    }

    // Save settings
    await chrome.storage.sync.set(settings);
    showMessage('设置已保存', 'success');
}

async function resetSettings() {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
    await loadSettings();
    showMessage('已恢复默认设置', 'success');
}

function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;

    setTimeout(() => {
        messageEl.className = 'message';
    }, 3000);
}
