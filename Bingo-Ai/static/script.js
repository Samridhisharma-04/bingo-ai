const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatContainer = document.getElementById('chat-container');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const sidebar = document.getElementById('sidebar');
const dropZone = document.getElementById('drop-zone');
const attachBtn = document.getElementById('attach-btn');
const charCount = document.getElementById('char-count');

// Theme Elements
const themeSwitch = document.getElementById('theme-toggle-switch');
const pillLight = document.getElementById('pill-light');
const pillDark = document.getElementById('pill-dark');
const themeIconSidebar = document.getElementById('theme-icon-sidebar');

// Active Chat Elements
const activeChatInfo = document.getElementById('active-chat-info');
const activeChatTitle = document.getElementById('active-chat-title');
const clearCurrentChatBtn = document.getElementById('clear-current-chat');
const clearAllBtn = document.getElementById('clear-all-btn');

const MAX_CHARS = 4000;

// Input handling
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    
    const len = this.value.length;
    charCount.textContent = `${len} / ${MAX_CHARS}`;
    
    if (len > 0 && len <= MAX_CHARS) { 
        sendBtn.removeAttribute('disabled'); 
    } else { 
        sendBtn.setAttribute('disabled', 'true'); 
    }
});

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        if(!sendBtn.disabled) sendMessage(); 
    }
});

toggleSidebarBtn.addEventListener('click', () => { 
    sidebar.classList.toggle('open'); 
    document.getElementById('sidebar-overlay').classList.toggle('open');
});

document.getElementById('sidebar-overlay').addEventListener('click', () => {
    sidebar.classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
});

// Theme Logic
function setTheme(isLight) {
    if (isLight) {
        document.body.classList.add('light-theme');
        themeSwitch.checked = false;
        themeIconSidebar.setAttribute('data-lucide', 'sun');
        pillLight.classList.add('active');
        pillDark.classList.remove('active');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-theme');
        themeSwitch.checked = true;
        themeIconSidebar.setAttribute('data-lucide', 'moon');
        pillDark.classList.add('active');
        pillLight.classList.remove('active');
        localStorage.setItem('theme', 'dark');
    }
    lucide.createIcons();
}

const savedTheme = localStorage.getItem('theme');
setTheme(savedTheme === 'light');

themeSwitch.addEventListener('change', (e) => setTheme(!e.target.checked));
pillLight.addEventListener('click', () => setTheme(true));
pillDark.addEventListener('click', () => setTheme(false));


// --- Session Manager Logic ---
let chatSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
let currentSessionId = null;

const sidebarHistoryList = document.getElementById('sidebar-history-list');
const newChatBtn = document.getElementById('new-chat-btn');
const welcomeMessage = document.getElementById('welcome-message');

function updateActiveChatHeader(title) {
    if (title) {
        activeChatInfo.classList.remove('hidden');
        clearCurrentChatBtn.classList.remove('hidden');
        activeChatTitle.textContent = title;
    } else {
        activeChatInfo.classList.add('hidden');
        clearCurrentChatBtn.classList.add('hidden');
    }
}

// Session History View Logic
const viewHistoryBtn = document.getElementById('view-history-btn');
const closeHistoryBtn = document.getElementById('close-history-btn');
const searchHistoryInput = document.getElementById('history-search-input');
const historyTableBody = document.getElementById('history-table-body');
const pageNumbersContainer = document.getElementById('page-numbers');
const pagePrevBtn = document.getElementById('page-prev');
const pageNextBtn = document.getElementById('page-next');
let historyCurrentPage = 1;
const historyPerPage = 5;

function renderSessionHistoryTable(filterText = '') {
    historyTableBody.innerHTML = '';
    const filteredSessions = chatSessions.filter(s => s.title.toLowerCase().includes(filterText.toLowerCase()));
    filteredSessions.sort((a,b) => b.id - a.id);
    
    const totalPages = Math.ceil(filteredSessions.length / historyPerPage) || 1;
    if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
    
    const startIdx = (historyCurrentPage - 1) * historyPerPage;
    const paginatedSessions = filteredSessions.slice(startIdx, startIdx + historyPerPage);
    
    if (paginatedSessions.length === 0) {
        historyTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);">No conversations found.</td></tr>`;
    } else {
        paginatedSessions.forEach(session => {
            const tr = document.createElement('tr');
            tr.onclick = () => selectSession(session.id);
            tr.innerHTML = `
                <td class="title-col"><i data-lucide="message-square"></i> ${session.title}</td>
                <td>${session.messages ? session.messages.length : 0}</td>
                <td>${session.time}</td>
                <td style="text-align:right;"><i data-lucide="more-vertical" style="width:18px;height:18px;color:var(--text-secondary);"></i></td>
            `;
            historyTableBody.appendChild(tr);
        });
        lucide.createIcons();
    }
    
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    pageNumbersContainer.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const span = document.createElement('span');
        span.textContent = i;
        if (i === historyCurrentPage) span.className = 'active';
        span.onclick = () => { historyCurrentPage = i; renderSessionHistoryTable(searchHistoryInput.value); };
        pageNumbersContainer.appendChild(span);
    }
    pagePrevBtn.disabled = historyCurrentPage === 1;
    pageNextBtn.disabled = historyCurrentPage === totalPages;
}

