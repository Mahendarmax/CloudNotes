    function exportNotePdf() {
        if (!el.body.innerHTML.trim() && !el.title.value.trim()) {
            showToast('Nothing to export');
            return;
        }

        showToast('Generating PDF...');

        var bodyHTML = el.body.innerHTML;
        var noteTitle = el.title.value || 'Untitled';
        var safeName = noteTitle.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';

        // Build clean HTML for PDF
        var pdfHTML = '<!DOCTYPE html><html><head><style>' +
            '* { box-sizing: border-box; margin: 0; padding: 0; }' +
            'body { font-family: Segoe UI, Arial, Helvetica, sans-serif; color: #333; background: #fff; padding: 45px 50px; width: 794px; word-wrap: break-word; overflow-wrap: break-word; }' +
            'h1.pdf-title { font-size: 22px; color: #232f3e; text-transform: uppercase; letter-spacing: 2px; border-bottom: 3px solid #ff9900; padding-bottom: 8px; margin-bottom: 20px; word-wrap: break-word; }' +
            '.pdf-body { font-size: 14px; line-height: 1.7; color: #333; word-wrap: break-word; overflow-wrap: break-word; }' +
            '.pdf-body img { max-width: 100%; height: auto; display: block; margin: 10px 0; border-radius: 4px; }' +
            '.pdf-body video, .pdf-body audio, .pdf-body iframe { display: none !important; }' +
            '.media-placeholder { display: block; padding: 12px 16px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; color: #555; font-size: 13px; margin: 10px 0; }' +
            '.pdf-body a { color: #e47911; text-decoration: underline; }' +
            '.link-url { color: #888; font-size: 11px; word-break: break-all; }' +
            '.pdf-body h2 { color: #232f3e; font-size: 18px; border-bottom: 2px solid #ff9900; padding-bottom: 4px; margin: 16px 0 8px; }' +
            '.pdf-body blockquote { border-left: 3px solid #ff9900; padding-left: 12px; margin: 10px 0; font-style: italic; color: #666; }' +
            '.pdf-body ul, .pdf-body ol { padding-left: 24px; margin: 8px 0; }' +
            '.pdf-body table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; word-wrap: break-word; margin: 10px 0; }' +
            '.pdf-body td, .pdf-body th { border: 1px solid #ccc; padding: 5px 8px; word-wrap: break-word; overflow-wrap: break-word; }' +
            '.pdf-body th { background: #f5f5f5; font-weight: 700; }' +
            '.pdf-body pre { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 10px; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; overflow: hidden; max-width: 100%; margin: 10px 0; font-family: Consolas, monospace; }' +
            '.pdf-body hr { border: none; border-top: 2px solid #ff9900; margin: 14px 0; }' +
            '.pdf-body mark { background: #ffe066; padding: 1px 3px; border-radius: 2px; }' +
            '.pdf-body .note-shape-rect { border: 2px solid #232f3e; border-radius: 4px; background: rgba(255,153,0,0.06); margin: 10px auto; padding: 8px; text-align: center; font-size: 13px; }' +
            '.pdf-body .note-shape-circle { border: 2px solid #232f3e; border-radius: 50%; background: rgba(255,153,0,0.06); margin: 10px auto; padding: 12px; text-align: center; font-size: 12px; }' +
            '.pdf-footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #999; font-style: italic; }' +
            '.resize-handle, .element-delete, .drag-placeholder, .drag-grip { display: none !important; }' +
            '</style></head><body>' +
            '<h1 class="pdf-title">' + noteTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</h1>' +
            '<div class="pdf-body" id="pdfBody"></div>' +
            '<div class="pdf-footer">CloudNotes By Mahendar &mdash; ' + new Date().toLocaleDateString() + '</div>' +
            '</body></html>';

        // Create container div in the main document
        var container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:0;top:0;width:794px;z-index:99999;background:#fff;overflow:visible;';
        document.body.appendChild(container);

        // Parse and inject
        container.innerHTML = pdfHTML;

        // We need a real DOM — parse it properly
        container.innerHTML = '';
        container.style.cssText = 'position:fixed;left:0;top:0;width:794px;z-index:99999;background:#fff;overflow:visible;padding:45px 50px;font-family:Segoe UI,Arial,sans-serif;color:#333;box-sizing:border-box;';

        // Title
        var titleDiv = document.createElement('h1');
        titleDiv.textContent = noteTitle;
        titleDiv.style.cssText = 'font-size:22px;color:#232f3e;text-transform:uppercase;letter-spacing:2px;border-bottom:3px solid #ff9900;padding-bottom:8px;margin:0 0 20px 0;word-wrap:break-word;';
        container.appendChild(titleDiv);

        // Body
        var bodyDiv = document.createElement('div');
        bodyDiv.innerHTML = bodyHTML;
        bodyDiv.style.cssText = 'font-size:14px;line-height:1.7;color:#333;word-wrap:break-word;overflow-wrap:break-word;';
        container.appendChild(bodyDiv);

        // Process media: replace video with placeholder
        bodyDiv.querySelectorAll('video').forEach(function(v) {
            var src = '';
            var sourceEl = v.querySelector('source');
            if (sourceEl) src = sourceEl.getAttribute('src') || '';
            if (!src) src = v.getAttribute('src') || '';
            var name = src ? decodeURIComponent(src.split('/').pop().split('?')[0]) : 'Embedded video';
            var ph = document.createElement('div');
            ph.className = 'media-placeholder';
            ph.textContent = '\uD83C\uDFAC Video: ' + name;
            ph.style.cssText = 'display:block;padding:12px 16px;background:#f5f5f5;border:1px solid #ddd;border-radius:6px;color:#555;font-size:13px;margin:10px 0;';
            v.replaceWith(ph);
        });

        // Audio
        bodyDiv.querySelectorAll('audio').forEach(function(a) {
            var src = '';
            var sourceEl = a.querySelector('source');
            if (sourceEl) src = sourceEl.getAttribute('src') || '';
            if (!src) src = a.getAttribute('src') || '';
            var name = src ? decodeURIComponent(src.split('/').pop().split('?')[0]) : 'Embedded audio';
            var ph = document.createElement('div');
            ph.className = 'media-placeholder';
            ph.textContent = '\uD83D\uDD0A Audio: ' + name;
            ph.style.cssText = 'display:block;padding:12px 16px;background:#f5f5f5;border:1px solid #ddd;border-radius:6px;color:#555;font-size:13px;margin:10px 0;';
            a.replaceWith(ph);
        });

        // Iframes (YouTube etc)
        bodyDiv.querySelectorAll('iframe').forEach(function(f) {
            var src = f.getAttribute('src') || '';
            var ph = document.createElement('div');
            ph.className = 'media-placeholder';
            ph.textContent = '\uD83C\uDFAC Embedded: ' + src;
            ph.style.cssText = 'display:block;padding:12px 16px;background:#f5f5f5;border:1px solid #ddd;border-radius:6px;color:#555;font-size:13px;margin:10px 0;word-break:break-all;';
            f.replaceWith(ph);
        });

        // Links: show URL
        bodyDiv.querySelectorAll('a[href]').forEach(function(a) {
            var href = a.getAttribute('href') || '';
            var text = a.textContent || '';
            a.style.color = '#e47911';
            a.style.textDecoration = 'underline';
            if (href && href !== text && href.indexOf('#') !== 0 && href.indexOf('javascript') !== 0) {
                var urlSpan = document.createElement('span');
                urlSpan.textContent = ' [' + href + ']';
                urlSpan.style.cssText = 'color:#888;font-size:11px;word-break:break-all;';
                a.parentNode.insertBefore(urlSpan, a.nextSibling);
            }
        });

        // Images: ensure sizing
        bodyDiv.querySelectorAll('img').forEach(function(img) {
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.display = 'block';
            img.style.margin = '10px 0';
            img.style.borderRadius = '4px';
        });

        // Convert <font> tags
        bodyDiv.querySelectorAll('font').forEach(function(font) {
            var span = document.createElement('span');
            var size = font.getAttribute('size');
            if (size) {
                var sizeMap = { '1': '10px', '2': '13px', '3': '16px', '4': '18px', '5': '24px', '6': '32px', '7': '48px' };
                span.style.fontSize = sizeMap[size] || '16px';
            }
            var color = font.getAttribute('color');
            if (color) span.style.color = color;
            var face = font.getAttribute('face');
            if (face) span.style.fontFamily = face;
            span.innerHTML = font.innerHTML;
            font.replaceWith(span);
        });

        // Style headings
        bodyDiv.querySelectorAll('h2').forEach(function(h) {
            h.style.cssText = 'color:#232f3e;font-size:18px;border-bottom:2px solid #ff9900;padding-bottom:4px;margin:16px 0 8px;';
        });

        // Blockquotes
        bodyDiv.querySelectorAll('blockquote').forEach(function(bq) {
            bq.style.cssText = 'border-left:3px solid #ff9900;padding-left:12px;margin:10px 0;font-style:italic;color:#666;';
        });

        // Lists
        bodyDiv.querySelectorAll('ul, ol').forEach(function(list) {
            list.style.paddingLeft = '24px';
            list.style.margin = '8px 0';
        });

        // Tables
        bodyDiv.querySelectorAll('table').forEach(function(table) {
            table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;word-wrap:break-word;margin:10px 0;';
        });
        bodyDiv.querySelectorAll('td, th').forEach(function(cell) {
            cell.style.cssText = 'border:1px solid #ccc;padding:5px 8px;word-wrap:break-word;overflow-wrap:break-word;';
        });
        bodyDiv.querySelectorAll('th').forEach(function(th) {
            th.style.background = '#f5f5f5';
            th.style.fontWeight = '700';
        });

        // Code blocks
        bodyDiv.querySelectorAll('pre').forEach(function(pre) {
            pre.style.cssText = 'background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:10px;font-size:12px;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;max-width:100%;margin:10px 0;font-family:Consolas,monospace;';
        });

        // Dividers
        bodyDiv.querySelectorAll('hr').forEach(function(hr) {
            hr.style.cssText = 'border:none;border-top:2px solid #ff9900;margin:14px 0;';
        });

        // Marks
        bodyDiv.querySelectorAll('mark').forEach(function(m) {
            m.style.cssText = 'background:#ffe066;padding:1px 3px;border-radius:2px;';
        });

        // Remove UI controls
        bodyDiv.querySelectorAll('.resize-handle, .element-delete, .drag-placeholder, .drag-grip').forEach(function(e) { e.remove(); });

        // Footer
        var footerDiv = document.createElement('div');
        footerDiv.textContent = 'CloudNotes By Mahendar \u2014 ' + new Date().toLocaleDateString();
        footerDiv.style.cssText = 'margin-top:30px;padding-top:10px;border-top:1px solid #ddd;text-align:center;font-size:10px;color:#999;font-style:italic;';
        container.appendChild(footerDiv);

        // Wait for images to load
        var imgs = Array.from(bodyDiv.querySelectorAll('img'));
        var imgPromises = imgs.map(function(img) {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(function(resolve) {
                img.onload = resolve;
                img.onerror = function() {
                    img.style.display = 'none';
                    resolve();
                };
                setTimeout(resolve, 3000);
            });
        });

        Promise.all(imgPromises).then(function() {
            setTimeout(function() {
                var opt = {
                    margin: [8, 0, 8, 0],
                    filename: safeName,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        allowTaint: true,
                        logging: false,
                        scrollX: 0,
                        scrollY: 0,
                        width: 794,
                        windowWidth: 794,
                        x: container.getBoundingClientRect().left,
                        y: container.getBoundingClientRect().top,
                    },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                    pagebreak: { mode: ['css', 'legacy'] },
                };

                html2pdf().set(opt).from(container).save().then(function() {
                    document.body.removeChild(container);
                    showToast('PDF exported!');
                }).catch(function() {
                    if (container.parentNode) document.body.removeChild(container);
                    showToast('PDF export failed');
                });
            }, 500);
        });
    }
