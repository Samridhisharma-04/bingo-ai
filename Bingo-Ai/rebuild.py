import os
import shutil

src_dir = r"c:\Users\archi\OneDrive\Desktop\Radhu Chatbot"
dest_dir = r"c:\Users\archi\OneDrive\Desktop\Bingo-Ai"

os.makedirs(dest_dir, exist_ok=True)
os.makedirs(os.path.join(dest_dir, "static"), exist_ok=True)

# 1. requirements.txt
req_content = """fastapi
uvicorn
pydantic
google-generativeai
python-dotenv
duckduckgo-search
beautifulsoup4
firebase-admin
python-multipart
"""
with open(os.path.join(dest_dir, "requirements.txt"), "w") as f:
    f.write(req_content)

# 2. .env.example
with open(os.path.join(dest_dir, ".env.example"), "w") as f:
    f.write("GEMINI_API_KEY=your_gemini_api_key_here\n")

# 3. main.py
main_content = """from fastapi import FastAPI, Request, File, UploadFile, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
import time
import os
from datetime import datetime
from duckduckgo_search import DDGS
import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()

try:
    if os.path.exists("serviceAccountKey.json"):
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase connected successfully!")
    else:
        db = None
        print("Firebase serviceAccountKey.json not found. Running with in-memory history.")
except Exception as e:
    db = None
    print(f"Firebase init error: {e}")

api_key = os.getenv("GEMINI_API_KEY")
if api_key and api_key != "your_gemini_api_key_here":
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    vision_model = genai.GenerativeModel('gemini-1.5-flash') # Flash supports vision too!
else:
    model = None
    vision_model = None

app = FastAPI()

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

class MessageRequest(BaseModel):
    message: str

chat_history = []

@app.get("/", response_class=HTMLResponse)
async def read_index():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()

def perform_web_search(query: str) -> str:
    try:
        results = DDGS().text(query, max_results=3)
        if not results:
            return "No results found."
        context = "Here is the live web data I found:\\n\\n"
        for idx, r in enumerate(results):
            context += f"{idx+1}. **{r.get('title')}**\\n{r.get('body')}\\n*Source: {r.get('href')}*\\n\\n"
        return context
    except Exception as e:
        return f"Web search failed: {e}"

def handle_command(command_text: str) -> str:
    parts = command_text.split(maxsplit=1)
    cmd = parts[0].lower()
    args = parts[1] if len(parts) > 1 else ""
    
    if cmd == "/time":
        return f"The current system time is: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    elif cmd == "/clear":
        chat_history.clear()
        return "Chat history cleared."
    elif cmd == "/search":
        if not args:
            return "Please provide a query, e.g., `/search Latest news on AI`"
        search_data = perform_web_search(args)
        if model:
            prompt = f"Based on the following web search results for '{args}', synthesize a clear, helpful answer:\\n\\n{search_data}"
            try:
                response = model.generate_content(prompt)
                return f"**Live Search Results for: {args}**\\n\\n{response.text}"
            except Exception as e:
                return search_data + f"\\n\\n*(Error generating AI summary: {e})*"
        return search_data
    elif cmd == "/help":
        return "Available commands:\\n- `/search <query>` - Live web search\\n- `/time` - Show current time\\n- `/clear` - Clear chat history\\n- `/help` - Show this message"
    else:
        return f"Unknown command: {cmd}. Type `/help` for available commands."

@app.post("/api/chat")
async def chat(request: MessageRequest):
    user_message = request.message.strip()
    
    if user_message.startswith("/"):
        bot_reply = handle_command(user_message)
        if db:
            try:
                cmd_ref = db.collection('chats').document()
                cmd_ref.set({'timestamp': firestore.SERVER_TIMESTAMP, 'user_message': user_message, 'bot_reply': bot_reply, 'is_command': True})
            except Exception as e:
                print(f"Error saving command to Firestore: {e}")
        return JSONResponse(content={"reply": bot_reply})
        
    if not model:
        return JSONResponse(content={"reply": "⚠️ Gemini API key is not configured. Please add it to your .env file."})
        
    try:
        response = model.generate_content(user_message)
        bot_reply = response.text
        chat_history.append({"role": "user", "content": user_message})
        chat_history.append({"role": "model", "content": bot_reply})
        if db:
            try:
                chat_ref = db.collection('chats').document()
                chat_ref.set({'timestamp': firestore.SERVER_TIMESTAMP, 'user_message': user_message, 'bot_reply': bot_reply})
            except Exception as e:
                print(f"Error saving to Firestore: {e}")
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        bot_reply = "Sorry, I encountered an error communicating with the AI. Check console for details."
        
    return JSONResponse(content={"reply": bot_reply})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
"""
with open(os.path.join(dest_dir, "main.py"), "w", encoding="utf-8") as f:
    f.write(main_content)

