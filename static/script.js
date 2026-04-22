const socket = io();

let username = "";
let cooldown = false;
let lastTypingEmit = 0;

// ======================
// 🔥 USER ASSIGN
// ======================
socket.on("assign_username", (name) => {
    username = name;
    document.getElementById("username").innerText = `(${name})`;
});

// ======================
// 🚀 SEND MESSAGE
// ======================
function sendMessage() {
    const input = document.getElementById("msgInput");

    if (cooldown || input.value.trim() === "") return;

    socket.emit("send_message", {
        text: input.value
    });

    input.value = "";
    startCooldown();
}

// ======================
// ⏳ COOLDOWN
// ======================
function startCooldown() {
    cooldown = true;
    let time = 5;
    const cd = document.getElementById("cooldown");

    const interval = setInterval(() => {
        cd.innerText = `Wait ${time}s`;
        time--;

        if (time < 0) {
            clearInterval(interval);
            cooldown = false;
            cd.innerText = "";
        }
    }, 1000);
}

// ======================
// 🧠 RENDER MESSAGE
// ======================
function renderMessage(msg) {
    if (document.getElementById(msg.id)) return; // prevent duplicate

    const chat = document.getElementById("chat");

    const div = document.createElement("div");
    div.className = "message";
    div.id = msg.id;

    const isMe = msg.username === username;

    div.innerHTML = `
        <b ${isMe ? 'style="color:#22c55e"' : ""}>
            ${msg.username}${isMe ? " (you)" : ""}
        </b>: ${msg.text}
        <div class="reactions">
            ${Object.keys(msg.reactions).map(r =>
                `<span onclick="react('${msg.id}','${r}')">${r} ${msg.reactions[r]}</span>`
            ).join("")}
        </div>
    `;

    // ✨ smooth entry animation
    div.style.transform = "translateY(10px)";
    div.style.opacity = "0";

    chat.prepend(div);

    setTimeout(() => {
        div.style.transform = "translateY(0)";
        div.style.opacity = "1";
    }, 10);
}

// ======================
// 🔁 INITIAL SYNC
// ======================
socket.on("new_message", (msg) => {
    renderMessage(msg);

    if (msg.remaining) {
        const dyingTime = Math.max(0, (msg.remaining - 5) * 1000);

        setTimeout(() => {
            const el = document.getElementById(msg.id);
            if (el) el.classList.add("dying");
        }, dyingTime);

        setTimeout(() => {
            removeMessage(msg.id);
        }, msg.remaining * 1000);
    }
});

// ======================
// ❌ REMOVE MESSAGE
// ======================
function removeMessage(id) {
    const msgDiv = document.getElementById(id);
    if (!msgDiv) return;

    msgDiv.style.opacity = "0";
    setTimeout(() => msgDiv.remove(), 300);
}

// backend-driven delete
socket.on("delete_message", (data) => {
    removeMessage(data.id);
}); 

// ======================
// 🔥 REACTIONS
// ======================
function react(id, reaction) {
    socket.emit("react", { id, reaction });
}

socket.on("update_reactions", (data) => {
    const msgDiv = document.getElementById(data.id);
    if (!msgDiv) return;

    const reactionsDiv = msgDiv.querySelector(".reactions");

    reactionsDiv.innerHTML = Object.keys(data.reactions).map(r =>
        `<span onclick="react('${data.id}','${r}')">${r} ${data.reactions[r]}</span>`
    ).join("");
});

// ======================
// 👥 USER COUNT
// ======================
socket.on("user_count", (count) => {
    const el = document.getElementById("userCount");

    el.style.opacity = "0.5";

    setTimeout(() => {
        el.innerText = `🟢 ${count} online`;
        el.style.opacity = "1";
    }, 150);
});

// ======================
// ✍️ TYPING INDICATOR
// ======================
socket.on("typing_count", (count) => {
    const el = document.getElementById("typingStatus");

    if (count === 0) {
        el.innerText = "";
    } else {
        el.innerText = `🔥 ${count} typing...`;
    }
});

// throttle typing event
document.getElementById("msgInput").addEventListener("input", () => {
    const now = Date.now();

    if (now - lastTypingEmit > 1000) {
        socket.emit("typing");
        lastTypingEmit = now;
    }
});

// ======================
// 🔔 NOTIFICATIONS
// ======================
function showNotice(text) {
    const box = document.getElementById("notifications");

    const div = document.createElement("div");
    div.className = "notice";
    div.innerText = text;

    box.appendChild(div);

    // limit stack
    if (box.children.length > 5) {
        box.removeChild(box.firstChild);
    }

    setTimeout(() => {
        div.style.opacity = "0";
        setTimeout(() => div.remove(), 300);
    }, 3000);
}

socket.on("user_joined", (data) => {
    showNotice(`+ ${data.username} joined`);
});

socket.on("user_left", (data) => {
    showNotice(`- ${data.username} left`);
});

// ======================
// ⌨️ ENTER TO SEND
// ======================
document.getElementById("msgInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        sendMessage();
    }
});