const chatEl = document.getElementById('chat');
const msgInput = document.getElementById('message');
const sendBtn = document.getElementById('send');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');

function addMessage(text, cls = 'bot') {
  const d = document.createElement('div');
  d.className = 'msg ' + (cls === 'user' ? 'user' : 'bot');
  d.innerHTML = text;
  chatEl.appendChild(d);
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function uploadPDF() {
  if (!fileInput.files.length) {
    uploadStatus.innerHTML = '<div class="status error">Please select a PDF file</div>';
    return;
  }

  const file = fileInput.files[0];
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    uploadStatus.innerHTML = '<div class="status error">Only PDF files allowed</div>';
    return;
  }

  uploadStatus.innerHTML = '<div class="status">Uploading...</div>';

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data: base64 })
      });
      const data = await res.json();
      if (data.success) {
        uploadStatus.innerHTML = `<div class="status success">✓ ${data.message}</div>`;
        fileInput.value = '';
        addMessage(`<b>PDF uploaded:</b> ${escapeHtml(file.name)}`);
      } else {
        uploadStatus.innerHTML = `<div class="status error">✗ ${data.error}</div>`;
      }
    };
    reader.readAsDataURL(file);
  } catch (err) {
    uploadStatus.innerHTML = '<div class="status error">Upload failed</div>';
    console.error(err);
  }
}

async function searchName(name) {
  if (!name) {
    addMessage('Please enter a search term', 'bot');
    return;
  }
  addMessage(`<b>🔍 Searching for:</b> ${escapeHtml(name)}`, 'user');
  try {
    const res = await fetch(`/api/search?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (data.results && data.results.length) {
      let html = `<b>Found ${data.results.length} PDF(s):</b>`;
      data.results.forEach(r => {
        html += `<br><a class="pdf-link" href="${r.url}" target="_blank">📥 ${escapeHtml(r.name)}</a>`;
      });
      addMessage(html);
    } else {
      addMessage('No PDFs matched your search. Try uploading one!');
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
      let html = `<b>Found ${data.results.length} PDF(s):</b>`;
      data.results.forEach(r => {
        html += `<br><a class="pdf-link" href="${r.url}" target="_blank">📥 ${escapeHtml(r.name)}</a>`;
      });
      addMessage(html);
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

uploadBtn.addEventListener('click', uploadPDF);
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) {
    uploadStatus.innerHTML = '';
  }
});

// Welcome message
addMessage('👋 Welcome! Upload a PDF or search for existing ones. Try: "Get invoice" or "Show report"');
