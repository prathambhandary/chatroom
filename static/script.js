const socket = io();

let username = "";
let cooldown = false;

socket.on("assign_username", (name) => {
    username = name;
    document.getElementById("username").innerText = `(${name})`;
});

function sendMessage() {
    const input = document.getElementById("msgInput");

    if (cooldown || input.value.trim() === "") return;

    socket.emit("send_message", {
        username: username,
        text: input.value
    });

    input.value = "";
    startCooldown();
}

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

socket.on("new_message", (msg) => {

    renderMessage(msg);

    // Auto delete after 50s
    // setTimeout(() => {
    //     div.style.opacity = "0";
    //     setTimeout(() => div.remove(), 500);
    // }, msg.remaining * 1000);
});

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

socket.on("delete_message", (data) => {
    const msgDiv = document.getElementById(data.id);
    if (!msgDiv) return;

    msgDiv.style.opacity = "0";
    setTimeout(() => msgDiv.remove(), 300);
});

socket.on("initial_messages", (msgs) => {
    msgs.forEach(msg => {
        renderMessage(msg);

        // ⏳ delete after remaining time
        setTimeout(() => {
            removeMessage(msg.id);
        }, msg.remaining * 1000);
    });
});

function renderMessage(msg) {
    const chat = document.getElementById("chat");

    const div = document.createElement("div");
    div.className = "message";
    div.id = msg.id;

    div.innerHTML = `
        <b>${msg.username}</b>: ${msg.text}
        <div class="reactions">
            ${Object.keys(msg.reactions).map(r =>
                `<span onclick="react('${msg.id}','${r}')">${r} ${msg.reactions[r]}</span>`
            ).join("")}
        </div>
    `;

    chat.prepend(div);
}

function removeMessage(id) {
    const msgDiv = document.getElementById(id);
    if (!msgDiv) return;

    msgDiv.style.opacity = "0";
    setTimeout(() => msgDiv.remove(), 300);
}

socket.on("user_count", (count) => {
    const el = document.getElementById("userCount");

    el.style.opacity = "0.5";

    setTimeout(() => {
        el.innerText = `🟢 ${count} online`;
        el.style.opacity = "1";
    }, 150);
});