(function () {
    'use strict';

    const STORAGE_KEY = 'cloudnotes_data';
    const TOPICS_KEY = 'cloudnotes_topics';

    // ===== DOM =====
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    const el = {
        container: $('#notesContainer'),
        emptyState: $('#emptyState'),
        searchInput: $('#searchInput'),
        noteCount: $('#noteCount'),
        sortSelect: $('#sortSelect'),
        btnNewNote: $('#btnNewNote'),
        btnExport: $('#btnExport'),
        btnImport: $('#btnImport'),
        btnSetBackupFolder: $('#btnSetBackupFolder'),
        importInput: $('#importInput'),
        // Modal
        overlay: $('#modalOverlay'),
        modal: $('.modal'),
        title: $('#noteTitle'),
        body: $('#noteBody'),

        btnPin: $('#btnPin'),
        btnFullscreen: $('#btnFullscreen'),
        btnClose: $('#btnCloseModal'),
        btnSave: $('#btnSaveNote'),
        btnDelete: $('#btnDeleteNote'),
        meta: $('#noteMeta'),
        noteStats: $('#noteStats'),
        toast: $('#toast'),
        // Undo / Redo
        btnUndo: $('#btnUndo'),
        btnRedo: $('#btnRedo'),
        // Toolbar extras
        fontSizeSelect: $('#fontSizeSelect'),
        textColorPicker: $('#textColorPicker'),
        textColorIndicator: $('#textColorIndicator'),
        highlightColorPicker: $('#highlightColorPicker'),
        highlightColorIndicator: $('#highlightColorIndicator'),
        btnHighlight: $('#btnHighlight'),
        btnInsertCode: $('#btnInsertCode'),
        btnInsertTable: $('#btnInsertTable'),
        // Insert tools
        imageInput: $('#imageInput'),
        btnInsertImage: $('#btnInsertImage'),
        btnInsertRect: $('#btnInsertRect'),
        btnInsertCircle: $('#btnInsertCircle'),
        btnInsertLine: $('#btnInsertLine'),
        btnInsertDivider: $('#btnInsertDivider'),
        btnExportPdf: $('#btnExportPdf'),
        // Topics sidebar
        topicsSidebar: $('#topicsSidebar'),
        topicList: $('#topicList'),
        btnAddTopic: $('#btnAddTopic'),
        btnCollapseSidebar: $('#btnCollapseSidebar'),
        btnToggleSidebar: $('#btnToggleSidebar'),
        btnDeleteTopic: $('#btnDeleteTopic'),
        noteTopic: $('#noteTopic'),
    };

    // ===== State =====
    let notes = [];
    let editingId = null;
    let topics = [];
    let activeTopic = 'all';

    function getSearchFilter() {
        return el.searchInput ? el.searchInput.value : '';
    }

    // ===== Selection Save / Restore =====
    let savedRange = null;

    function saveSelection() {
        const sel = window.getSelection();
        if (sel.rangeCount > 0 && el.body && el.body.contains(sel.anchorNode)) {
            savedRange = sel.getRangeAt(0).cloneRange();
        }
    }

    function restoreSelection() {
        if (savedRange) {
            el.body.focus();
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
        }
    }

    // ===== Undo / Redo History =====
    const undoStack = [];
    const redoStack = [];
    const MAX_HISTORY = 50;
    let historyPaused = false;

    function pushUndo() {
        if (historyPaused) return;
        undoStack.push(el.body.innerHTML);
        if (undoStack.length > MAX_HISTORY) undoStack.shift();
        redoStack.length = 0; // clear redo on new action
        updateUndoRedoButtons();
    }

    function doUndo() {
        if (undoStack.length === 0) return;
        redoStack.push(el.body.innerHTML);
        const prev = undoStack.pop();
        historyPaused = true;
        el.body.innerHTML = prev;
        historyPaused = false;
        initSavedElements();
        updateUndoRedoButtons();
        scheduleAutoSave();
    }

    function doRedo() {
        if (redoStack.length === 0) return;
        undoStack.push(el.body.innerHTML);
        const next = redoStack.pop();
        historyPaused = true;
        el.body.innerHTML = next;
        historyPaused = false;
        initSavedElements();
        updateUndoRedoButtons();
        scheduleAutoSave();
    }

    function updateUndoRedoButtons() {
        if (el.btnUndo) el.btnUndo.classList.toggle('disabled', undoStack.length === 0);
        if (el.btnRedo) el.btnRedo.classList.toggle('disabled', redoStack.length === 0);
    }

    function clearHistory() {
        undoStack.length = 0;
        redoStack.length = 0;
        updateUndoRedoButtons();
    }

    // Debounced snapshot â€” captures state after typing pauses
    let historyTimer;
    function scheduleHistorySnapshot() {
        clearTimeout(historyTimer);
        historyTimer = setTimeout(() => pushUndo(), 600);
    }

    // ===== Storage =====
    function loadNotes() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            notes = raw ? JSON.parse(raw) : [];
        } catch {
            notes = [];
        }
    }

    function saveNotes() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        backupToFolder();
    }

    // ===== Topics Storage =====
    function loadTopics() {
        try {
            const raw = localStorage.getItem(TOPICS_KEY);
            topics = raw ? JSON.parse(raw) : [];
        } catch {
            topics = [];
        }
    }

    function saveTopics() {
        localStorage.setItem(TOPICS_KEY, JSON.stringify(topics));
        backupToFolder();
    }

    // ===== Local Folder Backup =====
    let backupDirHandle = null;
    const BACKUP_DB_NAME = 'cloudnotes_backup_db';
    const BACKUP_STORE = 'handles';

    // Save directory handle to IndexedDB (persists across sessions)
    function saveBackupHandle(handle) {
        const req = indexedDB.open(BACKUP_DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(BACKUP_STORE);
        };
        req.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction(BACKUP_STORE, 'readwrite');
            tx.objectStore(BACKUP_STORE).put(handle, 'backupDir');
        };
    }

    // Load directory handle from IndexedDB
    function loadBackupHandle() {
        return new Promise((resolve) => {
            const req = indexedDB.open(BACKUP_DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(BACKUP_STORE);
            };
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(BACKUP_STORE, 'readonly');
                const get = tx.objectStore(BACKUP_STORE).get('backupDir');
                get.onsuccess = () => resolve(get.result || null);
                get.onerror = () => resolve(null);
            };
            req.onerror = () => resolve(null);
        });
    }

    async function pickBackupFolder() {
        if (!window.showDirectoryPicker) {
            showToast('Backup folders not supported in this browser. Use Chrome or Edge.');
            return;
        }
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            backupDirHandle = handle;
            saveBackupHandle(handle);
            hideBackupPopup();

            // Check if backup folder has existing data (e.g. coming from another PC)
            let hasExistingBackup = false;
            try {
                const nf = await handle.getFileHandle('notes.json');
                const file = await nf.getFile();
                const text = await file.text();
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    hasExistingBackup = true;
                }
            } catch (_) { /* no existing backup */ }

            if (hasExistingBackup && (notes.length === 0 || confirm('Backup folder has existing notes. Restore from backup?\n\nOK = Restore from backup\nCancel = Overwrite backup with current notes'))) {
                await loadFromBackup();
                renderTopics();
                updateTopicSelect();
                render();
                showToast('Notes restored from backup: ' + handle.name);
            } else {
                await backupToFolder();
                showToast('Backup folder set: ' + handle.name);
            }
        } catch (err) {
            if (err.name !== 'AbortError') showToast('Could not set backup folder');
        }
    }

    async function backupToFolder() {
        if (!backupDirHandle) return;
        try {
            // Verify permission
            const perm = await backupDirHandle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted') {
                const req = await backupDirHandle.requestPermission({ mode: 'readwrite' });
                if (req !== 'granted') return;
            }
            // Write notes.json
            const notesFile = await backupDirHandle.getFileHandle('notes.json', { create: true });
            const notesWriter = await notesFile.createWritable();
            await notesWriter.write(JSON.stringify(notes, null, 2));
            await notesWriter.close();
            // Write topics.json
            const topicsFile = await backupDirHandle.getFileHandle('topics.json', { create: true });
            const topicsWriter = await topicsFile.createWritable();
            await topicsWriter.write(JSON.stringify(topics, null, 2));
            await topicsWriter.close();
        } catch (err) {
            // Silently fail — don't interrupt user flow
        }
    }

    async function loadFromBackup() {
        if (!backupDirHandle) return false;
        try {
            const perm = await backupDirHandle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted') return false;
            // Read notes.json
            try {
                const nf = await backupDirHandle.getFileHandle('notes.json');
                const file = await nf.getFile();
                const text = await file.text();
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    notes = parsed;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
                }
            } catch (_) { /* file may not exist yet */ }
            // Read topics.json
            try {
                const tf = await backupDirHandle.getFileHandle('topics.json');
                const file = await tf.getFile();
                const text = await file.text();
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed)) {
                    topics = parsed;
                    localStorage.setItem(TOPICS_KEY, JSON.stringify(topics));
                }
            } catch (_) { /* file may not exist yet */ }
            return true;
        } catch (_) {
            return false;
        }
    }

    function addTopic(name) {
        if (!name || !name.trim()) return;
        name = name.trim();
        if (topics.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
            showToast('Topic already exists');
            return;
        }
        topics.push({ id: generateId(), name: name });
        saveTopics();
        renderTopics();
        updateTopicSelect();
        showToast('Topic "' + name + '" created');
    }

    function deleteTopic(topicId) {
        const topic = topics.find((t) => t.id === topicId);
        if (!topic) return;
        // Un-assign notes from this topic
        notes.forEach((n) => { if (n.topic === topicId) n.topic = ''; });
        saveNotes();
        topics = topics.filter((t) => t.id !== topicId);
        saveTopics();
        if (activeTopic === topicId) activeTopic = 'all';
        renderTopics();
        render(getSearchFilter());
        updateTopicSelect();
        showToast('Topic deleted');
    }

    function renameTopic(topicId, newName) {
        if (!newName || !newName.trim()) return;
        const topic = topics.find((t) => t.id === topicId);
        if (!topic) return;
        topic.name = newName.trim();
        saveTopics();
        renderTopics();
        updateTopicSelect();
    }

    function renderTopics() {
        // Keep the two fixed items (All, Uncategorized), remove custom ones
        el.topicList.querySelectorAll('.topic-item-custom').forEach((e) => e.remove());

        // Update counts
        const allCount = notes.length;
        const uncatCount = notes.filter((n) => !n.topic).length;
        const countAllEl = el.topicList.querySelector('#topicCountAll');
        const countUncatEl = el.topicList.querySelector('#topicCountUncat');
        if (countAllEl) countAllEl.textContent = allCount;
        if (countUncatEl) countUncatEl.textContent = uncatCount;

        // Set active states on fixed items
        el.topicList.querySelectorAll('.topic-item').forEach((item) => {
            item.classList.toggle('active', item.dataset.topic === activeTopic);
        });

        // Render custom topics
        topics.forEach((topic) => {
            const count = notes.filter((n) => n.topic === topic.id).length;
            const item = document.createElement('div');
            item.className = 'topic-item topic-item-custom' + (activeTopic === topic.id ? ' active' : '');
            item.dataset.topic = topic.id;
            item.innerHTML = `
                <i class="fas fa-folder"></i>
                <span class="topic-name">${escapeHtml(topic.name)}</span>
                <span class="topic-count">${count}</span>
            `;
            // Click to filter
            item.addEventListener('click', () => {
                activeTopic = topic.id;
                renderTopics();
                render(getSearchFilter());
            });
            // Double-click to rename
            item.addEventListener('dblclick', () => {
                const nameSpan = item.querySelector('.topic-name');
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'topic-edit-input';
                input.value = topic.name;
                nameSpan.replaceWith(input);
                input.focus();
                input.select();
                const finish = () => {
                    renameTopic(topic.id, input.value);
                };
                input.addEventListener('blur', finish);
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') input.blur();
                    if (ev.key === 'Escape') { input.value = topic.name; input.blur(); }
                });
            });
            // Drag-over: allow dropping notes
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                item.classList.add('drag-over');
            });
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const noteId = e.dataTransfer.getData('text/plain');
                if (noteId) {
                    moveNoteToTopic(noteId, topic.id, item);
                }
            });
            el.topicList.appendChild(item);
        });

        // Also add drag-over to fixed Uncategorized item
        const uncatItem = el.topicList.querySelector('[data-topic="uncategorized"]');
        if (uncatItem) {
            uncatItem.ondragover = (e) => { e.preventDefault(); uncatItem.classList.add('drag-over'); };
            uncatItem.ondragleave = () => uncatItem.classList.remove('drag-over');
            uncatItem.ondrop = (e) => {
                e.preventDefault();
                uncatItem.classList.remove('drag-over');
                const noteId = e.dataTransfer.getData('text/plain');
                if (noteId) moveNoteToTopic(noteId, '', uncatItem);
            };
        }
    }

    function moveNoteToTopic(noteId, topicId, dropTargetEl) {
        const note = notes.find((n) => n.id === noteId);
        if (!note) return;
        const prevTopic = note.topic;
        if (prevTopic === topicId) return;

        // Find the card element to animate
        const card = el.container.querySelector('.note-card[data-id="' + noteId + '"]');
        if (card && dropTargetEl) {
            // Animate card flying into the topic item
            const cardRect = card.getBoundingClientRect();
            const targetRect = dropTargetEl.getBoundingClientRect();
            const ghost = card.cloneNode(true);
            ghost.style.cssText = `
                position: fixed;
                left: ${cardRect.left}px;
                top: ${cardRect.top}px;
                width: ${cardRect.width}px;
                height: ${cardRect.height}px;
                z-index: 9999;
                pointer-events: none;
                transition: all 0.45s cubic-bezier(.4,0,.2,1);
                margin: 0;
                border-color: var(--orange);
                box-shadow: 0 8px 32px rgba(255,153,0,0.5);
            `;
            document.body.appendChild(ghost);
            // Hide original immediately
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            // Fly to target
            requestAnimationFrame(() => {
                ghost.style.left = targetRect.left + 'px';
                ghost.style.top = targetRect.top + 'px';
                ghost.style.width = targetRect.width + 'px';
                ghost.style.height = '40px';
                ghost.style.opacity = '0';
                ghost.style.transform = 'scale(0.2)';
                ghost.style.borderRadius = '20px';
            });
            // Pulse the topic item
            dropTargetEl.classList.add('topic-drop-pulse');
            setTimeout(() => {
                ghost.remove();
                dropTargetEl.classList.remove('topic-drop-pulse');
                // Now actually update data and re-render
                note.topic = topicId;
                saveNotes();
                renderTopics();
                render(getSearchFilter());
                const topicName = topicId ? (topics.find((t) => t.id === topicId) || {}).name || '' : 'Uncategorized';
                showToast('Moved to "' + topicName + '"');
            }, 480);
        } else {
            // Fallback: no animation
            note.topic = topicId;
            saveNotes();
            renderTopics();
            render(getSearchFilter());
            const topicName = topicId ? (topics.find((t) => t.id === topicId) || {}).name || '' : 'Uncategorized';
            showToast('Moved to "' + topicName + '"');
        }
    }

    function updateTopicSelect() {
        if (!el.noteTopic) return;
        const current = el.noteTopic.value;
        el.noteTopic.innerHTML = '<option value="">No Topic</option>';
        topics.forEach((t) => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            el.noteTopic.appendChild(opt);
        });
        el.noteTopic.value = current;
    }

    // ===== Render =====
    function render(filter) {
        // Remove old cards (keep empty state)
        el.container.querySelectorAll('.note-card').forEach((c) => c.remove());

        let visible = notes;

        // Filter by active topic
        if (activeTopic === 'uncategorized') {
            visible = visible.filter((n) => !n.topic);
        } else if (activeTopic !== 'all') {
            visible = visible.filter((n) => n.topic === activeTopic);
        }

        if (filter) {
            const q = filter.toLowerCase();
            visible = visible.filter(
                (n) => n.title.toLowerCase().includes(q) || n.textContent.toLowerCase().includes(q)
            );
        }

        // Sort: pinned first, then by selected sort method
        const sortBy = el.sortSelect ? el.sortSelect.value : 'updated';
        visible.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            switch (sortBy) {
                case 'created': return b.createdAt - a.createdAt;
                case 'alpha': return (a.title || '').localeCompare(b.title || '');
                case 'alpha-desc': return (b.title || '').localeCompare(a.title || '');
                default: return b.updatedAt - a.updatedAt;
            }
        });

        el.emptyState.style.display = visible.length === 0 ? '' : 'none';
        if (el.noteCount) el.noteCount.textContent = notes.length + ' note' + (notes.length !== 1 ? 's' : '');

        visible.forEach((note) => {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.dataset.id = note.id;


            // Build preview text: strip tags for body preview
            const previewText = note.textContent || '';
            // Truncate preview for card display
            const previewLines = previewText.substring(0, 200) + (previewText.length > 200 ? '...' : '');

            // Topic badge
            const topicObj = note.topic ? topics.find((t) => t.id === note.topic) : null;
            const topicBadge = topicObj ? `<span class="note-topic-badge">${escapeHtml(topicObj.name)}</span>` : '';

            card.innerHTML = `
                ${note.pinned ? '<i class="fas fa-thumbtack pin-badge"></i>' : ''}
                ${topicBadge}
                <div class="note-card-inner">
                    <div class="note-card-title">${escapeHtml(note.title || 'Untitled')}</div>
                    <div class="note-card-body">${escapeHtml(previewLines)}</div>
                    <div class="note-card-footer">
                        <span>${formatDate(note.updatedAt)}</span>
                        <span>${wordCount(previewText)} words</span>
                    </div>
                </div>
            `;

            // Draggable for topic assignment
            card.draggable = true;
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', note.id);
                e.dataTransfer.effectAllowed = 'move';
                // Custom drag image
                const dragGhost = document.createElement('div');
                dragGhost.textContent = note.title || 'Untitled';
                dragGhost.style.cssText = 'position:fixed;left:-9999px;top:-9999px;padding:8px 16px;background:#232f3e;color:#ff9900;border:2px solid #ff9900;border-radius:8px;font-size:13px;font-weight:700;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 16px rgba(255,153,0,0.4);';
                document.body.appendChild(dragGhost);
                e.dataTransfer.setDragImage(dragGhost, 20, 20);
                setTimeout(() => dragGhost.remove(), 0);
                card.classList.add('dragging-card');
                // Highlight sidebar as drop zone
                el.topicsSidebar.classList.add('sidebar-drag-active');
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging-card');
                el.topicsSidebar.classList.remove('sidebar-drag-active');
            });

            card.addEventListener('click', () => openEditor(note.id));
            el.container.appendChild(card);
        });

        // Staggered card entry animation for 120Hz smoothness
        requestAnimationFrame(() => {
            const cards = el.container.querySelectorAll('.note-card');
            cards.forEach((c, i) => {
                c.style.animationDelay = (i * 40) + 'ms';
            });
        });
    }

    // ===== Editor =====
    function openEditor(id) {
        if (id) {
            const note = notes.find((n) => n.id === id);
            if (!note) return;
            editingId = id;
            el.title.value = note.title;
            el.body.innerHTML = note.body;
            el.btnPin.classList.toggle('pinned', !!note.pinned);
            el.meta.textContent = 'Created: ' + formatDate(note.createdAt) + '  â€¢  Modified: ' + formatDate(note.updatedAt);
            el.btnDelete.style.display = '';
            if (el.noteTopic) el.noteTopic.value = note.topic || '';
        } else {
            editingId = null;
            el.title.value = '';
            el.body.innerHTML = '';
            el.btnPin.classList.remove('pinned');
            el.meta.textContent = '';
            el.btnDelete.style.display = 'none';
            if (el.noteTopic) el.noteTopic.value = '';
        }

        el.overlay.classList.add('open');
        el.title.focus();
        // Reset fullscreen
        if (el.modal) el.modal.classList.remove('fullscreen');
        if (el.btnFullscreen) {
            const icon = el.btnFullscreen.querySelector('i');
            if (icon) icon.className = 'fas fa-expand';
        }
        // Re-init resizable elements from saved HTML
        initSavedElements();
        // Reset undo history for this editing session
        clearHistory();
        // Capture initial state
        pushUndo();
        // Update stats
        updateStats();
    }

    function closeEditor() {
        el.overlay.classList.remove('open');
        editingId = null;
    }

    function saveNote() {
        const title = el.title.value.trim();
        const body = el.body.innerHTML.trim();
        const textContent = el.body.innerText.trim();

        if (!title && !textContent) {
            showToast('Note is empty â€” nothing to save');
            return;
        }

        const now = Date.now();
        const pinned = el.btnPin.classList.contains('pinned');
        const topic = el.noteTopic ? el.noteTopic.value : '';

        if (editingId) {
            const note = notes.find((n) => n.id === editingId);
            if (note) {
                note.title = title || 'Untitled';
                note.body = body;
                note.textContent = textContent;
                note.pinned = pinned;
                note.topic = topic;
                note.updatedAt = now;
            }
        } else {
            notes.push({
                id: generateId(),
                title: title || 'Untitled',
                body: body,
                textContent: textContent,
                pinned: pinned,
                topic: topic,
                createdAt: now,
                updatedAt: now,
            });
        }

        saveNotes();
        render(getSearchFilter());
        renderTopics();
        closeEditor();
        showToast('Note saved');
    }

    function deleteNote() {
        if (!editingId) return;
        if (!confirm('Delete this note permanently?')) return;
        // Animate card removal
        const card = el.container.querySelector('.note-card[data-id="' + editingId + '"]');
        if (card) card.classList.add('note-card-removing');
        notes = notes.filter((n) => n.id !== editingId);
        saveNotes();
        closeEditor();
        // Wait for animation to finish, then re-render
        setTimeout(() => {
            render(getSearchFilter());
            renderTopics();
        }, 300);
        showToast('Note deleted');
    }

    // ===== Export =====
    function exportNotes() {
        if (notes.length === 0) {
            showToast('No notes to export');
            return;
        }
        const data = JSON.stringify(notes, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cloudnotes_backup_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Notes exported');
    }

    // ===== Format Toolbar =====
    function execFormat(cmd, val) {
        el.body.focus();
        if (cmd === 'createLink') {
            const sel = window.getSelection();
            // If selection is already a link, unlink it
            const anchor = getParentTag(sel.anchorNode, 'A');
            if (anchor) {
                document.execCommand('unlink', false, null);
                return;
            }
            const url = prompt('Enter URL:', 'https://');
            if (!url || url === 'https://') return;
            if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
                document.execCommand(cmd, false, 'https://' + url);
            } else {
                document.execCommand(cmd, false, url);
            }
        } else if (cmd === 'formatBlock') {
            // Toggle: if already in that block type, revert to <div>
            const sel = window.getSelection();
            const current = getParentBlock(sel.anchorNode);
            if (current && current.tagName === val) {
                document.execCommand('formatBlock', false, 'DIV');
            } else {
                document.execCommand('formatBlock', false, val);
            }
        } else if (val) {
            document.execCommand(cmd, false, val);
        } else {
            document.execCommand(cmd, false, null);
        }
        scheduleAutoSave();
    }

    // ===== Highlight =====
    function toggleHighlight() {
        el.body.focus();
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.isCollapsed) return;

        const range = sel.getRangeAt(0);
        // Check if already highlighted
        const parent = sel.anchorNode.parentElement;
        if (parent && parent.tagName === 'MARK') {
            // Remove highlight â€” unwrap the mark
            const text = document.createTextNode(parent.textContent);
            parent.parentNode.replaceChild(text, parent);
        } else {
            const color = el.highlightColorPicker ? el.highlightColorPicker.value : '#ffe066';
            const mark = document.createElement('mark');
            mark.style.background = color;
            try {
                range.surroundContents(mark);
            } catch (_) {
                document.execCommand('hiliteColor', false, color);
            }
        }
        scheduleAutoSave();
    }

    // ===== Import Notes =====
    function importNotes(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (!Array.isArray(imported)) {
                    showToast('Invalid backup file');
                    return;
                }
                // Merge: skip duplicates by id
                let added = 0;
                const existingIds = new Set(notes.map((n) => n.id));
                imported.forEach((n) => {
                    if (n.id && !existingIds.has(n.id)) {
                        notes.push(n);
                        added++;
                    }
                });
                saveNotes();
                render(getSearchFilter());
                showToast(added + ' note' + (added !== 1 ? 's' : '') + ' imported');
            } catch (_) {
                showToast('Failed to parse backup file');
            }
        };
        reader.readAsText(file);
    }

    // ===== Fullscreen Toggle =====
    function toggleFullscreen() {
        if (!el.modal) return;
        el.modal.classList.toggle('fullscreen');
        const icon = el.btnFullscreen.querySelector('i');
        if (icon) {
            icon.className = el.modal.classList.contains('fullscreen')
                ? 'fas fa-compress'
                : 'fas fa-expand';
        }
    }

    // ===== Live Stats =====
    function updateStats() {
        if (!el.noteStats) return;
        const text = el.body.innerText || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        el.noteStats.textContent = words + ' words \u00B7 ' + chars + ' chars';
    }

    // ===== Insert Code Block =====
    function insertCodeBlock() {
        pushUndo();
        el.body.focus();
        const pre = document.createElement('pre');
        pre.className = 'code-block';
        pre.contentEditable = 'true';
        pre.textContent = 'Type code here...';
        insertNodeAtCursor(pre);
        // Select the placeholder text
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        scheduleAutoSave();
    }

    // ===== Insert Table =====
    function insertTable() {
        pushUndo();
        el.body.focus();
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (let c = 0; c < 3; c++) {
            const th = document.createElement('th');
            th.contentEditable = 'true';
            th.textContent = 'Header ' + (c + 1);
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (let r = 0; r < 3; r++) {
            const row = document.createElement('tr');
            for (let c = 0; c < 3; c++) {
                const td = document.createElement('td');
                td.contentEditable = 'true';
                td.textContent = '';
                row.appendChild(td);
            }
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        insertNodeAtCursor(table);
        scheduleAutoSave();
    }

    // Find parent element with given tag name
    function getParentTag(node, tag) {
        while (node && node !== el.body) {
            if (node.nodeType === 1 && node.tagName === tag) return node;
            node = node.parentNode;
        }
        return null;
    }

    // Find parent block element
    function getParentBlock(node) {
        const blocks = ['H1','H2','H3','H4','H5','H6','BLOCKQUOTE','PRE','DIV','P'];
        while (node && node !== el.body) {
            if (node.nodeType === 1 && blocks.includes(node.tagName)) return node;
            node = node.parentNode;
        }
        return null;
    }

    // ===== Insert Image =====
    function insertImage(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            const wrapper = document.createElement('div');
            wrapper.className = 'resizable-wrapper';
            wrapper.contentEditable = 'false';

            // Drag grip
            const grip = document.createElement('div');
            grip.className = 'drag-grip';
            grip.title = 'Drag to move';
            grip.innerHTML = '<i class="fas fa-grip-vertical"></i>';
            wrapper.appendChild(grip);

            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = file.name;
            wrapper.appendChild(img);

            // Resize handle
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            wrapper.appendChild(handle);

            // Delete button
            const del = document.createElement('button');
            del.className = 'element-delete';
            del.innerHTML = '&times;';
            del.title = 'Remove';
            del.addEventListener('click', (ev) => { ev.stopPropagation(); wrapper.remove(); scheduleAutoSave(); });
            wrapper.appendChild(del);

            initResize(wrapper, handle);
            initDrag(wrapper, grip);
            insertNodeAtCursor(wrapper);
            pushUndo();
            scheduleAutoSave();
        };
        reader.readAsDataURL(file);
    }

    // ===== Resize Logic =====
    function initResize(wrapper, handle) {
        let startX, startY, startW, startH;
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            pushUndo();
            startX = e.clientX;
            startY = e.clientY;
            startW = wrapper.offsetWidth;
            startH = wrapper.offsetHeight;
            wrapper.classList.add('resizing');

            function onMove(ev) {
                const w = Math.max(50, startW + (ev.clientX - startX));
                const h = Math.max(30, startH + (ev.clientY - startY));
                wrapper.style.width = w + 'px';
                wrapper.style.height = h + 'px';
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                wrapper.classList.remove('resizing');
                scheduleAutoSave();
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    // ===== Drag to Reposition (Free XY) =====
    function initDrag(wrapper, grip) {
        let startX, startY, origLeft, origTop;

        grip.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            pushUndo();

            const bodyRect = el.body.getBoundingClientRect();

            // If not already positioned absolutely, convert to absolute
            if (wrapper.style.position !== 'absolute') {
                const wrapRect = wrapper.getBoundingClientRect();
                wrapper.style.position = 'absolute';
                wrapper.style.left = (wrapRect.left - bodyRect.left + el.body.scrollLeft) + 'px';
                wrapper.style.top = (wrapRect.top - bodyRect.top + el.body.scrollTop) + 'px';
            }

            startX = e.clientX;
            startY = e.clientY;
            origLeft = parseInt(wrapper.style.left) || 0;
            origTop = parseInt(wrapper.style.top) || 0;
            wrapper.classList.add('dragging');
            wrapper.style.zIndex = '100';

            function onMove(ev) {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                wrapper.style.left = (origLeft + dx) + 'px';
                wrapper.style.top = (origTop + dy) + 'px';
            }

            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                wrapper.classList.remove('dragging');
                wrapper.style.zIndex = '';
                scheduleAutoSave();
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    // Simple drag for standalone elements like <hr>
    function initDragSimple(elem) {
        let startX, startY, origLeft, origTop;
        elem.style.cursor = 'grab';

        elem.addEventListener('mousedown', (e) => {
            e.preventDefault();
            pushUndo();

            const bodyRect = el.body.getBoundingClientRect();

            if (elem.style.position !== 'absolute') {
                const r = elem.getBoundingClientRect();
                elem.style.position = 'absolute';
                elem.style.left = (r.left - bodyRect.left + el.body.scrollLeft) + 'px';
                elem.style.top = (r.top - bodyRect.top + el.body.scrollTop) + 'px';
                elem.style.width = r.width + 'px';
            }

            startX = e.clientX;
            startY = e.clientY;
            origLeft = parseInt(elem.style.left) || 0;
            origTop = parseInt(elem.style.top) || 0;
            elem.classList.add('dragging');
            elem.style.zIndex = '100';

            function onMove(ev) {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                elem.style.left = (origLeft + dx) + 'px';
                elem.style.top = (origTop + dy) + 'px';
            }

            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                elem.classList.remove('dragging');
                elem.style.zIndex = '';
                scheduleAutoSave();
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    // ===== Insert Shapes =====
    function createShape(className, editable) {
        const wrapper = document.createElement('div');
        wrapper.className = 'resizable-wrapper';
        wrapper.contentEditable = 'false';

        // Drag grip
        const grip = document.createElement('div');
        grip.className = 'drag-grip';
        grip.title = 'Drag to move';
        grip.innerHTML = '<i class="fas fa-grip-vertical"></i>';
        wrapper.appendChild(grip);

        const shape = document.createElement('div');
        shape.className = className;
        if (editable) {
            shape.contentEditable = 'true';
            shape.setAttribute('placeholder', 'Type here...');
        }
        wrapper.appendChild(shape);

        // Resize handle
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        wrapper.appendChild(handle);

        // Delete button
        const del = document.createElement('button');
        del.className = 'element-delete';
        del.innerHTML = '&times;';
        del.title = 'Remove';
        del.addEventListener('click', (ev) => { ev.stopPropagation(); pushUndo(); wrapper.remove(); scheduleAutoSave(); });
        wrapper.appendChild(del);

        initResize(wrapper, handle);
        initDrag(wrapper, grip);
        return wrapper;
    }

    function insertRect() {
        pushUndo();
        const wrapper = createShape('note-shape-rect', true);
        insertNodeAtCursor(wrapper);
        scheduleAutoSave();
    }

    function insertCircle() {
        pushUndo();
        const wrapper = createShape('note-shape-circle', true);
        insertNodeAtCursor(wrapper);
        scheduleAutoSave();
    }

    function insertLine() {
        pushUndo();
        const hr = document.createElement('hr');
        hr.className = 'note-divider';
        initDragSimple(hr);
        insertNodeAtCursor(hr);
        scheduleAutoSave();
    }

    function insertDivider() {
        pushUndo();
        const wrapper = document.createElement('div');
        wrapper.className = 'resizable-wrapper';
        wrapper.contentEditable = 'false';

        // Drag grip
        const grip = document.createElement('div');
        grip.className = 'drag-grip';
        grip.title = 'Drag to move';
        grip.innerHTML = '<i class="fas fa-grip-vertical"></i>';
        wrapper.appendChild(grip);

        const div = document.createElement('div');
        div.className = 'note-divider-double';
        wrapper.appendChild(div);

        const del = document.createElement('button');
        del.className = 'element-delete';
        del.innerHTML = '&times;';
        del.title = 'Remove';
        del.addEventListener('click', (ev) => { ev.stopPropagation(); pushUndo(); wrapper.remove(); scheduleAutoSave(); });
        wrapper.appendChild(del);

        initDrag(wrapper, grip);
        insertNodeAtCursor(wrapper);
        scheduleAutoSave();
    }

    // Helper: insert a DOM node at current cursor position in contenteditable
    function insertNodeAtCursor(node) {
        el.body.focus();
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(node);
            // Move cursor after inserted node
            range.setStartAfter(node);
            range.setEndAfter(node);
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            el.body.appendChild(node);
        }
        // Add a line break after so user can keep typing
        const br = document.createElement('br');
        node.parentNode.insertBefore(br, node.nextSibling);
    }

    // Re-init resizable wrappers when loading saved note HTML
    function initSavedElements() {
        el.body.querySelectorAll('.resizable-wrapper').forEach((wrapper) => {
            wrapper.contentEditable = 'false';
            const handle = wrapper.querySelector('.resize-handle');
            if (handle) initResize(wrapper, handle);
            // Ensure drag grip exists
            let grip = wrapper.querySelector('.drag-grip');
            if (!grip) {
                grip = document.createElement('div');
                grip.className = 'drag-grip';
                grip.title = 'Drag to move';
                grip.innerHTML = '<i class="fas fa-grip-vertical"></i>';
                wrapper.insertBefore(grip, wrapper.firstChild);
            }
            initDrag(wrapper, grip);
            // Re-bind delete buttons
            const del = wrapper.querySelector('.element-delete');
            if (del) {
                del.onclick = (ev) => { ev.stopPropagation(); pushUndo(); wrapper.remove(); scheduleAutoSave(); };
            }
        });
        // Also handle standalone dividers (hr)
        el.body.querySelectorAll('hr.note-divider').forEach((hr) => {
            initDragSimple(hr);
        });
    }

    // Highlight active format buttons based on current selection
    function updateToolbarState() {
        const commands = ['bold', 'italic', 'underline', 'strikeThrough'];
        commands.forEach((cmd) => {
            const btn = document.querySelector(`.fmt-btn[data-cmd="${cmd}"]`);
            if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
        });
        // Alignment states
        const alignCmds = ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'];
        alignCmds.forEach((cmd) => {
            const btn = document.querySelector(`.fmt-btn[data-cmd="${cmd}"]`);
            if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
        });
        // List states
        const listCmds = ['insertUnorderedList', 'insertOrderedList'];
        listCmds.forEach((cmd) => {
            const btn = document.querySelector(`.fmt-btn[data-cmd="${cmd}"]`);
            if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
        });
        // Check block format
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const block = getParentBlock(sel.anchorNode);
            document.querySelectorAll('.fmt-btn[data-cmd="formatBlock"]').forEach((btn) => {
                btn.classList.toggle('active', block && block.tagName === btn.dataset.val);
            });
        }
        // Update live stats
        updateStats();
    }

    // ===== Export Note as PDF =====
    function exportNotePdf() {
        if (!el.body.innerHTML.trim() && !el.title.value.trim()) {
            showToast('Nothing to export');
            return;
        }

        showToast('Generating PDF...');

        var noteTitle = el.title.value || 'Untitled';
        var safeName = noteTitle.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
        var savedScroll = window.scrollY;

        // Clone the note body
        var bodyClone = el.body.cloneNode(true);
        bodyClone.removeAttribute('contenteditable');
        bodyClone.removeAttribute('id');
        bodyClone.removeAttribute('class');

        // Remove editor-only UI
        bodyClone.querySelectorAll('.resize-handle, .element-delete, .drag-placeholder, .drag-grip').forEach(function(e) { e.remove(); });

        // --- Replace media with styled placeholders ---
        bodyClone.querySelectorAll('video').forEach(function(v) {
            var src = (v.querySelector('source') || v).getAttribute('src') || '';
            var name = src ? decodeURIComponent(src.split('/').pop().split('?')[0]) : 'Video';
            var ph = document.createElement('div');
            ph.innerHTML = '<span style="font-size:16px;">&#127916;</span> <strong>Video:</strong> ' + escapeHtml(name);
            ph.style.cssText = 'padding:10px 14px;background:#fff3e0;border-left:4px solid #ff9900;border-radius:0 6px 6px 0;color:#333;font-size:13px;margin:10px 0;page-break-inside:avoid;';
            v.replaceWith(ph);
        });
        bodyClone.querySelectorAll('audio').forEach(function(a) {
            var src = (a.querySelector('source') || a).getAttribute('src') || '';
            var name = src ? decodeURIComponent(src.split('/').pop().split('?')[0]) : 'Audio';
            var ph = document.createElement('div');
            ph.innerHTML = '<span style="font-size:16px;">&#128266;</span> <strong>Audio:</strong> ' + escapeHtml(name);
            ph.style.cssText = 'padding:10px 14px;background:#fff3e0;border-left:4px solid #ff9900;border-radius:0 6px 6px 0;color:#333;font-size:13px;margin:10px 0;page-break-inside:avoid;';
            a.replaceWith(ph);
        });
        bodyClone.querySelectorAll('iframe').forEach(function(f) {
            var src = f.getAttribute('src') || '';
            var ph = document.createElement('div');
            ph.innerHTML = '<span style="font-size:16px;">&#127760;</span> <strong>Embedded:</strong> ' + escapeHtml(src);
            ph.style.cssText = 'padding:10px 14px;background:#fff3e0;border-left:4px solid #ff9900;border-radius:0 6px 6px 0;color:#333;font-size:13px;margin:10px 0;word-break:break-all;page-break-inside:avoid;';
            f.replaceWith(ph);
        });

        // --- Fix images ---
        bodyClone.querySelectorAll('img').forEach(function(img) {
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.display = 'block';
            img.style.margin = '8px 0';
            img.style.pageBreakInside = 'avoid';
        });

        // --- Fix tables: strip hardcoded widths, apply inline styles ---
        bodyClone.querySelectorAll('table').forEach(function(t) {
            t.removeAttribute('width');
            t.style.cssText = 'width:100%;table-layout:fixed;border-collapse:collapse;font-size:14px;margin:14px 0;background:#fff;page-break-inside:auto;';
            t.querySelectorAll('col, colgroup').forEach(function(c) { c.removeAttribute('width'); c.removeAttribute('style'); });
        });
        bodyClone.querySelectorAll('th').forEach(function(th) {
            th.removeAttribute('width');
            th.style.cssText = 'word-break:break-word;overflow-wrap:break-word;padding:10px 14px;border:2px solid #232f3e;text-align:left;vertical-align:top;background:#232f3e;color:#fff;font-weight:600;text-transform:uppercase;font-size:12px;letter-spacing:1px;';
        });
        bodyClone.querySelectorAll('td').forEach(function(td) {
            td.removeAttribute('width');
            td.style.cssText = 'word-break:break-word;overflow-wrap:break-word;padding:10px 14px;border:2px solid #232f3e;text-align:left;vertical-align:top;background:#fff;color:#333;min-width:80px;';
        });
        // Alternating row color
        bodyClone.querySelectorAll('table').forEach(function(table) {
            var rows = table.querySelectorAll('tbody tr');
            rows.forEach(function(tr, i) {
                if (i % 2 === 1) {
                    tr.querySelectorAll('td').forEach(function(td) { td.style.background = '#f8f9fa'; });
                }
                tr.style.pageBreakInside = 'avoid';
            });
        });

        // --- Fix headings (match editor exactly) ---
        bodyClone.querySelectorAll('h2').forEach(function(h2) {
            h2.style.cssText = 'color:#232f3e;background:transparent;font-size:22px;font-weight:700;margin:20px 0 10px 0;border-bottom:2px solid #ff9900;padding-bottom:6px;page-break-after:avoid;page-break-inside:avoid;overflow-wrap:anywhere;';
        });
        bodyClone.querySelectorAll('h3').forEach(function(h3) {
            h3.style.cssText = 'color:#232f3e;background:transparent;font-size:18px;font-weight:700;margin:16px 0 8px 0;page-break-after:avoid;page-break-inside:avoid;overflow-wrap:anywhere;';
        });
        bodyClone.querySelectorAll('h1,h4,h5,h6').forEach(function(h) {
            h.style.color = '#232f3e';
            h.style.background = 'transparent';
            h.style.pageBreakAfter = 'avoid';
            h.style.pageBreakInside = 'avoid';
        });

        // --- Fix code blocks ---
        bodyClone.querySelectorAll('pre').forEach(function(pre) {
            pre.style.cssText = 'background:#1e1e2e;color:#cdd6f4;border:1px solid #45475a;border-radius:8px;padding:14px 18px;font-family:Consolas,monospace;font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word;margin:12px 0;overflow:hidden;max-width:100%;page-break-inside:avoid;';
        });

        // --- Fix blockquotes ---
        bodyClone.querySelectorAll('blockquote').forEach(function(bq) {
            bq.style.cssText = 'border-left:4px solid #ff9900;padding-left:16px;color:#555;margin:12px 0;font-style:italic;background:transparent;page-break-inside:avoid;';
        });

        // --- Fix links ---
        bodyClone.querySelectorAll('a').forEach(function(a) {
            a.style.color = '#ec7211';
            a.style.textDecoration = 'underline';
            a.style.background = 'transparent';
        });

        // --- Fix marks ---
        bodyClone.querySelectorAll('mark').forEach(function(m) {
            m.style.cssText = 'background:#ffe066;color:#333;padding:1px 3px;border-radius:2px;';
        });

        // --- Fix lists ---
        bodyClone.querySelectorAll('ul, ol').forEach(function(list) {
            list.style.pageBreakInside = 'auto';
            list.style.background = 'transparent';
        });
        bodyClone.querySelectorAll('li').forEach(function(li) {
            li.style.color = '#333';
            li.style.background = 'transparent';
            li.style.pageBreakInside = 'avoid';
            li.style.marginBottom = '6px';
        });

        // --- Fix paragraphs ---
        bodyClone.querySelectorAll('p').forEach(function(p) {
            p.style.pageBreakInside = 'avoid';
            p.style.background = 'transparent';
            if (!p.style.color || p.style.color === 'rgb(232, 232, 232)' || p.style.color === '#e8e8e8') {
                p.style.color = '#333';
            }
        });

        // --- Fix hr dividers ---
        bodyClone.querySelectorAll('hr').forEach(function(hr) {
            hr.style.cssText = 'border:none;border-top:3px solid #ff9900;margin:20px 0;page-break-after:avoid;';
        });

        // --- Strip oversized inline widths ---
        bodyClone.querySelectorAll('[style]').forEach(function(node) {
            if (node.style.width) {
                var w = parseInt(node.style.width, 10);
                if (w > 600) node.style.width = '100%';
            }
            if (node.style.minWidth && node.tagName !== 'TD') node.style.minWidth = '0';
        });

        // --- Force visible text on dark bg elements (outside pre/table) ---
        bodyClone.querySelectorAll('div, span, strong, em, b, i, u, s').forEach(function(n) {
            if (!n.closest('pre') && !n.closest('table') && !n.closest('[style*="border-left"]')) {
                var bg = n.style.backgroundColor || '';
                if (bg && bg !== 'transparent' && bg !== '#ffe066' && bg !== '#fff3e0') {
                    var tmp = document.createElement('div');
                    tmp.style.backgroundColor = bg;
                    document.body.appendChild(tmp);
                    var computed = getComputedStyle(tmp).backgroundColor;
                    document.body.removeChild(tmp);
                    var match = computed.match(/\d+/g);
                    if (match) {
                        var r = parseInt(match[0]), g = parseInt(match[1]), bv = parseInt(match[2]);
                        var brightness = (r * 299 + g * 587 + bv * 114) / 1000;
                        if (brightness < 50) n.style.backgroundColor = 'transparent';
                    }
                }
                if (!n.style.color || n.style.color === 'rgb(232, 232, 232)' || n.style.color === '#e8e8e8') {
                    n.style.color = '#333';
                }
            }
        });

        // --- Build wrapper (white overlay, NO outer frame border — allows page breaks) ---
        var wrapper = document.createElement('div');
        wrapper.id = 'pdf-export-wrapper';
        wrapper.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:999999;background:#ffffff;overflow:auto;display:flex;justify-content:center;padding:0;margin:0;';

        var page = document.createElement('div');
        page.style.cssText = 'width:700px;max-width:700px;background:#ffffff;padding:0;margin:0;font-family:Segoe UI,-apple-system,BlinkMacSystemFont,sans-serif;box-sizing:border-box;';

        // Title bar (matches editor: dark border bottom, uppercase, bold)
        var titleBar = document.createElement('div');
        titleBar.style.cssText = 'padding:24px 40px 14px;border-bottom:4px solid #232f3e;background:#ffffff;page-break-inside:avoid;';
        var titleDiv = document.createElement('div');
        titleDiv.textContent = noteTitle;
        titleDiv.style.cssText = 'font-size:24px;font-weight:700;color:#232f3e;text-transform:uppercase;letter-spacing:2px;word-wrap:break-word;';
        titleBar.appendChild(titleDiv);
        // Orange accent line under title
        var accentLine = document.createElement('div');
        accentLine.style.cssText = 'height:3px;background:#ff9900;margin-top:10px;border-radius:2px;';
        titleBar.appendChild(accentLine);
        page.appendChild(titleBar);

        // Body content (matches editor: padding, font-size, line-height)
        var bodyDiv = document.createElement('div');
        bodyDiv.style.cssText = 'padding:24px 40px 40px;font-size:16px;line-height:1.8;color:#333;word-wrap:break-word;overflow-wrap:break-word;background:#ffffff;';
        bodyDiv.appendChild(bodyClone);
        page.appendChild(bodyDiv);

        wrapper.appendChild(page);
        document.body.appendChild(wrapper);
        wrapper.scrollTop = 0;

        // Wait for images to load
        var imgs = Array.from(wrapper.querySelectorAll('img'));
        var imgPromises = imgs.map(function(img) {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(function(resolve) {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 3000);
            });
        });

        Promise.all(imgPromises).then(function() {
            setTimeout(function() {
                html2pdf().set({
                    margin: [10, 10, 10, 10],
                    filename: safeName,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        allowTaint: true,
                        logging: false,
                        backgroundColor: '#ffffff'
                    },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: {
                        mode: ['avoid-all', 'css', 'legacy'],
                        before: [],
                        after: [],
                        avoid: ['tr', 'thead', 'th', 'td', 'img', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'p', 'blockquote', 'pre', 'figure']
                   
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 3000);
            });
        });

        Promise.all(imgPromises).then(function() {
            setTimeout(function() {
                html2pdf().set({
                    margin: [10, 10, 10, 10],
                    filename: safeName,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        allowTaint: true,
                        logging: false,
                        backgroundColor: '#ffffff'
                    },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: {
                        mode: ['avoid-all', 'css', 'legacy'],
                        before: [],
                        after: [],
                        avoid: ['tr', 'thead', 'th', 'td', 'img', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'p', 'blockquote', 'pre', 'figure']
                    }
                }).from(page).save().then(function() {
                    wrapper.remove();
                    window.scrollTo(0, savedScroll);
                    showToast('PDF exported!');
                }).catch(function(err) {
                    console.error('PDF export error:', err);
                    wrapper.remove();
                    window.scrollTo(0, savedScroll);
                    showToast('PDF export failed');
                });
            }, 600);
        });
    }

    // ===== Helpers =====
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function formatDate(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
            ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    function wordCount(str) {
        if (!str) return 0;
        return str.trim().split(/\s+/).filter(Boolean).length;
    }

    let toastTimer;
    function showToast(msg) {
        el.toast.textContent = msg;
        el.toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2500);
    }

    // ===== Auto-save on typing (debounced) =====
    let autoSaveTimer;
    function scheduleAutoSave() {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            if (editingId) {
                const note = notes.find((n) => n.id === editingId);
                if (note) {
                    note.title = el.title.value.trim() || 'Untitled';
                    note.body = el.body.innerHTML.trim();
                    note.textContent = el.body.innerText.trim();
                    note.pinned = el.btnPin.classList.contains('pinned');
                    note.topic = el.noteTopic ? el.noteTopic.value : '';
                    note.updatedAt = Date.now();
                    saveNotes();
                }
            }
        }, 1500);
    }

    // ===== Events =====
    function bind() {
        el.btnNewNote.addEventListener('click', () => openEditor(null));
        el.btnExport.addEventListener('click', exportNotes);
        el.btnSetBackupFolder.addEventListener('click', pickBackupFolder);
        el.btnClose.addEventListener('click', closeEditor);
        el.btnSave.addEventListener('click', saveNote);
        el.btnDelete.addEventListener('click', deleteNote);

        // Import
        el.btnImport.addEventListener('click', () => el.importInput.click());
        el.importInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) importNotes(e.target.files[0]);
            e.target.value = '';
        });

        // Sort
        if (el.sortSelect) el.sortSelect.addEventListener('change', () => render(getSearchFilter()));

        // Fullscreen
        el.btnFullscreen.addEventListener('click', toggleFullscreen);

        // Undo / Redo
        el.btnUndo.addEventListener('click', (e) => { e.preventDefault(); doUndo(); });
        el.btnRedo.addEventListener('click', (e) => { e.preventDefault(); doRedo(); });

        el.btnPin.addEventListener('click', () => {
            el.btnPin.classList.toggle('pinned');
        });

        // Close modal on backdrop click
        el.overlay.addEventListener('click', (e) => {
            if (e.target === el.overlay) closeEditor();
        });

        // Close on Escape + Undo/Redo shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && el.overlay.classList.contains('open')) closeEditor();
            // Ctrl+Z = undo, Ctrl+Y or Ctrl+Shift+Z = redo (only when editor is open)
            if (el.overlay.classList.contains('open') && (e.ctrlKey || e.metaKey)) {
                if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    doUndo();
                } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
                    e.preventDefault();
                    doRedo();
                }
            }
        });

        // Search
        if (el.searchInput) el.searchInput.addEventListener('input', () => render(getSearchFilter()));

        // Format toolbar
        $$('.fmt-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (btn.dataset.cmd) {
                    execFormat(btn.dataset.cmd, btn.dataset.val);
                    el.body.focus();
                }
            });
        });

        // Font size select — save selection before dropdown steals focus
        el.fontSizeSelect.addEventListener('mousedown', () => {
            saveSelection();
        });
        el.fontSizeSelect.addEventListener('change', () => {
            const val = el.fontSizeSelect.value;
            if (val) {
                restoreSelection();
                document.execCommand('fontSize', false, val);
                scheduleAutoSave();
            }
            el.fontSizeSelect.value = '';
        });

        // Text color picker
        el.textColorPicker.addEventListener('input', () => {
            el.body.focus();
            document.execCommand('foreColor', false, el.textColorPicker.value);
            el.textColorIndicator.style.background = el.textColorPicker.value;
            scheduleAutoSave();
        });

        // Highlight color picker
        el.highlightColorPicker.addEventListener('input', () => {
            el.highlightColorIndicator.style.background = el.highlightColorPicker.value;
        });

        // Insert code block
        el.btnInsertCode.addEventListener('click', (e) => { e.preventDefault(); insertCodeBlock(); });

        // Insert table
        el.btnInsertTable.addEventListener('click', (e) => { e.preventDefault(); insertTable(); });

        // Auto-save while typing + capture undo snapshots
        el.body.addEventListener('input', () => {
            scheduleAutoSave();
            scheduleHistorySnapshot();
            updateStats();
        });
        el.title.addEventListener('input', scheduleAutoSave);
        // Update toolbar active states on selection/cursor change
        el.body.addEventListener('keyup', updateToolbarState);
        el.body.addEventListener('mouseup', updateToolbarState);
        el.body.addEventListener('focus', updateToolbarState);

        // Save selection when focus leaves the editor (so toolbar controls can restore it)
        el.body.addEventListener('blur', saveSelection);

        // Highlight
        el.btnHighlight.addEventListener('click', (e) => { e.preventDefault(); toggleHighlight(); });

        // Insert image
        el.btnInsertImage.addEventListener('click', () => el.imageInput.click());
        el.imageInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) insertImage(e.target.files[0]);
            e.target.value = '';
        });

        // Insert shapes
        el.btnInsertRect.addEventListener('click', insertRect);
        el.btnInsertCircle.addEventListener('click', insertCircle);
        el.btnInsertLine.addEventListener('click', insertLine);
        el.btnInsertDivider.addEventListener('click', insertDivider);

        // Export PDF
        el.btnExportPdf.addEventListener('click', exportNotePdf);

        // Allow paste images
        el.body.addEventListener('paste', function (e) {
            const items = (e.clipboardData || {}).items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                    e.preventDefault();
                    const file = items[i].getAsFile();
                    if (file) insertImage(file);
                    return;
                }
            }
        });

        // Allow drag-drop images into editor
        el.body.addEventListener('drop', function (e) {
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                e.preventDefault();
                insertImage(files[0]);
            }
        });

        // ===== Topics Sidebar =====
        // Add topic button
        el.btnAddTopic.addEventListener('click', () => {
            const name = prompt('Enter topic name:');
            if (name) addTopic(name);
        });

        // Delete selected topic button
        el.btnDeleteTopic.addEventListener('click', () => {
            if (activeTopic === 'all' || activeTopic === 'uncategorized') {
                showToast('Select a topic to delete');
                return;
            }
            const topic = topics.find((t) => t.id === activeTopic);
            if (!topic) return;
            if (!confirm('Delete topic "' + topic.name + '"? Notes will be moved to Uncategorized.')) return;
            deleteTopic(activeTopic);
        });

        // Fixed sidebar items click
        el.topicList.querySelectorAll('.topic-item:not(.topic-item-custom)').forEach((item) => {
            item.addEventListener('click', () => {
                activeTopic = item.dataset.topic;
                renderTopics();
                render(getSearchFilter());
            });
        });

        // Collapse sidebar
        el.btnCollapseSidebar.addEventListener('click', () => {
            el.topicsSidebar.classList.add('collapsed');
            // Create expand button
            let expandBtn = document.querySelector('.sidebar-expand-btn');
            if (!expandBtn) {
                expandBtn = document.createElement('button');
                expandBtn.className = 'sidebar-expand-btn';
                expandBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                expandBtn.addEventListener('click', () => {
                    el.topicsSidebar.classList.remove('collapsed');
                    expandBtn.remove();
                });
                document.body.appendChild(expandBtn);
            }
        });

        // Mobile sidebar toggle (hamburger menu)
        if (el.btnToggleSidebar) {
            // Create overlay element
            let sidebarOverlay = document.querySelector('.sidebar-overlay');
            if (!sidebarOverlay) {
                sidebarOverlay = document.createElement('div');
                sidebarOverlay.className = 'sidebar-overlay';
                document.body.appendChild(sidebarOverlay);
            }

            const closeMobileSidebar = () => {
                el.topicsSidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('show');
            };

            el.btnToggleSidebar.addEventListener('click', () => {
                const isOpen = el.topicsSidebar.classList.contains('mobile-open');
                if (isOpen) {
                    closeMobileSidebar();
                } else {
                    el.topicsSidebar.classList.add('mobile-open');
                    el.topicsSidebar.classList.remove('collapsed');
                    sidebarOverlay.classList.add('show');
                }
            });

            sidebarOverlay.addEventListener('click', closeMobileSidebar);
        }

        // Topic change in editor auto-saves
        if (el.noteTopic) {
            el.noteTopic.addEventListener('change', scheduleAutoSave);
        }

        // ===== 120Hz Smooth Scroll: Navbar shadow on scroll =====
        let lastScrollY = 0;
        let navbarTicking = false;
        const navbar = document.querySelector('.navbar');
        window.addEventListener('scroll', () => {
            lastScrollY = window.scrollY;
            if (!navbarTicking) {
                requestAnimationFrame(() => {
                    if (navbar) {
                        navbar.classList.toggle('scrolled', lastScrollY > 10);
                    }
                    navbarTicking = false;
                });
                navbarTicking = true;
            }
        }, { passive: true });

        // Add ripple class to all primary buttons
        document.querySelectorAll('.btn-primary').forEach(b => b.classList.add('btn-ripple'));
    }

    // ===== Backup Popup =====
    function showBackupPopup() {
        const popup = document.getElementById('backupPopup');
        if (popup && !popup.classList.contains('show')) {
            setTimeout(() => popup.classList.add('show'), 500);
        }
    }

    function hideBackupPopup() {
        const popup = document.getElementById('backupPopup');
        if (popup) popup.classList.remove('show');
    }

    async function verifyBackupAccess() {
        if (!backupDirHandle) return false;
        try {
            const perm = await backupDirHandle.queryPermission({ mode: 'readwrite' });
            if (perm === 'granted') return true;
            // Try requesting permission silently — browser may auto-grant
            const req = await backupDirHandle.requestPermission({ mode: 'readwrite' });
            return req === 'granted';
        } catch (_) {
            return false;
        }
    }

    // ===== Init =====
    async function init() {
        try {
            loadNotes();
            loadTopics();
            // Restore backup folder handle (only if File System API is available)
            let backupReady = false;
            if (window.showDirectoryPicker) {
                try {
                    const savedHandle = await loadBackupHandle();
                    if (savedHandle) {
                        backupDirHandle = savedHandle;
                        backupReady = await verifyBackupAccess();
                        if (backupReady) {
                            await loadFromBackup();
                        } else {
                            backupDirHandle = null;
                        }
                    }
                } catch (backupErr) {
                    console.warn('Backup restore skipped:', backupErr);
                    backupDirHandle = null;
                }
            }
            bind();
            renderTopics();
            updateTopicSelect();
            render();

            // Show popup if backup folder is not configured or permission lost
            if (!backupReady) {
                showBackupPopup();
            }

            // Bind popup buttons
            const popupBtn = document.getElementById('backupPopupBtn');
            const popupClose = document.getElementById('backupPopupClose');
            if (popupBtn) {
                popupBtn.addEventListener('click', () => {
                    hideBackupPopup();
                    pickBackupFolder();
                });
            }
            if (popupClose) {
                popupClose.addEventListener('click', () => {
                    hideBackupPopup();
                });
            }
        } catch (err) {
            console.error('CloudNotes init error:', err);
            showToast('Something went wrong — please refresh');
        }
    }

    // Global error handler — prevent silent failures
    window.addEventListener('error', (e) => {
        console.error('CloudNotes Error:', e.error || e.message);
    });
    window.addEventListener('unhandledrejection', (e) => {
        console.error('CloudNotes Unhandled Promise:', e.reason);
    });

    init();
})();
