// InfoSky Browser Extension - Popup Script

// Configuration
const DEFAULT_API_URL = 'http://localhost:8000';
let API_URL = DEFAULT_API_URL;

// DOM Elements
const statusIndicator = document.getElementById('status-indicator');
const statusDot = statusIndicator.querySelector('.status-dot');
const statusText = statusIndicator.querySelector('.status-text');
const pageTitle = document.getElementById('page-title');
const pageUrl = document.getElementById('page-url');
const btnSavePage = document.getElementById('btn-save-page');
const btnCheckRelated = document.getElementById('btn-check-related');
const relatedPanel = document.getElementById('related-panel');
const relatedList = document.getElementById('related-list');
const messageEl = document.getElementById('message');
const btnOpenApp = document.getElementById('btn-open-app');
const btnSettings = document.getElementById('btn-settings');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Load settings
    const settings = await chrome.storage.sync.get(['apiUrl']);
    if (settings.apiUrl) {
        API_URL = settings.apiUrl;
    }

    // Check backend status
    await checkBackendStatus();

    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
        pageTitle.textContent = tab.title || '无标题';
        pageUrl.textContent = tab.url || '';
    }
});

// Event Listeners
btnSavePage.addEventListener('click', handleSavePage);
btnCheckRelated.addEventListener('click', handleCheckRelated);
btnOpenApp.addEventListener('click', () => chrome.tabs.create({ url: 'http://localhost:3000' }));
btnSettings.addEventListener('click', () => chrome.runtime.openOptionsPage());

// Check Backend Status
async function checkBackendStatus() {
    try {
        const response = await fetch(`${API_URL}/api/extension/status`);
        if (response.ok) {
            statusIndicator.classList.add('connected');
            statusIndicator.classList.remove('error');
            statusText.textContent = '已连接';
        } else {
            throw new Error('Backend not responding');
        }
    } catch (error) {
        statusIndicator.classList.add('error');
        statusIndicator.classList.remove('connected');
        statusText.textContent = '未连接';
        showMessage('无法连接到 InfoSky 后端，请确保服务正在运行', 'error');
    }
}

// Save Current Page
async function handleSavePage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
        showMessage('无法获取当前页面信息', 'error');
        return;
    }

    // Skip internal pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        showMessage('无法保存浏览器内部页面', 'error');
        return;
    }

    setButtonLoading(btnSavePage, true);

    try {
        // Execute script to get HTML content
        let htmlContent = '';
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.documentElement.outerHTML
            });
            if (results && results[0]) {
                htmlContent = results[0].result;
            }
        } catch (e) {
            console.warn('Could not extract HTML, falling back to URL save:', e);
        }

        const response = await fetch(`${API_URL}/api/extension/quick-save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: tab.url,
                title: tab.title,
                html_content: htmlContent
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showMessage(`✅ ${result.message}`, 'success');
        } else {
            throw new Error(result.detail || '保存失败');
        }
    } catch (error) {
        console.error('Save error:', error);
        showMessage(`保存失败: ${error.message}`, 'error');
    } finally {
        setButtonLoading(btnSavePage, false);
    }
}

// Check Related Knowledge
async function handleCheckRelated() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    setButtonLoading(btnCheckRelated, true);

    try {
        // Extract keywords from title
        const keywords = tab.title ? tab.title.split(/[\s\-\_\|,，、]+/).filter(k => k.length > 1) : [];

        const response = await fetch(`${API_URL}/api/extension/find-related`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: tab.title || '',
                keywords: keywords.slice(0, 10)
            })
        });

        const result = await response.json();

        if (response.ok) {
            displayRelatedNodes(result.related_nodes || []);
        } else {
            throw new Error(result.detail || '查询失败');
        }
    } catch (error) {
        console.error('Related check error:', error);
        showMessage(`查询失败: ${error.message}`, 'error');
    } finally {
        setButtonLoading(btnCheckRelated, false);
    }
}

// Display Related Nodes
function displayRelatedNodes(nodes) {
    relatedPanel.style.display = 'block';

    if (nodes.length === 0) {
        relatedList.innerHTML = '<div class="no-related">暂无相关知识</div>';
        return;
    }

    relatedList.innerHTML = nodes.map(node => `
    <div class="related-item" data-id="${node.id}">
      <div class="related-item-label">${escapeHtml(node.label)}</div>
      <span class="related-item-type">${escapeHtml(node.type)}</span>
      <div class="related-item-preview">${escapeHtml(node.content_preview)}</div>
    </div>
  `).join('');

    // Add click handlers
    relatedList.querySelectorAll('.related-item').forEach(item => {
        item.addEventListener('click', () => {
            // Open InfoSky with this node focused
            chrome.tabs.create({ url: `http://localhost:3000?focus=${item.dataset.id}` });
        });
    });
}

// Utility Functions
function showMessage(text, type = 'info') {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'flex';

    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 4000);
}

function setButtonLoading(button, loading) {
    if (loading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