# 4. static/index.html
html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bingo-Ai</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <link rel="stylesheet" href="/static/style.css">
</head>
<body>
    <div class="app-container">
        <aside class="sidebar collapsed" id="sidebar">
            <div class="sidebar-header"><h2>History</h2></div>
            <div class="sidebar-content"><p class="empty-text">No previous conversations.</p></div>
        </aside>

        <main class="main-content">
            <header class="top-nav">
                <button id="toggle-sidebar" class="icon-btn" aria-label="Toggle sidebar"><i data-lucide="menu"></i></button>
                <div class="brand"><h1 id="app-title">Bingo-Ai</h1></div>
                <div class="nav-actions"><button id="theme-toggle" class="icon-btn" aria-label="Toggle theme"><i data-lucide="moon"></i></button></div>
            </header>

            <div class="chat-container" id="chat-container">
                <div class="welcome-message">
                    <h2>Hello. I am Bingo.</h2>
                    <p>How can I help you today?</p>
                </div>
            </div>

            <div class="input-container">
                <div class="input-wrapper" id="drop-zone">
                    <button class="icon-btn attachment-btn" aria-label="Attach file" id="attach-btn"><i data-lucide="paperclip"></i></button>
                    <textarea id="message-input" placeholder="Ask Bingo anything or drag a file here..." rows="1" autofocus></textarea>
                    <button id="send-btn" class="send-btn" disabled><i data-lucide="send"></i></button>
                </div>
                <div class="input-footer"><p>Bingo-Ai can make mistakes. Verify important info.</p></div>
            </div>
        </main>
    </div>
    <script src="/static/script.js"></script>
    <script>lucide.createIcons();</script>
</body>
</html>
"""
with open(os.path.join(dest_dir, "static", "index.html"), "w", encoding="utf-8") as f:
    f.write(html_content)

# 5. static/style.css
css_content = """:root {
    --bg-color: #131314;
    --bg-surface: #1e1f20;
    --bg-surface-hover: #282a2c;
    --text-primary: #e3e3e3;
    --text-secondary: #c4c7c5;
    --border-color: #444746;
    --accent-color: #a8c7fa;
    --input-bg: #1e1f20;
    --font-family: 'Inter', sans-serif;
    --border-radius: 12px;
    --border-radius-pill: 24px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-family); background-color: var(--bg-color); color: var(--text-primary); display: flex; height: 100vh; overflow: hidden; }
