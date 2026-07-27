from fastapi import FastAPI, Request
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

import json

try:
    if os.environ.get("FIREBASE_CREDENTIALS"):
        # Load from Vercel environment variables securely
        cred_dict = json.loads(os.environ.get("FIREBASE_CREDENTIALS"))
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase connected successfully via Environment Variable!")
    elif os.path.exists("serviceAccountKey.json"):
        # Load locally
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase connected successfully via Local File!")
    else:
        db = None
        print("Firebase credentials not found. Running with in-memory history.")
except Exception as e:
    db = None
    print(f"Firebase init error: {e}")

api_key = os.getenv("GEMINI_API_KEY")
if api_key and api_key != "your_gemini_api_key_here":
    genai.configure(api_key=api_key)
    # We will instantiate the GenerativeModel dynamically per request to find one that works.



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
        context = "Here is the live web data I found:\n\n"
        for idx, r in enumerate(results):
            context += f"{idx+1}. **{r.get('title')}**\n{r.get('body')}\n*Source: {r.get('href')}*\n\n"
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
            prompt = f"Based on the following web search results for '{args}', synthesize a clear, helpful answer:\n\n{search_data}"
            try:
                response = model.generate_content(prompt)
                return f"**Live Search Results for: {args}**\n\n{response.text}"
            except Exception as e:
                return search_data + f"\n\n*(Error generating AI summary: {e})*"
        return search_data
    elif cmd == "/help":
        return "Available commands:\n- `/search <query>` - Live web search\n- `/time` - Show current time\n- `/clear` - Clear chat history\n- `/help` - Show this message"
    else:
        return f"Unknown command: {cmd}. Type `/help` for available commands."

@app.post("/api/chat")
async def chat(request: Request):
    # Parse multipart form data
    form = await request.form()
    user_message = form.get("message", "").strip()
    file = form.get("file")
    
    if user_message.startswith("/"):
        bot_reply = handle_command(user_message)
        if db:
            try:
                cmd_ref = db.collection('chats').document()
                cmd_ref.set({'timestamp': firestore.SERVER_TIMESTAMP, 'user_message': user_message, 'bot_reply': bot_reply, 'is_command': True})
            except Exception as e:
                print(f"Error saving command to Firestore: {e}")
        return JSONResponse(content={"reply": bot_reply})
        
    # We no longer rely on a global 'model' variable
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        return JSONResponse(content={"reply": "⚠️ Gemini API key is not configured. Please add it to your .env file."})
        
    try:
        # Prepare contents for Gemini
        contents = []
        
        file_bytes = None
        mime_type = None
        # If an image file was uploaded, process it
        if file and file.filename:
            file_bytes = await file.read()
            mime_type = file.content_type
            chat_history.append({"role": "user", "content": f"{user_message} (Attached File: {file.filename})"})
        else:
            chat_history.append({"role": "user", "content": user_message})

        if file_bytes:
            contents.append({"mime_type": mime_type, "data": file_bytes})
        contents.append(user_message)
        
        # Robust Fallback Loop: Try all available models until one works
        available_models = []
        try:
            available_models = [m.name.replace("models/", "") for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        except:
            pass
            
        if not available_models:
            available_models = ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-pro', 'gemini-flash', 'gemini-1.5-pro', 'gemini-2.0-flash']
            
        response = None
        last_error = None
        
        for m_name in available_models:
            # Skip old vision-only models as they don't support multi-turn text well
            if 'vision' in m_name.lower(): continue 
            
            try:
                temp_model = genai.GenerativeModel(m_name)
                response = temp_model.generate_content(contents)
                print(f"Successfully used model: {m_name}")
                break # It worked! Exit the loop.
            except Exception as e:
                last_error = e
                print(f"Model {m_name} failed: {e}")
                continue # Try the next model
                
        if response is None:
            raise Exception(f"All available models rejected the request. Last error: {last_error}")
            
        bot_reply = response.text
        
        chat_history.append({"role": "model", "content": bot_reply})
        
        if db:
            try:
                chat_ref = db.collection('chats').document()
                chat_ref.set({'timestamp': firestore.SERVER_TIMESTAMP, 'user_message': user_message, 'bot_reply': bot_reply, 'has_attachment': bool(file)})
            except Exception as e:
                print(f"Error saving to Firestore: {e}")
                
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        bot_reply = f"Sorry, I encountered an error communicating with the AI. Error Details: {str(e)}"
        
    return JSONResponse(content={"reply": bot_reply})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
