// InfoSky Browser Extension - Background Service Worker

const DEFAULT_API_URL = 'http://localhost:8000';

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sender).then(sendResponse);
    return true; // Keep message channel open for async response
});

async function handleMessage(request, sender) {
    // Get API URL from settings
    const settings = await chrome.storage.sync.get(['apiUrl']);
    const apiUrl = settings.apiUrl || DEFAULT_API_URL;

    switch (request.action) {
        case 'createNode':
            return await createNode(apiUrl, request.data);

        case 'quickSave':
            return await quickSave(apiUrl, request.data);

        case 'findRelated':
            return await findRelated(apiUrl, request.data);

        case 'checkStatus':
            return await checkStatus(apiUrl);

        default:
            return { success: false, error: 'Unknown action' };
    }
}

// Create a node from selected text
async function createNode(apiUrl, data) {
    try {
        const response = await fetch(`${apiUrl}/api/extension/create-node`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        return { success: response.ok, ...result };
    } catch (error) {
        console.error('[InfoSky] Create node error:', error);
        return { success: false, error: error.message };
    }
}

// Quick save a URL
async function quickSave(apiUrl, data) {
    try {
        const response = await fetch(`${apiUrl}/api/extension/quick-save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        return { success: response.ok, ...result };
    } catch (error) {
        console.error('[InfoSky] Quick save error:', error);
        return { success: false, error: error.message };
    }
}

// Find related knowledge
async function findRelated(apiUrl, data) {
    try {
        const response = await fetch(`${apiUrl}/api/extension/find-related`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        return { success: response.ok, ...result };
    } catch (error) {
        console.error('[InfoSky] Find related error:', error);
        return { success: false, error: error.message };
    }
}

// Check backend status
async function checkStatus(apiUrl) {
    try {
        const response = await fetch(`${apiUrl}/api/extension/status`);
        return { success: response.ok, connected: response.ok };
    } catch (error) {
        return { success: false, connected: false, error: error.message };
    }
}

// Context menu for quick actions
chrome.runtime.onInstalled.addListener(() => {
    // Check if context menu items exist to avoid duplicates or errors
    chrome.contextMenus.removeAll(() => {
        // Create context menu for selected text
        chrome.contextMenus.create({
            id: 'infosky-save-selection',
            title: '添加到 InfoSky 知识库',
            contexts: ['selection']
        });

        // Create context menu for links
        chrome.contextMenus.create({
            id: 'infosky-save-link',
            title: '保存链接到 InfoSky',
            contexts: ['link']
        });

        // Create context menu for page
        chrome.contextMenus.create({
            id: 'infosky-save-page',
            title: '保存此页面到 InfoSky',
            contexts: ['page']
        });

        // Create context menu for manual selection
        chrome.contextMenus.create({
            id: 'infosky-manual-select',
            title: '手动选择正文区域 (InfoSky)',
            contexts: ['page', 'selection']
        });
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const settings = await chrome.storage.sync.get(['apiUrl']);
    const apiUrl = settings.apiUrl || DEFAULT_API_URL;

    switch (info.menuItemId) {
        case 'infosky-save-selection':
            if (info.selectionText) {
                const result = await createNode(apiUrl, {
                    text: info.selectionText,
                    source_url: tab.url,
                    source_title: tab.title
                });

                showNotification(result.success ? '已添加到知识库' : '添加失败', result.message || result.error);
            }
            break;

        case 'infosky-save-link':
            if (info.linkUrl) {
                const result = await quickSave(apiUrl, {
                    url: info.linkUrl,
                    title: info.linkUrl
                });

                showNotification(result.success ? '链接已保存' : '保存失败', result.message || result.error);
            }
            break;

        case 'infosky-save-page':
            let htmlContent = '';
            try {
                // Execute script to get HTML content
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => document.documentElement.outerHTML
                });
                if (results && results[0]) {
                    htmlContent = results[0].result;
                }
            } catch (e) {
                console.warn('[InfoSky] Could not extract HTML for quick save:', e);
            }

            const result = await quickSave(apiUrl, {
                url: tab.url,
                title: tab.title,
                html_content: htmlContent,
                is_manual_selection: false
            });

            showNotification(result.success ? '页面已保存' : '保存失败', result.message || result.error);
            break;

        case 'infosky-manual-select':
            // Toggle selection mode in content script
            chrome.tabs.sendMessage(tab.id, { action: 'toggleSelectionMode' })
                .catch(err => {
                    console.error('Could not toggle selection mode:', err);
                    showNotification('错误', '无法启动选择模式，请刷新页面后重试');
                });
            break;
    }
});

// Show notification
function showNotification(title, message) {
    // Send message to content script to show toast
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'showToast',
                title,
                message
            }).catch(() => {
                // Content script might not be loaded
                console.log('[InfoSky] Could not show toast notification');
            });
        }
    });
}
