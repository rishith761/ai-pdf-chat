# AI PDF Chat

Simple Node.js + Express app that provides a chat-style UI. Put PDFs into the `pdfs/` folder and ask for them by name — the chat will return links to matching PDFs.

## Features
- Search PDFs by name with a search box or via chat.
- `/pdf/:filename` serves PDFs from the `pdfs` folder.
- Binds to `0.0.0.0` by default so you can access it from other devices on the same network.

## Quick start

1. Install dependencies (run in project root):

```powershell
cd "c:\Users\kalak\OneDrive\ドキュメント\node.js\ai-pdf-chat"
npm install
```

2. Place your PDFs into the `pdfs` folder:

```powershell
# PDFs go here
# Copy your PDF files into the pdfs/ folder
```

3. Start the server:

```powershell
npm start
```

4. Open in browser: `http://localhost:3000` locally, or `http://<your-machine-ip>:3000` from other LAN devices.

## Find your machine's IP (PowerShell)

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "Loopback*"} | Select-Object IPAddress
```

If your IP is `192.168.1.42`, open `http://192.168.1.42:3000` on another device.

## Docker (build and run)

This project includes a `Dockerfile` so you can build and run it in a container. The `pdfs/` folder is mounted as a volume so you can add PDFs without rebuilding the image.

Build the image (from project root):

```powershell
docker build -t ai-pdf-chat:latest .
```

Run the container with volume mount:

```powershell
docker run -p 3000:3000 -v "${PWD}\pdfs":/app/pdfs -e HOST=0.0.0.0 -e PORT=3000 ai-pdf-chat:latest
```

Then open `http://localhost:3000` or `http://<host-ip>:3000`.

**Notes:**
- The image uses Alpine for smaller size (~160MB vs ~920MB for standard Node image).
- The container runs as non-root user `app` for security.
- `.dockerignore` excludes `pdfs/` so you mount it at runtime.

## Optional: AI Integration

The code includes a placeholder in `/api/chat` where you can integrate OpenAI. Set `OPENAI_API_KEY` in a `.env` file and add your OpenAI call to get conversational AI replies. By default the endpoint searches filenames and returns PDF links when it finds matches.

## Security notes

This is a minimal demo. If you expose this server to the public internet:
- Add authentication or password-protect the UI.
- Use more robust path validation.
- Run behind a reverse proxy (nginx, etc.).

## Production: fast uploads with S3 presigned URLs (recommended)

For public deployment and large files, use AWS S3 with presigned uploads. Set these environment variables on your host (or in Vercel):

- `AWS_REGION` — e.g. `us-east-1`
- `S3_BUCKET` — your S3 bucket name
- (optional) `UPLOAD_KEY` — set a secret string to require a client-side key when requesting presigned URLs

How it works:
- The browser requests `/api/presign` with filename and contentType. The server returns a short-lived presigned PUT URL.
- The browser uploads the file directly to S3 using that URL (no server bandwidth used).
- The server can list S3 PDFs via `/api/pdfs`, and `/pdf/:filename` will redirect to a presigned GET URL when the file is stored in S3.

On Vercel: add `AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and (optionally) `UPLOAD_KEY` to your project Environment Variables. Keep `UPLOAD_KEY` secret and only provide it to authorized users.

This approach improves upload speed, scales well, and keeps your server stateless.
