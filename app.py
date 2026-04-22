from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import time
import random

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory storage
messages = {}
user_last_message = {}
users = {}

def generate_username():
    return f"WaveRider{random.randint(1000,9999)}"

@app.route("/")
def index():
    return render_template("index.html")

@socketio.on("connect")
def handle_connect():
    username = generate_username()
    print(f"### User connected: {username} ###")
    users[request.sid] = username
    emit("assign_username", username)

@socketio.on("send_message")
def handle_message(data):
    username = data["username"]
    text = data["text"]

    now = time.time()

    # Cooldown check (5 sec)
    if username in user_last_message:
        if now - user_last_message[username] < 5:
            emit("cooldown")
            return

    user_last_message[username] = now

    msg_id = str(random.randint(100000,999999))

    message = {
        "id": msg_id,
        "username": username,
        "text": text,
        "timestamp": now,
        "reactions": {"🔥":0, "😂":0, "💯":0}
    }

    messages[msg_id] = message

    emit("new_message", message, broadcast=True)

@socketio.on("react")
def handle_react(data):
    msg_id = data["id"]
    reaction = data["reaction"]

    if msg_id in messages:
        messages[msg_id]["reactions"][reaction] += 1
        emit("update_reactions", {
            "id": msg_id,
            "reactions": messages[msg_id]["reactions"]
        }, broadcast=True)

if __name__ == "__main__":
    socketio.run(app, debug=True, host="0.0.0.0")