pagePrevBtn.addEventListener('click', () => {
    if (historyCurrentPage > 1) { historyCurrentPage--; renderSessionHistoryTable(searchHistoryInput.value); }
});
pageNextBtn.addEventListener('click', () => {
    historyCurrentPage++; renderSessionHistoryTable(searchHistoryInput.value);
});

searchHistoryInput.addEventListener('input', (e) => {
    historyCurrentPage = 1;
    renderSessionHistoryTable(e.target.value);
});

if (viewHistoryBtn) {
    viewHistoryBtn.addEventListener('click', () => {
        document.querySelector('.main-content').style.display = 'none';
        document.getElementById('session-history-view').style.display = 'flex';
        historyCurrentPage = 1;
        searchHistoryInput.value = '';
        renderSessionHistoryTable();
        if(window.innerWidth <= 768) {
            sidebar.classList.remove('open');
            document.getElementById('sidebar-overlay').classList.remove('open');
        }
    });
}

if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener('click', () => {
        document.getElementById('session-history-view').style.display = 'none';
        document.querySelector('.main-content').style.display = 'flex';
    });
}

function renderSidebar() {
    sidebarHistoryList.innerHTML = '';
    if (chatSessions.length === 0) {
        sidebarHistoryList.innerHTML = '<p class="empty-text">No previous conversations.</p>';
        return;
    }
    // Render in reverse chronological order
    [...chatSessions].reverse().forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item' + (session.id === currentSessionId ? ' active' : '');
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'session-info';
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = session.title;
        titleSpan.className = 'session-title';
        
        const timeSpan = document.createElement('span');
        timeSpan.textContent = session.time || 'Just now';
        timeSpan.className = 'session-time';
        
        infoDiv.appendChild(titleSpan);
        infoDiv.appendChild(timeSpan);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-chat-btn';
        deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
        deleteBtn.setAttribute('aria-label', 'Delete chat');
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteSession(session.id);
        };
        
        item.appendChild(infoDiv);
        item.appendChild(deleteBtn);
        item.onclick = () => loadSession(session.id);
        sidebarHistoryList.appendChild(item);
    });
    lucide.createIcons();
}

function selectSession(id) {
    document.getElementById('session-history-view').style.display = 'none';
    document.querySelector('.main-content').style.display = 'flex';
    currentSessionId = id;
    const session = chatSessions.find(s => s.id === id);
    if (!session) return;
    
    chatContainer.querySelectorAll('.message-wrapper').forEach(m => m.remove());
    if (welcomeMessage) welcomeMessage.style.display = 'none';
    
    session.messages.forEach(msg => addMessageToChat(msg.text, msg.sender, false, msg.timestamp));
    updateActiveChatHeader(session.title);
    renderSidebar();
    if(window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('open');
    }
}

function deleteSession(id) {
    chatSessions = chatSessions.filter(s => s.id !== id);
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
    
    if (currentSessionId === id) {
        currentSessionId = null;
        const messages = chatContainer.querySelectorAll('.message-wrapper');
        messages.forEach(m => m.remove());
        if (welcomeMessage) welcomeMessage.style.display = 'flex';
        updateActiveChatHeader(null);
    }
    renderSidebar();
}

function loadSession(id) {
    currentSessionId = id;
    const session = chatSessions.find(s => s.id === id);
    if (!session) return;
    
    // Clear chat container but keep welcome message hidden
    const messages = chatContainer.querySelectorAll('.message-wrapper');
    messages.forEach(m => m.remove());
    if (welcomeMessage) welcomeMessage.style.display = 'none';
    
    session.messages.forEach(msg => addMessageToChat(msg.text, msg.sender, false, msg.timestamp));
    updateActiveChatHeader(session.title);
    renderSidebar();
    if(window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('open');
    }
}

document.getElementById('new-chat-btn').addEventListener('click', () => {
    document.getElementById('session-history-view').style.display = 'none';
    document.querySelector('.main-content').style.display = 'flex';
    currentSessionId = null;
    chatContainer.querySelectorAll('.message-wrapper').forEach(m => m.remove());
    if (welcomeMessage) welcomeMessage.style.display = 'flex';
    updateActiveChatHeader(null);
    renderSidebar();
    if(window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('open');
    }
});

