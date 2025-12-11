const chatEl = document.getElementById('chat');
const msgInput = document.getElementById('message');
const sendBtn = document.getElementById('send');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

function addMessage(text, cls = 'bot') {
  const d = document.createElement('div');
  d.className = 'msg ' + (cls === 'user' ? 'user' : 'bot');
  d.innerHTML = text;
  chatEl.appendChild(d);
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function searchName(name) {
  addMessage(`<b>Searching for:</b> ${escapeHtml(name)}`,'user');
  try {
    const res = await fetch(`/api/search?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (data.results && data.results.length) {
      addMessage(`<b>Found ${data.results.length} PDF(s):</b>`);
      data.results.forEach(r => {
        addMessage(`<a class="pdf-link" href="${r.url}" target="_blank">${escapeHtml(r.name)}</a>`);
      });
    } else {
      addMessage('No PDFs matched your search.');
    }
  } catch (err) {
    addMessage('Search failed.');
    console.error(err);
  }
}

async function sendMessage(text) {
  if (!text) return;
  addMessage(escapeHtml(text), 'user');
  msgInput.value = '';
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    if (data.type === 'pdf' && data.results && data.results.length) {
      addMessage(`<b>Found ${data.results.length} PDF(s):</b>`);
      data.results.forEach(r => addMessage(`<a class="pdf-link" href="${r.url}" target="_blank">${escapeHtml(r.name)}</a>`));
    } else if (data.type === 'text') {
      addMessage(escapeHtml(data.reply));
    } else {
      addMessage('No response.');
    }
  } catch (err) {
    addMessage('Chat request failed.');
    console.error(err);
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

sendBtn.addEventListener('click', () => sendMessage(msgInput.value.trim()));
msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(msgInput.value.trim()); });
searchBtn.addEventListener('click', () => searchName(searchInput.value.trim()));
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchName(searchInput.value.trim()); });

// Simple quick demo message
addMessage('Welcome — ask for a PDF by name or use the search box. Example: "Get invoice-2024"');