.app-container { display: flex; width: 100%; height: 100%; }
.sidebar { width: 260px; background-color: var(--bg-surface); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; transition: transform 0.3s ease; }
.sidebar.collapsed { transform: translateX(-100%); position: absolute; height: 100%; z-index: 10; }
.sidebar-header { padding: 20px; }
.sidebar-content { padding: 0 20px; flex: 1; overflow-y: auto; }
.empty-text { color: var(--text-secondary); font-size: 0.9rem; }
.main-content { flex: 1; display: flex; flex-direction: column; position: relative; width: 100%; }
.top-nav { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; height: 64px; }
.brand h1 { font-size: 1.25rem; font-weight: 500; color: var(--text-primary); }
.icon-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s; }
.icon-btn:hover { background-color: var(--bg-surface-hover); color: var(--text-primary); }
.chat-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; align-items: center; scroll-behavior: smooth; }
.welcome-message { margin-top: 15vh; text-align: center; }
.welcome-message h2 { font-size: 3rem; background: -webkit-linear-gradient(45deg, #a8c7fa, #d0bcff, #ffb2b2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px; }
.welcome-message p { font-size: 1.2rem; color: var(--text-secondary); }
.message-wrapper { width: 100%; max-width: 800px; margin-bottom: 24px; display: flex; flex-direction: column; }
.message { padding: 12px 16px; border-radius: var(--border-radius); max-width: 85%; line-height: 1.5; font-size: 1rem; animation: fadeIn 0.3s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.message.user { align-self: flex-end; background-color: var(--bg-surface-hover); border-radius: 20px 20px 4px 20px; }
.message.ai { align-self: flex-start; background-color: transparent; }
.input-container { width: 100%; max-width: 800px; margin: 0 auto; padding: 0 20px 20px 20px; }
.input-wrapper { display: flex; align-items: flex-end; background-color: var(--input-bg); border: 1px solid var(--border-color); border-radius: var(--border-radius-pill); padding: 8px 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); transition: border-color 0.2s; gap: 8px; }
.input-wrapper:focus-within { border-color: var(--accent-color); }
.input-wrapper.dragover { border-color: var(--accent-color); background-color: var(--bg-surface-hover); }
textarea { flex: 1; background: transparent; border: none; color: var(--text-primary); font-family: var(--font-family); font-size: 1rem; resize: none; padding: 8px 0; max-height: 150px; outline: none; overflow-y: hidden; }
textarea::placeholder { color: var(--text-secondary); }
.send-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 8px; display: flex; align-items: center; justify-content: center; transition: color 0.2s; }
.send-btn:not(:disabled) { color: var(--accent-color); }
.send-btn:disabled { cursor: not-allowed; opacity: 0.5; }
.input-footer { text-align: center; margin-top: 10px; }
.input-footer p { font-size: 0.75rem; color: var(--text-secondary); }
.typing-indicator { display: flex; gap: 4px; padding: 12px 16px; align-self: flex-start; }
.dot { width: 6px; height: 6px; background-color: var(--text-secondary); border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; }
.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }

.message.ai p { margin-bottom: 12px; }
.message.ai p:last-child { margin-bottom: 0; }
.message.ai pre { background-color: #282c34; padding: 16px; border-radius: 8px; margin: 12px 0; overflow-x: auto; font-size: 0.9rem; position: relative; }
.message.ai code { font-family: 'Courier New', Courier, monospace; }
.message.ai p code { background-color: var(--bg-surface); padding: 2px 6px; border-radius: 4px; color: #ffb2b2; }
.copy-code-btn { position: absolute; top: 8px; right: 8px; background-color: rgba(255, 255, 255, 0.1); border: none; color: var(--text-secondary); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: background-color 0.2s; }
.copy-code-btn:hover { background-color: rgba(255, 255, 255, 0.2); color: var(--text-primary); }
.copy-code-btn i { width: 14px; height: 14px; }
"""
with open(os.path.join(dest_dir, "static", "style.css"), "w", encoding="utf-8") as f:
    f.write(css_content)

# 6. static/script.js
js_content = """const messageInput = document.getElementById('message-input');
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

// Drag and drop UI (Logic to be implemented in backend later)
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, preventDefaults, false);
});
function preventDefaults (e) { e.preventDefault(); e.stopPropagation(); }
['dragenter', 'dragover'].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false); });
['dragleave', 'drop'].forEach(eventName => { dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false); });
dropZone.addEventListener('drop', handleDrop, false);
function handleDrop(e) {
  let dt = e.dataTransfer;
  let files = dt.files;
  if(files.length > 0) {
      addMessageToChat(`Attached file: ${files[0].name}`, 'user');
      addMessageToChat("File uploading & vision analysis will be connected to the backend soon!", 'ai');
  }
}
attachBtn.addEventListener('click', () => {
    alert("Attachment click works! File dialogue integration coming next.");
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
        const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
        const data = await response.json();
        removeTypingIndicator(indicatorId);
        addMessageToChat(data.reply, 'ai');
    } catch (error) {
        removeTypingIndicator(indicatorId);
        addMessageToChat("Sorry, I encountered an error communicating with the server.", 'ai');
    }
}

function addMessageToChat(text, sender) {
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
    indicator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    wrapper.appendChild(indicator);
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return id;
}
function removeTypingIndicator(id) {
    const element = document.getElementById(id);
    if (element) element.remove();
}
"""
with open(os.path.join(dest_dir, "static", "script.js"), "w", encoding="utf-8") as f:
    f.write(js_content)

# Copy the serviceAccountKey.json if it exists in the old dir
old_key = os.path.join(src_dir, "serviceAccountKey.json")
if os.path.exists(old_key):
    shutil.copy(old_key, os.path.join(dest_dir, "serviceAccountKey.json"))

print("Project restored successfully to Bingo-Ai!")
