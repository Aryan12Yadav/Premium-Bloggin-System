/**
 * AI Blog Assistant Copilot - Floating Chatbot Widget
 * Handles per-user isolated conversation memory, RAG interactions, and styling.
 */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', initCopilotWidget);

    function initCopilotWidget() {
        const widget = document.getElementById('blog-copilot-widget');
        if (!widget) return;

        const launcherBtn = document.getElementById('copilot-launcher-btn');
        const chatWindow = document.getElementById('copilot-chat-window');
        const minimizeBtn = document.getElementById('copilot-minimize-btn');
        const newChatBtn = document.getElementById('copilot-new-chat-btn');
        const chatForm = document.getElementById('copilot-chat-form');
        const userInput = document.getElementById('copilot-user-input');
        const sendBtn = document.getElementById('copilot-send-btn');
        const messagesContainer = document.getElementById('copilot-messages');
        const typingIndicator = document.getElementById('copilot-typing-indicator');
        const convTag = document.getElementById('copilot-conv-tag');
        const launcherIcon = launcherBtn.querySelector('.copilot-launcher-icon');
        const closeIcon = launcherBtn.querySelector('.copilot-close-icon');

        const apiBase = widget.dataset.apiBase || 'https://social-blogging-copilot-api.onrender.com';
        const userId = widget.dataset.userId || '';
        const username = widget.dataset.username || 'guest';
        const isAuthenticated = widget.dataset.isAuthenticated === 'true';

        // Per-user storage key
        const storageKey = isAuthenticated && userId ? `copilot_conv_user_${userId}` : 'copilot_conv_guest';
        let currentConvId = getOrCreateConversationId(storageKey, userId);
        let historyLoaded = false;

        updateConversationTag();

        // Check if window was previously opened during this session
        if (sessionStorage.getItem('copilot_window_open') === 'true') {
            openChatWindow();
        }

        // Toggle Launcher
        launcherBtn.addEventListener('click', function () {
            if (chatWindow.style.display === 'none' || chatWindow.style.display === '') {
                openChatWindow();
            } else {
                closeChatWindow();
            }
        });

        // Minimize Button
        minimizeBtn.addEventListener('click', closeChatWindow);

        // New Chat Button
        newChatBtn.addEventListener('click', function () {
            if (confirm('Start a fresh new conversation? Your previous chat will be archived in the system.')) {
                startNewConversation();
            }
        });

        // Chat Form Submit
        chatForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const text = userInput.value.trim();
            if (!text) return;
            sendMessage(text);
        });

        // Suggestion Chips Click
        messagesContainer.addEventListener('click', function (e) {
            const chip = e.target.closest('.copilot-chip');
            if (chip && chip.dataset.prompt) {
                userInput.value = chip.dataset.prompt;
                sendMessage(chip.dataset.prompt);
            }
        });

        function openChatWindow() {
            chatWindow.style.display = 'flex';
            launcherIcon.style.display = 'none';
            closeIcon.style.display = 'inline-block';
            sessionStorage.setItem('copilot_window_open', 'true');
            userInput.focus();

            if (!historyLoaded) {
                loadChatHistory();
            }
            scrollToBottom();
        }

        function closeChatWindow() {
            chatWindow.style.display = 'none';
            launcherIcon.style.display = 'inline-block';
            closeIcon.style.display = 'none';
            sessionStorage.setItem('copilot_window_open', 'false');
        }

        function getOrCreateConversationId(key, uId) {
            let conv = localStorage.getItem(key);
            if (!conv) {
                conv = generateConversationId(uId);
                localStorage.setItem(key, conv);
            }
            return conv;
        }

        function generateConversationId(uId) {
            const prefix = uId ? `conv_u${uId}` : 'conv_guest';
            const randomPart = Math.random().toString(36).substring(2, 9);
            const timePart = Date.now().toString(36).substring(4);
            return `${prefix}_${timePart}${randomPart}`;
        }

        function updateConversationTag() {
            if (convTag) {
                const shortId = currentConvId.length > 16 
                    ? currentConvId.substring(0, 8) + '...' + currentConvId.slice(-4) 
                    : currentConvId;
                convTag.textContent = shortId;
                convTag.title = `Conversation ID: ${currentConvId}`;
            }
        }

        function startNewConversation() {
            currentConvId = generateConversationId(userId);
            localStorage.setItem(storageKey, currentConvId);
            updateConversationTag();

            // Clear non-welcome, non-indicator messages
            const welcomeMsg = document.getElementById('copilot-welcome-message');
            messagesContainer.innerHTML = '';
            if (welcomeMsg) {
                welcomeMsg.style.display = 'flex';
                messagesContainer.appendChild(welcomeMsg);
            } else {
                renderDefaultWelcome();
            }
            messagesContainer.appendChild(typingIndicator);
            historyLoaded = true;
            scrollToBottom();
            userInput.focus();
        }

        function renderDefaultWelcome() {
            const welcomeDiv = document.createElement('div');
            welcomeDiv.className = 'copilot-message copilot-message-bot';
            welcomeDiv.id = 'copilot-welcome-message';
            welcomeDiv.innerHTML = `
                <div class="copilot-msg-avatar"><i class="fa fa-cube"></i></div>
                <div class="copilot-msg-content">
                    <div class="copilot-bubble">
                        <p class="mb-1 font-weight-bold">Hi ${escapeHtml(username)}! 👋</p>
                        <p class="mb-2">I’m your <strong>Blog AI Copilot</strong>. I have real-time access to our entire blog repository, authors, categories, and articles.</p>
                        <p class="mb-2">Ask me anything or pick a quick topic below:</p>
                        <div class="copilot-suggestion-chips">
                            <button type="button" class="copilot-chip" data-prompt="What blogs are available on this platform?">📚 Available blogs?</button>
                            <button type="button" class="copilot-chip" data-prompt="What categories do we have and how many posts are in each?">🏷️ Explore categories</button>
                            <button type="button" class="copilot-chip" data-prompt="Can you summarize the most interesting finance or tech articles?">💡 Summarize articles</button>
                        </div>
                    </div>
                    <span class="copilot-msg-time">Just now</span>
                </div>
            `;
            messagesContainer.appendChild(welcomeDiv);
        }

        async function loadChatHistory() {
            historyLoaded = true;
            try {
                const response = await fetch(`${apiBase}/api/chat/history/${encodeURIComponent(currentConvId)}`, {
                    headers: { 'Accept': 'application/json' }
                });
                if (!response.ok) return;

                const history = await response.json();
                if (Array.isArray(history) && history.length > 0) {
                    // Hide the initial default welcome greeting if we have past messages
                    const welcomeMsg = document.getElementById('copilot-welcome-message');
                    if (welcomeMsg) welcomeMsg.style.display = 'none';

                    history.forEach(item => {
                        if (item.user_message) {
                            appendUserMessage(item.user_message, formatTimestamp(item.created_at));
                        }
                        if (item.bot_response) {
                            appendBotMessage(item.bot_response, [], formatTimestamp(item.created_at));
                        }
                    });
                    scrollToBottom();
                }
            } catch (err) {
                console.warn('Could not load chat history:', err);
            }
        }

        async function sendMessage(text) {
            appendUserMessage(text, 'Just now');
            userInput.value = '';
            userInput.disabled = true;
            sendBtn.disabled = true;

            // Show typing indicator
            showTypingIndicator();
            scrollToBottom();

            // Render cold-start helper notice if backend takes > 4 seconds
            let coldStartTimer = setTimeout(function () {
                showColdStartNotice();
            }, 4000);

            try {
                const response = await fetch(`${apiBase}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        message: text,
                        conversation_id: currentConvId
                    })
                });

                clearTimeout(coldStartTimer);
                removeColdStartNotice();
                hideTypingIndicator();

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    const errMsg = errData.detail || 'Service returned an error.';
                    appendBotMessage(`⚠️ **Error:** ${errMsg}`, [], 'Now');
                    return;
                }

                const data = await response.json();
                if (data.conversation_id && data.conversation_id !== currentConvId) {
                    currentConvId = data.conversation_id;
                    localStorage.setItem(storageKey, currentConvId);
                    updateConversationTag();
                }

                appendBotMessage(data.answer || 'No response returned.', data.sources || [], 'Just now');
            } catch (error) {
                clearTimeout(coldStartTimer);
                removeColdStartNotice();
                hideTypingIndicator();
                console.error('Chat error:', error);
                appendBotMessage('⚠️ **Connection Issue**: Unable to connect to Blog AI Copilot server. Please check your internet connection or verify the backend is online.', [], 'Now');
            } finally {
                userInput.disabled = false;
                sendBtn.disabled = false;
                userInput.focus();
                scrollToBottom();
            }
        }

        function appendUserMessage(text, timeStr) {
            const row = document.createElement('div');
            row.className = 'copilot-message copilot-message-user';
            row.innerHTML = `
                <div class="copilot-msg-content">
                    <div class="copilot-bubble">${escapeHtml(text)}</div>
                    <span class="copilot-msg-time">${timeStr || 'Just now'}</span>
                </div>
            `;
            messagesContainer.insertBefore(row, typingIndicator);
        }

        function appendBotMessage(text, sources, timeStr) {
            const row = document.createElement('div');
            row.className = 'copilot-message copilot-message-bot';

            let sourcesHtml = '';
            if (Array.isArray(sources) && sources.length > 0) {
                const sourceItems = sources.map((s, idx) => `
                    <div class="copilot-source-item">
                        <strong>${idx + 1}. ${escapeHtml(s.title || 'Untitled Post')}</strong>
                        ${s.category ? `&bull; <span class="badge badge-warning text-dark font-weight-normal">${escapeHtml(s.category)}</span>` : ''}
                        ${s.author ? `&bull; <em>By ${escapeHtml(s.author)}</em>` : ''}
                    </div>
                `).join('');

                sourcesHtml = `
                    <div class="copilot-sources-box">
                        <button type="button" class="copilot-sources-toggle">
                            <i class="fa fa-book"></i> Sources cited (${sources.length}) <i class="fa fa-caret-down"></i>
                        </button>
                        <div class="copilot-sources-list d-none">
                            ${sourceItems}
                        </div>
                    </div>
                `;
            }

            row.innerHTML = `
                <div class="copilot-msg-avatar"><i class="fa fa-cube"></i></div>
                <div class="copilot-msg-content">
                    <div class="copilot-bubble">
                        ${renderMarkdown(text)}
                        ${sourcesHtml}
                    </div>
                    <span class="copilot-msg-time">${timeStr || 'Just now'}</span>
                </div>
            `;

            // Setup toggle event for sources
            const toggleBtn = row.querySelector('.copilot-sources-toggle');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', function () {
                    const list = this.nextElementSibling;
                    if (list) list.classList.toggle('d-none');
                });
            }

            messagesContainer.insertBefore(row, typingIndicator);
        }

        function showTypingIndicator() {
            typingIndicator.style.display = 'flex';
        }

        function hideTypingIndicator() {
            typingIndicator.style.display = 'none';
        }

        function showColdStartNotice() {
            if (document.getElementById('copilot-cold-start-banner')) return;
            const banner = document.createElement('div');
            banner.id = 'copilot-cold-start-banner';
            banner.className = 'copilot-cold-start-alert';
            banner.innerHTML = `<i class="fa fa-spinner fa-spin"></i> <span>Waking up cloud server instance... Please hold on a moment.</span>`;
            messagesContainer.insertBefore(banner, typingIndicator);
            scrollToBottom();
        }

        function removeColdStartNotice() {
            const banner = document.getElementById('copilot-cold-start-banner');
            if (banner) banner.remove();
        }

        function scrollToBottom() {
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 60);
        }

        function formatTimestamp(raw) {
            if (!raw) return 'Just now';
            try {
                const date = new Date(raw);
                if (isNaN(date.getTime())) return 'Recently';
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch {
                return 'Recently';
            }
        }

        function escapeHtml(str) {
            if (!str) return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        /**
         * Clean & safe client-side Markdown formatter
         */
        function renderMarkdown(md) {
            if (!md) return '';

            // Escape standard HTML first
            let html = escapeHtml(md);

            // Code blocks
            html = html.replace(/```([\s\S]*?)```/g, function (match, p1) {
                return `<pre><code>${p1.trim()}</code></pre>`;
            });

            // Inline code
            html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

            // Headings (###, ##, #)
            html = html.replace(/^### (.*$)/gim, '<h4>$1</h4>');
            html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
            html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>');

            // Bold
            html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

            // Italic
            html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
            html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

            // Markdown Links [text](url)
            html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

            // Bullet lists (- or *)
            html = html.replace(/(?:^|\n)[-\*] (.*)/g, function (match, p1) {
                return `\n<li>${p1}</li>`;
            });
            html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
            // Clean consecutive duplicated <ul> tags
            html = html.replace(/<\/ul>\s*<ul>/g, '');

            // Ordered lists
            html = html.replace(/(?:^|\n)\d+\. (.*)/g, function (match, p1) {
                return `\n<oli>${p1}</oli>`;
            });
            html = html.replace(/(<oli>[\s\S]*?<\/oli>)/g, function (match) {
                return `<ol>${match.replace(/oli>/g, 'li>')}</ol>`;
            });
            html = html.replace(/<\/ol>\s*<ol>/g, '');

            // Paragraph line breaks
            html = html.replace(/\n{2,}/g, '</p><p>');
            html = html.replace(/\n/g, '<br>');

            return `<p>${html}</p>`;
        }
    }
})();
