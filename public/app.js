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
    // Try presigned URL first (S3 mode)
    const presign = async (apiKey) => {
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['x-api-key'] = apiKey;
      const r = await fetch('/api/presign', {
        method: 'POST',
        headers,
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      });
      return r;
    };

    let res = await presign();
    if (res.status === 403) {
      // Server requires an upload key -> ask the user
      const key = prompt('Upload key required. Please enter the upload key:');
      if (!key) {
        uploadStatus.innerHTML = '<div class="status error">Upload cancelled (no key)</div>';
        return;
      }
      res = await presign(key);
    }

    // If presign works, use S3 direct upload
    if (res.ok) {
      const data = await res.json();
      const uploadUrl = data.uploadUrl;
      if (uploadUrl) {
        // Upload directly to S3 via PUT with progress
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadUrl, true);
          xhr.setRequestHeader('Content-Type', file.type || 'application/pdf');
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const pct = Math.round((ev.loaded / ev.total) * 100);
              uploadStatus.innerHTML = `<div class="status">Uploading to S3... ${pct}%</div>`;
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              uploadStatus.innerHTML = `<div class="status success">✓ Uploaded ${escapeHtml(file.name)}</div>`;
              fileInput.value = '';
              addMessage(`<b>PDF uploaded to S3:</b> ${escapeHtml(file.name)}`);
              resolve();
            } else {
              uploadStatus.innerHTML = `<div class="status error">S3 upload failed: ${xhr.status}</div>`;
              reject(new Error('S3 upload failed'));
            }
          };
          xhr.onerror = () => {
            uploadStatus.innerHTML = '<div class="status error">Network error during S3 upload</div>';
            reject(new Error('Network error'));
          };
          xhr.send(file);
        });
        return;
      }
    }

    // Fallback: use base64 upload to server (in-memory storage)
    uploadStatus.innerHTML = '<div class="status">Uploading to server (in-memory)...</div>';
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data: base64 })
      });
      const uploadData = await uploadRes.json();
      if (uploadData.success) {
        uploadStatus.innerHTML = `<div class="status success">✓ ${uploadData.message}</div>`;
        fileInput.value = '';
        addMessage(`<b>PDF uploaded:</b> ${escapeHtml(file.name)}`);
      } else {
        uploadStatus.innerHTML = `<div class="status error">✗ ${uploadData.error}</div>`;
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