clearCurrentChatBtn.addEventListener('click', () => {
    if(currentSessionId) {
        const session = chatSessions.find(s => s.id === currentSessionId);
        if (session) {
            session.messages = [];
            localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
            const messages = chatContainer.querySelectorAll('.message-wrapper');
            messages.forEach(m => m.remove());
            if (welcomeMessage) welcomeMessage.style.display = 'flex';
            updateActiveChatHeader(null);
        }
    }
});

const editChatBtn = document.querySelector('.edit-chat-btn');
editChatBtn.addEventListener('click', () => {
    if (!currentSessionId) return;
    const session = chatSessions.find(s => s.id === currentSessionId);
    if (session) {
        const newTitle = prompt("Enter new chat title:", session.title);
        if (newTitle && newTitle.trim().length > 0) {
            session.title = newTitle.trim();
            localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
            updateActiveChatHeader(session.title);
            renderSidebar();
        }
    }
});

clearAllBtn.addEventListener('click', () => {
    if(confirm("Are you sure you want to clear all chat history?")) {
        chatSessions = [];
        localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
        newChatBtn.click();
    }
});

function getCurrentTimeString() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

window.addEventListener('DOMContentLoaded', () => {
    renderSidebar();
    updateActiveChatHeader(null);
});

// Drag and drop UI (Logic to be implemented in backend later)
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, preventDefaults, false);
});
function preventDefaults (e) { e.preventDefault(); e.stopPropagation(); }
['dragenter', 'dragover'].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false); });
['dragleave', 'drop'].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false); });
dropZone.addEventListener('drop', handleDrop, false);
let currentAttachedFile = null;

function handleDrop(e) {
  let dt = e.dataTransfer;
  let files = dt.files;
  if(files.length > 0) {
      currentAttachedFile = files[0];
      document.getElementById('attachment-preview').style.display = 'flex';
      document.getElementById('attachment-name').textContent = currentAttachedFile.name;
      sendBtn.removeAttribute('disabled');
  }
}

function clearAttachment() {
    currentAttachedFile = null;
    fileInput.value = '';
    document.getElementById('attachment-preview').style.display = 'none';
    if (messageInput.value.trim().length === 0) {
        sendBtn.setAttribute('disabled', 'true');
    }
}

document.getElementById('remove-attachment-btn').addEventListener('click', clearAttachment);

const fileInput = document.createElement('input');
fileInput.type = 'file';

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        currentAttachedFile = e.target.files[0];
        document.getElementById('attachment-preview').style.display = 'flex';
        document.getElementById('attachment-name').textContent = currentAttachedFile.name;
        sendBtn.removeAttribute('disabled');
    }
});

attachBtn.addEventListener('click', () => {
    fileInput.click();
});

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !currentAttachedFile) return;
    
    const timestamp = getCurrentTimeString();
    addMessageToChat(text, 'user', true, timestamp);
    
    messageInput.value = '';
    messageInput.style.height = 'auto';
    charCount.textContent = `0 / ${MAX_CHARS}`;
    sendBtn.setAttribute('disabled', 'true');
    
    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.style.display = 'none';
    
    const indicatorId = showTypingIndicator();
    
    try {
        const formData = new FormData();
        formData.append('message', text);
        if (currentAttachedFile) {
            formData.append('file', currentAttachedFile);
            clearAttachment();
        }

        const response = await fetch('/api/chat', { 
            method: 'POST', 
            body: formData 
        });
        const data = await response.json();
        removeTypingIndicator(indicatorId);
        addMessageToChat(data.reply, 'ai', true, getCurrentTimeString());
    } catch (error) {
        removeTypingIndicator(indicatorId);
        addMessageToChat("Sorry, I encountered an error communicating with the server.", 'ai', true, getCurrentTimeString());
    }
}

