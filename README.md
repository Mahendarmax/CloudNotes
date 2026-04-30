# CloudNotes By Mahendar

A lightweight notes-taking app with topics, drag-and-drop organization, and local backup.

## Project Structure

```
test/
├── index.html        # Main app page
├── css/
│   └── style.css     # All styles
├── js/
│   └── app.js        # All application logic
├── backup/           # Local backup folder (notes.json, topics.json)
└── README.md
```

## How to Run Locally

### Option 1: VS Code Live Server (Recommended)

1. Install the **Live Server** extension in VS Code
2. Open this folder in VS Code
3. Right-click `index.html` → **Open with Live Server**
4. App opens at `http://127.0.0.1:5500`

### Option 2: Python HTTP Server

Open a terminal in this folder and run:

```bash
# Python 3
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

### Option 3: Node.js HTTP Server

```bash
npx serve .
```

Then open the URL shown in the terminal.

### Option 4: Double-Click (Limited)

You can double-click `index.html` to open it directly in your browser. However, the **backup folder feature will not work** with `file://` URLs — it requires an HTTP server.

## Features

- **Create & Edit Notes** — Rich text editor with bold, italic, underline, lists, code blocks, tables, images, and shapes
- **Topics / Folders** — Organize notes into custom topics
- **Drag & Drop** — Drag note cards onto topics in the sidebar to move them
- **PDF Export** — Export individual notes as PDF
- **Import / Export** — Backup all notes as JSON; import from JSON
- **Local Folder Backup** — Auto-saves `notes.json` and `topics.json` to a local backup folder on every change
- **Undo / Redo** — Full undo/redo history in the editor

## Backup & Restore

### Setting Up Backup

1. Open the app in your browser
2. On first load, it will prompt you to select a backup folder — choose the `backup/` folder
3. All changes are now auto-saved to `backup/notes.json` and `backup/topics.json`

### Restoring on Another PC

1. Copy the entire `test/` folder (including `backup/`) to the new PC
2. Start the app using one of the methods above
3. When prompted, select the `backup/` folder
4. The app detects existing notes and restores them automatically

## Requirements

- A modern browser (Chrome, Edge, or Brave recommended)
- An HTTP server for the backup folder feature (see run options above)
