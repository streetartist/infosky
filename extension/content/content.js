// InfoSky Browser Extension - Content Script

(function () {
    'use strict';

    // Avoid running multiple times
    if (window.__infoskyContentScriptLoaded) return;
    window.__infoskyContentScriptLoaded = true;

    const DEFAULT_API_URL = 'http://localhost:8000';
    let API_URL = DEFAULT_API_URL;
    let floatingButton = null;
    let floatingPanel = null;
    let sidePanel = null;
    let selectedText = '';
    let selectionRange = null;
    let isSelectionMode = false;
    let hoveredElement = null;
    let modeIndicator = null;

    // Load API URL from storage
    async function loadSettings() {
        try {
            const settings = await chrome.storage.sync.get(['apiUrl']);
            if (settings.apiUrl) {
                API_URL = settings.apiUrl;
            }
        } catch (e) {
            console.log('[InfoSky] Could not load settings, using default API URL');
        }
    }

    // Direct API call helper
    async function callAPI(endpoint, data) {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    }

    // ============ Floating Button for Text Selection ============

    function createFloatingButton() {
        if (floatingButton) return;

        floatingButton = document.createElement('div');
        floatingButton.id = 'infosky-floating-btn';
        floatingButton.innerHTML = `
      <span class="infosky-btn-icon">✨</span>
      <span class="infosky-btn-text">添加到 InfoSky</span>
    `;
        floatingButton.style.display = 'none';
        document.body.appendChild(floatingButton);

        floatingButton.addEventListener('click', handleFloatingButtonClick);
    }

    function showFloatingButton(x, y) {
        if (!floatingButton) createFloatingButton();

        // Position near selection
        const btnWidth = 160;
        const btnHeight = 36;

        let left = x - btnWidth / 2;
        let top = y - btnHeight - 10;

        // Keep within viewport
        left = Math.max(10, Math.min(left, window.innerWidth - btnWidth - 10));
        top = Math.max(10, top);

        floatingButton.style.left = `${left}px`;
        floatingButton.style.top = `${top}px`;
        floatingButton.style.display = 'flex';
    }

    function hideFloatingButton() {
        if (floatingButton) {
            floatingButton.style.display = 'none';
        }
    }

    // Handle text selection
    document.addEventListener('mouseup', (e) => {
        // Ignore if clicking on our own UI
        if (e.target.closest('#infosky-floating-btn, #infosky-floating-panel, #infosky-side-panel')) {
            return;
        }

        setTimeout(() => {
            const selection = window.getSelection();
            const text = selection.toString().trim();

            if (text.length > 5) {
                selectedText = text;
                try {
                    selectionRange = selection.getRangeAt(0);
                    const rect = selectionRange.getBoundingClientRect();
                    showFloatingButton(
                        rect.left + rect.width / 2 + window.scrollX,
                        rect.top + window.scrollY
                    );
                } catch (e) {
                    console.error('[InfoSky] Selection error:', e);
                }
            } else {
                hideFloatingButton();
                hideFloatingPanel();
            }
        }, 10);
    });

    // Hide on scroll or click elsewhere
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('#infosky-floating-btn, #infosky-floating-panel')) {
            hideFloatingButton();
            hideFloatingPanel();
        }
    });

    // ============ Floating Panel for Node Creation ============

    function createFloatingPanel() {
        if (floatingPanel) return;

        floatingPanel = document.createElement('div');
        floatingPanel.id = 'infosky-floating-panel';
        floatingPanel.innerHTML = `
      <div class="infosky-panel-header">
        <span>添加到 InfoSky 知识库</span>
        <button class="infosky-panel-close">&times;</button>
      </div>
      <div class="infosky-panel-body">
        <div class="infosky-form-group">
          <label>节点标签</label>
          <input type="text" id="infosky-node-label" placeholder="知识点名称...">
        </div>
        <div class="infosky-form-group">
          <label>节点类型</label>
          <select id="infosky-node-type">
            <option value="概念">概念</option>
            <option value="事实">事实</option>
            <option value="观点">观点</option>
            <option value="引用">引用</option>
            <option value="笔记">笔记</option>
          </select>
        </div>
        <div class="infosky-form-group">
          <label>选中内容</label>
          <div class="infosky-selected-text" id="infosky-selected-preview"></div>
        </div>
        <button class="infosky-submit-btn" id="infosky-submit">
          <span>保存到知识库</span>
        </button>
      </div>
    `;
        floatingPanel.style.display = 'none';
        document.body.appendChild(floatingPanel);

        // Event listeners
        floatingPanel.querySelector('.infosky-panel-close').addEventListener('click', hideFloatingPanel);
        floatingPanel.querySelector('#infosky-submit').addEventListener('click', handleSubmitNode);
    }

    function showFloatingPanel() {
        if (!floatingPanel) createFloatingPanel();

        // Position panel
        const rect = floatingButton.getBoundingClientRect();
        floatingPanel.style.left = `${rect.left + window.scrollX}px`;
        floatingPanel.style.top = `${rect.bottom + 10 + window.scrollY}px`;

        // Update content
        const labelInput = floatingPanel.querySelector('#infosky-node-label');
        const preview = floatingPanel.querySelector('#infosky-selected-preview');

        // Generate default label from selected text
        labelInput.value = selectedText.substring(0, 30);
        preview.textContent = selectedText.length > 200
            ? selectedText.substring(0, 200) + '...'
            : selectedText;

        floatingPanel.style.display = 'block';
        hideFloatingButton();

        labelInput.focus();
        labelInput.select();
    }

    function hideFloatingPanel() {
        if (floatingPanel) {
            floatingPanel.style.display = 'none';
        }
    }

    function handleFloatingButtonClick() {
        showFloatingPanel();
    }

    async function handleSubmitNode() {
        const labelInput = floatingPanel.querySelector('#infosky-node-label');
        const typeSelect = floatingPanel.querySelector('#infosky-node-type');
        const submitBtn = floatingPanel.querySelector('#infosky-submit');

        const label = labelInput.value.trim();
        const nodeType = typeSelect.value;

        if (!label) {
            showToast('错误', '请输入节点标签');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>保存中...</span>';

        try {
            const result = await callAPI('/api/extension/create-node', {
                text: selectedText,
                label: label,
                node_type: nodeType,
                source_url: window.location.href,
                source_title: document.title
            });

            if (result && result.success) {
                showToast('成功', result.message || '已添加到知识库');
                hideFloatingPanel();

                // Optionally highlight the saved text
                if (selectionRange) {
                    highlightSavedText(selectionRange);
                }
            } else {
                showToast('失败', result?.detail || result?.error || '保存失败');
            }
        } catch (error) {
            console.error('[InfoSky] Submit error:', error);
            showToast('错误', '无法连接到 InfoSky 服务器');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>保存到知识库</span>';
        }
    }

    // ============ Highlight Saved Text ============

    function highlightSavedText(range) {
        try {
            const highlight = document.createElement('mark');
            highlight.className = 'infosky-highlight';
            highlight.title = '已保存到 InfoSky';
            range.surroundContents(highlight);
        } catch (e) {
            // Can't highlight if selection spans multiple elements
            console.log('[InfoSky] Could not highlight text');
        }
    }

    // ============ Side Panel for Related Knowledge ============

    function createSidePanel() {
        if (sidePanel) return;

        sidePanel = document.createElement('div');
        sidePanel.id = 'infosky-side-panel';
        sidePanel.classList.add('collapsed'); // Start collapsed
        sidePanel.innerHTML = `
      <div class="infosky-side-tab" id="infosky-side-tab">
        <span class="infosky-side-tab-icon">📚</span>
        <span class="infosky-side-tab-text">知识</span>
        <span class="infosky-side-tab-arrow">◀</span>
      </div>
      <div class="infosky-side-header">
        <span class="infosky-side-title">📚 相关知识</span>
        <button class="infosky-side-close" id="infosky-close-side">&times;</button>
      </div>
      <div class="infosky-side-body" id="infosky-side-body">
        <div class="infosky-loading">检查中...</div>
      </div>
    `;
        document.body.appendChild(sidePanel);

        // Tab click to expand
        sidePanel.querySelector('#infosky-side-tab').addEventListener('click', () => {
            sidePanel.classList.remove('collapsed');
            updateTabArrow();
        });

        // Close button to collapse
        sidePanel.querySelector('#infosky-close-side').addEventListener('click', () => {
            sidePanel.classList.add('collapsed');
            updateTabArrow();
        });
    }

    function updateTabArrow() {
        if (!sidePanel) return;
        const arrow = sidePanel.querySelector('.infosky-side-tab-arrow');
        if (arrow) {
            arrow.textContent = sidePanel.classList.contains('collapsed') ? '◀' : '▶';
        }
    }

    function toggleSidePanel() {
        if (sidePanel) {
            sidePanel.classList.toggle('collapsed');
            updateTabArrow();
        }
    }

    async function checkRelatedKnowledge() {
        // Load settings first
        await loadSettings();

        createSidePanel();

        const body = sidePanel.querySelector('#infosky-side-body');
        body.innerHTML = '<div class="infosky-loading">检查中...</div>';

        try {
            const result = await callAPI('/api/extension/find-related', {
                title: document.title,
                keywords: extractKeywords(),
                content_snippet: getContentSnippet()
            });

            if (result && result.has_related) {
                displayRelatedInSidePanel(result.related_nodes);
            } else {
                body.innerHTML = '<div class="infosky-no-related">暂无相关知识</div>';
                // Auto-hide if no related content
                setTimeout(() => {
                    if (sidePanel) sidePanel.classList.add('collapsed');
                }, 2000);
            }
        } catch (error) {
            console.error('[InfoSky] Related check error:', error);
            body.innerHTML = '<div class="infosky-error">无法连接到 InfoSky 服务器</div>';
            // Auto-hide on error
            setTimeout(() => {
                if (sidePanel) sidePanel.classList.add('collapsed');
            }, 3000);
        }
    }

    function displayRelatedInSidePanel(nodes) {
        const body = sidePanel.querySelector('#infosky-side-body');

        if (nodes.length === 0) {
            body.innerHTML = '<div class="infosky-no-related">暂无相关知识</div>';
            return;
        }

        body.innerHTML = nodes.map(node => `
      <div class="infosky-related-card">
        <div class="infosky-card-label">${escapeHtml(node.label)}</div>
        <div class="infosky-card-type">${escapeHtml(node.type)}</div>
        <div class="infosky-card-preview">${escapeHtml(node.content_preview)}</div>
      </div>
    `).join('');

        // Show the panel
        // sidePanel.classList.remove('collapsed'); // Default to collapsed
    }

    // ============ Toast Notifications ============

    function showToast(title, message) {
        // Remove existing toast
        const existing = document.querySelector('.infosky-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'infosky-toast';
        toast.innerHTML = `
      <div class="infosky-toast-title">${escapeHtml(title)}</div>
      <div class="infosky-toast-message">${escapeHtml(message)}</div>
    `;
        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ============ Utilities ============

    function extractKeywords() {
        // Extract from meta keywords
        const metaKeywords = document.querySelector('meta[name="keywords"]');
        if (metaKeywords) {
            return metaKeywords.content.split(',').map(k => k.trim()).filter(k => k);
        }

        // Fallback: extract from title
        return document.title.split(/[\s\-\_\|,，、]+/).filter(k => k.length > 1);
    }

    function getContentSnippet() {
        // Try to get meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) return metaDesc.content;

        // Fallback: get first paragraph
        const firstP = document.querySelector('article p, main p, .content p, p');
        if (firstP) return firstP.textContent.substring(0, 300);

        return '';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============ Message Handler ============

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'showToast') {
            showToast(request.title, request.message);
            sendResponse({ success: true });
        } else if (request.action === 'toggleSelectionMode') {
            toggleSelectionMode();
            sendResponse({ success: true });
        }
        return true;
    });

    // ============ Manual Selection Mode ============

    function toggleSelectionMode() {
        if (isSelectionMode) {
            disableSelectionMode();
        } else {
            enableSelectionMode();
        }
    }

    function enableSelectionMode() {
        isSelectionMode = true;

        // Create indicator
        if (!modeIndicator) {
            modeIndicator = document.createElement('div');
            modeIndicator.className = 'infosky-mode-indicator';
            modeIndicator.textContent = '点击选择正文区域 (ESC 退出)';
            document.body.appendChild(modeIndicator);
        }
        modeIndicator.style.display = 'block';

        // Add listeners
        document.addEventListener('mouseover', handleElementHover, true);
        document.addEventListener('mouseout', handleElementHover, true);
        document.addEventListener('click', handleElementClick, true);
        document.addEventListener('keydown', handleEscKey, true);
    }

    function disableSelectionMode() {
        isSelectionMode = false;

        if (modeIndicator) {
            modeIndicator.style.display = 'none';
        }

        // Cleanup hover
        if (hoveredElement) {
            hoveredElement.classList.remove('infosky-element-hover');
            hoveredElement = null;
        }

        // Remove listeners
        document.removeEventListener('mouseover', handleElementHover, true);
        document.removeEventListener('mouseout', handleElementHover, true);
        document.removeEventListener('click', handleElementClick, true);
        document.removeEventListener('keydown', handleEscKey, true);
    }

    function handleEscKey(e) {
        if (e.key === 'Escape') {
            disableSelectionMode();
        }
    }

    function handleElementHover(e) {
        if (!isSelectionMode) return;

        if (e.type === 'mouseover') {
            // Ignore our own UI
            if (e.target.closest('#infosky-floating-btn, #infosky-floating-panel, #infosky-side-panel, .infosky-mode-indicator')) {
                return;
            }

            if (hoveredElement) {
                hoveredElement.classList.remove('infosky-element-hover');
            }
            hoveredElement = e.target;
            hoveredElement.classList.add('infosky-element-hover');
            e.stopPropagation();
        } else if (e.type === 'mouseout') {
            if (e.target === hoveredElement) {
                hoveredElement.classList.remove('infosky-element-hover');
                hoveredElement = null;
            }
        }
    }

    function handleElementClick(e) {
        if (!isSelectionMode) return;

        // Ignore our own UI
        if (e.target.closest('#infosky-floating-btn, #infosky-floating-panel, #infosky-side-panel')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        const htmlContent = target.outerHTML;

        disableSelectionMode();

        // Confirm selection
        confirmContentSelection(htmlContent, target);
    }

    function confirmContentSelection(htmlContent, sourceElement) {
        // reuse display logic or show a specific panel
        // For simplicity, we'll try to reuse floatingPanel or create a new one
        // Let's create a custom quick confirmation using our toast system or new UI

        // Wait, the user wants to substitute the "extraction engine". 
        // Typically this means they want to "save page" but using this content.

        if (confirm('确认使用选中的区域作为正文进行提取吗？')) {
            submitSelectedContent(htmlContent);
        }
    }

    async function submitSelectedContent(htmlContent) {
        showToast('InfoSky', '正在分析选中内容...');

        try {
            const result = await callAPI('/api/extension/quick-save', {
                url: window.location.href,
                title: document.title,
                html_content: htmlContent,
                is_manual_selection: true
            });

            if (result && result.success) {
                showToast('成功', result.message || '已保存到知识库');
                // Trigger side panel refresh if needed or check related
                checkRelatedKnowledge();
            } else {
                showToast('失败', '保存失败');
            }
        } catch (error) {
            console.error('[InfoSky] Save error:', error);
            showToast('错误', '无法连接到服务器');
        }
    }

    // ============ Initialize ============

    // Check for related knowledge on page load (with delay)
    setTimeout(() => {
        checkRelatedKnowledge();
    }, 2000);

    console.log('[InfoSky] Content script loaded');
})();
