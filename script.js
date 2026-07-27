const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatContainer = document.getElementById('chat-container');
const themeToggle = document.getElementById('theme-toggle');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const sidebar = document.getElementById('sidebar');
const dropZone = document.getElementById('drop-zone');
const attachBtn = document.getElementById('attach-btn');

messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if (this.value.trim().length > 0) { sendBtn.removeAttribute('disabled'); } 
    else { sendBtn.setAttribute('disabled', 'true'); }
});

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

toggleSidebarBtn.addEventListener('click', () => { sidebar.classList.toggle('collapsed'); });

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    themeToggle.querySelector('i').setAttribute('data-lucide', 'moon');
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const icon = themeToggle.querySelector('i');
    if (document.body.classList.contains('light-theme')) {
        icon.setAttribute('data-lucide', 'moon');
        localStorage.setItem('theme', 'light');
    } else {
        icon.setAttribute('data-lucide', 'sun');
        localStorage.setItem('theme', 'dark');
    }
    lucide.createIcons();
});

// --- Session Manager Logic ---
let chatSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
let currentSessionId = null;

const sidebarHistoryList = document.getElementById('sidebar-history-list');
const newChatBtn = document.getElementById('new-chat-btn');
const welcomeMessage = document.querySelector('.welcome-message');

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
        item.textContent = session.title;
        item.onclick = () => loadSession(session.id);
        sidebarHistoryList.appendChild(item);
    });
}

function loadSession(id) {
    currentSessionId = id;
    const session = chatSessions.find(s => s.id === id);
    if (!session) return;
    
    // Clear chat container but keep welcome message hidden
    const messages = chatContainer.querySelectorAll('.message-wrapper');
    messages.forEach(m => m.remove());
    if (welcomeMessage) welcomeMessage.style.display = 'none';
    
    session.messages.forEach(msg => addMessageToChat(msg.text, msg.sender, false));
    renderSidebar();
    if(window.innerWidth <= 768) sidebar.classList.add('collapsed');
}

newChatBtn.addEventListener('click', () => {
    currentSessionId = null;
    const messages = chatContainer.querySelectorAll('.message-wrapper');
    messages.forEach(m => m.remove());
    if (welcomeMessage) welcomeMessage.style.display = 'block';
    renderSidebar();
    if(window.innerWidth <= 768) sidebar.classList.add('collapsed');
});

window.addEventListener('DOMContentLoaded', () => {
    // We do NOT auto-load the last chat. We start on a fresh screen like ChatGPT.
    renderSidebar();
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
      const attachLabel = document.createElement('div');
      attachLabel.className = 'attachment-label';
      attachLabel.innerHTML = `<span><i data-lucide="file"></i> ${files[0].name}</span><button onclick="clearAttachment()"><i data-lucide="x"></i></button>`;
      document.querySelector('.input-wrapper').prepend(attachLabel);
      lucide.createIcons();
      messageInput.focus();
  }
}

function clearAttachment() {
    currentAttachedFile = null;
    const label = document.querySelector('.attachment-label');
    if (label) label.remove();
}

attachBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = e => { 
        if(e.target.files.length > 0) {
            handleDrop({ dataTransfer: { files: e.target.files }, preventDefault: ()=>{} });
        }
    };
    input.click();
});

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    addMessageToChat(text, 'user');
    messageInput.value = '';
    messageInput.style.height = 'auto';
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
        addMessageToChat(data.reply, 'ai');
    } catch (error) {
        removeTypingIndicator(indicatorId);
        addMessageToChat("Sorry, I encountered an error communicating with the server.", 'ai');
    }
}

function addMessageToChat(text, sender, save = true) {
    if (save) {
        if (!currentSessionId) {
            // Create a new session
            currentSessionId = Date.now();
            const title = text.length > 30 ? text.substring(0, 30) + '...' : text;
            chatSessions.push({ id: currentSessionId, title: title, messages: [] });
        }
        const session = chatSessions.find(s => s.id === currentSessionId);
        if (session) {
            session.messages.push({ text, sender });
            localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
            renderSidebar();
        }
    }
    
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
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
            block.style.position = 'relative';
            block.appendChild(btn);
        });
        lucide.createIcons();
    } else {
        messageDiv.textContent = text;
    }
    wrapper.appendChild(messageDiv);
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTypingIndicator() {
    const id = 'indicator-' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
    wrapper.id = id;
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator ai';
    indicator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div><span class="thinking-text">Thinking...</span>';
    wrapper.appendChild(indicator);
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return id;
}
function removeTypingIndicator(id) {
    const element = document.getElementById(id);
    if (element) element.remove();
}
