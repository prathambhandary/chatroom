from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import time
import random
import uuid
import threading

lock = threading.Lock()

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory storage
messages = {}
user_last_message = {}
users = {}
typing_users = {}

KILL_COOLDOWN = 50  # seconds
VALID_REACTIONS = {"🔥", "😂", "💯"}
with open("static/usernames.txt", "r") as f:
        USERNAMES = f.read().splitlines()

def generate_username():
    available = list(set(USERNAMES) - set(users.values()))

    if available:
        return random.choice(available)
    
    return f"user_{random.randint(1000,9999)}"

@app.route("/")  
def index():
    return render_template("index.html")

@socketio.on("connect")
def handle_connect():
    now = time.time()

    username = generate_username()
    print(f"### User connected: {username} ###")

    emit("assign_username", username)
    with lock:
        users[request.sid] = username
        count = len(users)

    socketio.emit("user_count", count)
    socketio.emit("user_joined", {"username": username})

    with lock:
        active_messages = []

        for msg in messages.values():
            age = now - msg["timestamp"]

            if age < KILL_COOLDOWN:
                msg_copy = msg.copy()
                msg_copy["remaining"] = KILL_COOLDOWN - age
                active_messages.append(msg_copy)

    emit("initial_messages", active_messages)

@socketio.on("disconnect")
def handle_disconnect():
    with lock:
        username = users.pop(request.sid, None)
        user_last_message.pop(request.sid, None)
        typing_users.pop(request.sid, None)
        count = len(users)
    if username:
        print(f"--- User disconnected: {username} ---")
        socketio.emit("user_count", count)
        socketio.emit("user_left", {"username": username})

@socketio.on("send_message")
def handle_message(data):
    username = users.get(request.sid)
    if not username:
        return
    text = data["text"]

    text = text.strip()

    if not text or len(text) > 80:
        return

    now = time.time()

    # Cooldown check (5 sec)
    if request.sid in user_last_message:
        if now - user_last_message[request.sid] < 5:
            emit("cooldown")
            return

    user_last_message[request.sid] = now

    msg_id = str(uuid.uuid4())

    message = {
        "id": msg_id,
        "username": username,
        "text": text,
        "timestamp": now,
        "reactions": {"🔥":0, "😂":0, "💯":0}
    }

    with lock:
        messages[msg_id] = message

    msg_copy = message.copy()
    msg_copy["remaining"] = KILL_COOLDOWN

    emit("new_message", msg_copy, broadcast=True)

@app.route("/messages")
def get_messages():
    return {
        "messages": list(messages.values()),
        "users": list(users.values()),
        "user_count": len(users)
    }

@socketio.on("react")
def handle_react(data):
    msg_id = data["id"]
    reaction = data["reaction"]

    if reaction not in VALID_REACTIONS:
        return

    with lock:
        if msg_id not in messages:
            return

        if time.time() - messages[msg_id]["timestamp"] > KILL_COOLDOWN:
            return

        messages[msg_id]["reactions"][reaction] += 1
        updated = messages[msg_id]["reactions"]

    emit("update_reactions", {
        "id": msg_id,
        "reactions": updated
    }, broadcast=True)

@socketio.on("typing")
def handle_typing():
    now = time.time()
    sid = request.sid

    with lock:
        typing_users[sid] = now

        # remove inactive users
        typing_users_copy = {
            s: t for s, t in typing_users.items()
            if now - t < 3
        }
        typing_users.clear()
        typing_users.update(typing_users_copy)

        count = len(typing_users)

    socketio.emit("typing_count", count)

def cleanup_messages():
    while True:
        now = time.time()
        with lock:
            for msg_id in list(messages.keys()):
                if now - messages[msg_id]["timestamp"] > KILL_COOLDOWN:
                    del messages[msg_id]
                    socketio.emit("delete_message", {"id": msg_id})
            typing_users_copy = {
                s: t for s, t in typing_users.items()
                if now - t < 3
            }
            typing_users.clear()
            typing_users.update(typing_users_copy)
        time.sleep(5)

if __name__ == "__main__":
    threading.Thread(target=cleanup_messages, daemon=True).start()
    socketio.run(app, debug=True, host="0.0.0.0")