function addMessageToChat(text, sender, save = true, timestamp = '') {
    if (save) {
        if (!currentSessionId) {
            currentSessionId = Date.now();
            const title = text.length > 30 ? text.substring(0, 30) + '...' : text;
            chatSessions.push({ id: currentSessionId, title: title, time: 'Today, ' + timestamp, messages: [] });
            updateActiveChatHeader(title);
        }
        const session = chatSessions.find(s => s.id === currentSessionId);
        if (session) {
            session.messages.push({ text, sender, timestamp });
            localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
            renderSidebar();
        }
    }
    
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
    
    const contentRow = document.createElement('div');
    contentRow.className = 'message-content-row';
    
    // Avatar
    const avatar = document.createElement('div');
    avatar.className = `message-avatar ${sender}`;
    if (sender === 'ai') {
        avatar.innerHTML = '<i data-lucide="bot"></i>';
    } else {
        avatar.textContent = 'U';
    }
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.style.flex = "1";
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    if (sender === 'ai') {
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) { return hljs.highlight(code, { language: lang }).value; }
                return hljs.highlightAuto(code).value;
            }, breaks: true
        });
        messageDiv.innerHTML = marked.parse(text);
        messageDiv.querySelectorAll('pre').forEach((block) => {
            const btn = document.createElement('button');
            btn.className = 'copy-code-btn';
            btn.innerHTML = '<i data-lucide="copy"></i> Copy';
            btn.onclick = () => {
                navigator.clipboard.writeText(block.innerText).then(() => {
                    btn.innerHTML = '<i data-lucide="check"></i> Copied';
                    setTimeout(() => { btn.innerHTML = '<i data-lucide="copy"></i> Copy'; lucide.createIcons(); }, 2000);
                });
            };
            block.appendChild(btn);
        });
    } else {
        messageDiv.textContent = text;
    }
    
    messageContent.appendChild(messageDiv);
    
    // Add footers
    if (sender === 'user') {
        const footer = document.createElement('div');
        footer.className = 'user-msg-time';
        footer.innerHTML = `${timestamp} <i class="double-check" data-lucide="check-check"></i>`;
        messageContent.appendChild(footer);
    } else if (sender === 'ai') {
        const footer = document.createElement('div');
        footer.className = 'ai-msg-footer';
        
        const timeSpan = document.createElement('span');
        timeSpan.textContent = timestamp;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn';
        copyBtn.innerHTML = '<i data-lucide="copy"></i>';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.innerHTML = '<i data-lucide="check"></i>';
                lucide.createIcons();
                setTimeout(() => { copyBtn.innerHTML = '<i data-lucide="copy"></i>'; lucide.createIcons(); }, 2000);
            });
        };
        
        const thumbsUpBtn = document.createElement('button');
        thumbsUpBtn.className = 'action-btn';
        thumbsUpBtn.innerHTML = '<i data-lucide="thumbs-up"></i>';
        
        const thumbsDownBtn = document.createElement('button');
        thumbsDownBtn.className = 'action-btn';
        thumbsDownBtn.innerHTML = '<i data-lucide="thumbs-down"></i>';
        
        thumbsUpBtn.onclick = () => {
            thumbsUpBtn.classList.add('active-feedback');
            thumbsDownBtn.classList.remove('active-feedback');
        };
        thumbsDownBtn.onclick = () => {
            thumbsDownBtn.classList.add('active-feedback');
            thumbsUpBtn.classList.remove('active-feedback');
        };
        
        const regenBtn = document.createElement('button');
        regenBtn.className = 'action-btn';
        regenBtn.innerHTML = '<i data-lucide="rotate-cw"></i>';
        regenBtn.onclick = () => {
            if (!currentSessionId) return;
            const session = chatSessions.find(s => s.id === currentSessionId);
            if (session && session.messages.length > 0) {
                let lastUserMsg = '';
                for(let i = session.messages.length - 1; i >= 0; i--){
                    if(session.messages[i].sender === 'user'){
                        lastUserMsg = session.messages[i].text;
                        break;
                    }
                }
                if (lastUserMsg) {
                    messageInput.value = lastUserMsg;
                    messageInput.style.height = 'auto';
                    charCount.textContent = `${lastUserMsg.length} / ${MAX_CHARS}`;
                    sendBtn.removeAttribute('disabled');
                    messageInput.focus();
                }
            }
        };

        footer.appendChild(timeSpan);
        footer.appendChild(copyBtn);
        footer.appendChild(thumbsUpBtn);
        footer.appendChild(thumbsDownBtn);
        footer.appendChild(regenBtn);
        
        messageContent.appendChild(footer);
    }
    
    contentRow.appendChild(avatar);
    contentRow.appendChild(messageContent);
    wrapper.appendChild(contentRow);
    
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    lucide.createIcons();
}

function showTypingIndicator() {
    const id = 'indicator-' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
    wrapper.id = id;
    
    const contentRow = document.createElement('div');
    contentRow.className = 'message-content-row';
    
    const avatar = document.createElement('div');
    avatar.className = `message-avatar ai`;
    avatar.innerHTML = '<i data-lucide="bot"></i>';
    
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div><span class="thinking-text">Thinking...</span>';
    
    contentRow.appendChild(avatar);
    contentRow.appendChild(indicator);
    wrapper.appendChild(contentRow);
    
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    lucide.createIcons();
    return id;
}

function removeTypingIndicator(id) {
    const element = document.getElementById(id);
    if (element) element.remove();
}
