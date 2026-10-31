(function ($) {
    'use strict';

    // ==========================================
    // CRUD & INLINE EDITING UNTUK TABEL DAFTAR TAMU
    // ==========================================

    function getBaseInvitationUrl() {
        var gid = window.guestInvitationData || {};
        var $select = $('#select_invitation_link');
        var selectedVal = $select.length ? $select.val() : '';
        var base = selectedVal || gid.invitationLink || '';
        var param = 'to';
        var selectedParam = $select.length ? $select.find(':selected').attr('data-param') : '';
        if (selectedParam) {
            param = selectedParam;
        } else if (gid.to) {
            if (gid.to === 'settingDear') param = window.settingDear || 'dear';
            else param = gid.to;
        }
        return { base: base, param: String(param).replace(/^[?&=]+/, '') };
    }

    function generateRowUrls(guestName, phoneNumber) {
        var name = String(guestName || '').trim();
        var phone = String(phoneNumber || '').trim();
        var gid = window.guestInvitationData || {};
        var info = getBaseInvitationUrl();
        var cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^0/, '62').replace(/^8/, '628');

        // URL Undangan
        var sep = info.base.indexOf('?') !== -1 ? '&' : '?';
        var fullUrl = info.base + sep + info.param + '=' + encodeURIComponent(name);

        // Access Gate / Passkey support
        var magicUrl = fullUrl;
        if (gid.passkey && typeof window.wdpGuestKey === 'function' && gid.targetPostId) {
            var gk = window.wdpGuestKey(gid.passkey, gid.targetPostId, name);
            if (gk) magicUrl = fullUrl + (fullUrl.indexOf('?') !== -1 ? '&' : '?') + 'key=' + encodeURIComponent(gk);
        }

        // Teks Pengantar
        var template = String($('#message').val() || gid.template || '');
        var msg = template
            .replace(/\[link-magic\]/gi, magicUrl)
            .replace(/\[link-auto-unlock\]/gi, magicUrl)
            .replace(/\[passkey\]/gi, gid.passkey || '')
            .replace(/\[devices\]/gi, gid.maxDevices > 0 ? (gid.maxDevices + ' Perangkat') : '')
            .replace(/\[link-undangan\]/gi, fullUrl)
            .replace(/\[nama-tamu\]/gi, name)
            .replace(/\[nama\]/g, name)
            .replace(/(<([^>]+)>)/gi, '');

        var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        var waBase = isMobile ? 'whatsapp://send?phone=' : 'https://api.whatsapp.com/send?phone=';
        var waLink = waBase + cleanPhone + '&text=' + encodeURIComponent(msg);

        return {
            name: name,
            phoneNumber: phone,
            waLink: waLink,
            messageText: msg,
            copyLink: magicUrl
        };
    }

    function updateTextareaFromContacts() {
        var list = window.contacts || [];
        var lines = [];
        for (var i = 0; i < list.length; i++) {
            if (!list[i] || list[i].skip) continue;
            var n = String(list[i].name || '').trim();
            var p = String(list[i].phoneNumber || '').trim();
            if (n) {
                lines.push(p ? (n + ';' + p) : n);
            }
        }
        $('#contact').val(lines.join('\n'));
        // Simpan ke storage jika ada draft
        try {
            var gid = window.guestInvitationData || {};
            var storeKey = gid.key || '';
            if (storeKey) {
                var draft = {
                    contact: lines.join('\n'),
                    message: $('#message').val() || '',
                    invitationUrl: $('#invitation_url').val() || '?dear='
                };
                localStorage.setItem(storeKey, JSON.stringify(draft));
            }
        } catch (e) { }
    }

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    }

    function renderRowHtml(index, item) {
        var num = index + 1;
        var name = item.name || '';
        var phone = item.phoneNumber || '';
        var calc = generateRowUrls(name, phone);
        item.waLink = calc.waLink;
        item.messageText = calc.messageText;
        item.copyLink = calc.copyLink;

        return '<tr data-index="' + index + '">' +
            '<td>' + num + '</td>' +
            '<td class="inline-editable-cell col-nama" data-field="name" title="Klik untuk edit nama">' +
            '<span class="editable-text">' + escapeHtml(name) + '</span>' +
            '<i class="fa fa-pen editable-hint"></i>' +
            '</td>' +
            '<td class="inline-editable-cell col-phone" data-field="phoneNumber" title="Klik untuk edit nomor telepon">' +
            '<span class="editable-text">' + (phone ? escapeHtml(phone) : '-') + '</span>' +
            '<i class="fa fa-pen editable-hint"></i>' +
            '</td>' +
            '<td style="text-align: center;">' +
            '<div class="gb-flex gb-flex-col gb-space-y-2">' +
            '<a href="' + calc.waLink + '" target="_blank" class="btn wa btn-sm1 mb-1 btn-opsi"><i class="fa fa-brands fa-whatsapp"></i> Kirim</a>\n' +
            '<a href="http://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(calc.copyLink) + '&quote=' + encodeURIComponent(calc.copyLink) + '" target="_blank" class="btn fb btn-sm1 mb-1 btn-opsi"><i class="fa fa-brands fa-facebook"></i> Kirim</a>\n' +
            '<a href="' + escapeHtml(calc.copyLink) + '" target="_blank" class="btn visit btn-sm1 mb-1 btn-opsi"><i class="fa-solid fa-arrow-up-right-from-square"></i> Visit</a>\n' +
            '<button data-action="copy" data-clipboard-text="' + escapeHtml(calc.copyLink) + '" class="btn link btn-sm1 mb-1 gb-btn-copy btn-opsi"><i class="fa-regular fa-copy"></i> Link</button>\n' +
            '<button data-action="copy" data-clipboard-text="' + escapeHtml(calc.messageText) + '" class="btn textcopy btn-sm1 mb-1 gb-btn-copy btn-opsi"><i class="fa-regular fa-copy"></i> Text</button>\n' +
            '<button data-action="edit-row" type="button" class="btn edit btn-sm1 mb-1 btn-opsi"><i class="fa fa-pencil"></i> Edit</button>\n' +
            '<button data-action="delete" type="button" class="btn hapus btn-sm1 mb-1 btn-opsi"><i class="fa fa-trash-can"></i> Hapus</button>\n' +
            '</div>' +
            '</td>' +
            '</tr>';
    }

    function renumberTable() {
        var visibleIndex = 0;
        var validContacts = [];
        var tbody = $('tbody[data-content="body--contact"]');
        tbody.find('tr').each(function () {
            var $tr = $(this);
            var oldIdx = parseInt($tr.attr('data-index'), 10);
            if (isNaN(oldIdx)) oldIdx = parseInt($.trim($tr.find('td:first').text()), 10) - 1;
            var item = (window.contacts && window.contacts[oldIdx]) ? window.contacts[oldIdx] : null;
            if (!item || item.skip) {
                $tr.remove();
                return;
            }
            $tr.find('td:first').text(visibleIndex + 1);
            $tr.attr('data-index', visibleIndex);
            validContacts.push(item);
            visibleIndex++;
        });
        window.contacts = validContacts;
        updateTextareaFromContacts();
    }

    function enhanceExistingRows() {
        var tbody = $('tbody[data-content="body--contact"]');
        tbody.find('tr').each(function (i) {
            var $tr = $(this);
            $tr.attr('data-index', i);
            var $tds = $tr.find('td');
            var $tdName = $tds.eq(1);
            var $tdPhone = $tds.eq(2);
            var $opsiDiv = $tds.eq(3).find('.gb-flex');

            if (!$tdName.hasClass('inline-editable-cell')) {
                $tdName.addClass('inline-editable-cell col-nama').attr('data-field', 'name').attr('title', 'Klik untuk edit nama');
                var currentName = $.trim($tdName.clone().children().remove().end().text());
                var badge = $tdName.find('.wdp-kk-sent-badge').detach();
                $tdName.empty().append($('<span class="editable-text"></span>').text(currentName))
                    .append($('<i class="fa fa-pen editable-hint"></i>'))
                    .append(badge);
            }

            if (!$tdPhone.hasClass('inline-editable-cell')) {
                $tdPhone.addClass('inline-editable-cell col-phone').attr('data-field', 'phoneNumber').attr('title', 'Klik untuk edit nomor telepon');
                var currentPhone = $.trim($tdPhone.text());
                $tdPhone.empty().append($('<span class="editable-text"></span>').text(currentPhone || '-'))
                    .append($('<i class="fa fa-pen editable-hint"></i>'));
            }

            if ($opsiDiv.length && !$opsiDiv.find('a.btn.visit').length) {
                var itemData = (window.contacts && window.contacts[i]) ? window.contacts[i] : null;
                var copyUrl = (itemData && itemData.copyLink) ? itemData.copyLink : '#';
                var $visitBtn = $('<a href="' + escapeHtml(copyUrl) + '" target="_blank" class="btn visit btn-sm1 mb-1 btn-opsi"><i class="fa-solid fa-arrow-up-right-from-square"></i> Visit</a>\n');
                var $linkBtn = $opsiDiv.find('button.btn.link');
                if ($linkBtn.length) {
                    $linkBtn.before($visitBtn);
                } else {
                    $opsiDiv.prepend($visitBtn);
                }
            }

            if ($opsiDiv.length && !$opsiDiv.find('button[data-action="edit-row"]').length) {
                var $editBtn = $('<button data-action="edit-row" type="button" class="btn edit btn-sm1 mb-1 btn-opsi"><i class="fa fa-pencil"></i> Edit</button>');
                $opsiDiv.find('button[data-action="delete"]').before($editBtn);
            }
        });
    }

    function applyInlineEditCell($cell) {
        if ($cell.find('input.inline-edit-input').length > 0) return;
        var $tr = $cell.closest('tr');
        var idx = parseInt($tr.attr('data-index'), 10);
        if (isNaN(idx)) idx = parseInt($.trim($tr.find('td:first').text()), 10) - 1;
        if (!window.contacts || !window.contacts[idx]) return;

        var field = $cell.attr('data-field'); // 'name' atau 'phoneNumber'
        var currentVal = field === 'phoneNumber' ? (window.contacts[idx].phoneNumber || '') : (window.contacts[idx].name || '');
        var $textSpan = $cell.find('.editable-text');
        var $hint = $cell.find('.editable-hint');
        $textSpan.hide();
        if ($hint.length) $hint.hide();

        var $input = $('<input type="text" class="inline-edit-input" />')
            .val(currentVal)
            .appendTo($cell)
            .focus();

        var committed = false;
        function commitChange() {
            if (committed) return;
            committed = true;
            var newVal = $.trim($input.val());
            $input.remove();
            if (field === 'name' && !newVal) {
                newVal = currentVal || 'Tamu';
            }
            window.contacts[idx][field] = newVal;

            // Update URL dan tombol aksi baris
            var updated = generateRowUrls(window.contacts[idx].name, window.contacts[idx].phoneNumber);
            window.contacts[idx].waLink = updated.waLink;
            window.contacts[idx].messageText = updated.messageText;
            window.contacts[idx].copyLink = updated.copyLink;

            $tr.find('a.btn.wa').attr('href', updated.waLink);
            $tr.find('a.btn.fb').attr('href', 'http://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(updated.copyLink) + '&quote=' + encodeURIComponent(updated.copyLink));
            $tr.find('a.btn.visit').attr('href', updated.copyLink);
            $tr.find('button.btn.link').attr('data-clipboard-text', updated.copyLink);
            $tr.find('button.btn.textcopy').attr('data-clipboard-text', updated.messageText);

            // Tampilkan teks baru
            if (field === 'name') {
                $textSpan.text(newVal);
            } else {
                $textSpan.text(newVal ? newVal : '-');
            }
            $textSpan.show();
            if ($hint.length) $hint.show();

            updateTextareaFromContacts();
        }

        $input.on('blur', function () {
            commitChange();
        });

        $input.on('keydown', function (e) {
            if (e.which === 13) { // Enter
                e.preventDefault();
                $input.blur();
            } else if (e.which === 27) { // Escape
                e.preventDefault();
                committed = true;
                $input.remove();
                $textSpan.show();
                if ($hint.length) $hint.show();
            }
        });
    }

    // Event delegation: Klik sel Nama atau No Telepon
    $(document).on('click', 'tbody[data-content="body--contact"] td.inline-editable-cell', function (e) {
        if ($(e.target).is('input')) return;
        applyInlineEditCell($(this));
    });

    // Event delegation: Klik tombol Edit di kolom Opsi
    $(document).on('click', 'tbody[data-content="body--contact"] button[data-action="edit-row"]', function (e) {
        e.preventDefault();
        var $tr = $(this).closest('tr');
        var $nameCell = $tr.find('td.col-nama');
        if ($nameCell.length) applyInlineEditCell($nameCell);
    });

    // Event delegation: Hapus baris dengan konfirmasi
    $(document).on('click', 'tbody[data-content="body--contact"] button[data-action="delete"]', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var $tr = $(this).closest('tr');
        var idx = parseInt($tr.attr('data-index'), 10);
        if (isNaN(idx)) idx = parseInt($.trim($tr.find('td:first').text()), 10) - 1;
        var guestName = (window.contacts && window.contacts[idx]) ? window.contacts[idx].name : '';

        if (guestName && !window.confirm('Hapus tamu "' + guestName + '" dari daftar?')) {
            return;
        }

        if (window.contacts && window.contacts[idx]) {
            window.contacts[idx].skip = true;
        }
        $tr.remove();
        renumberTable();
    });

    // Tombol Tambah Tamu Baru di atas tabel
    $(document).on('click', '#wdp-kk-add-guest', function (e) {
        e.preventDefault();
        var raw = window.prompt('Masukkan data tamu baru:\nFormat: Nama;Nomor HP (Contoh: Budi Santoso;08123456789 atau hanya nama)', '');
        if (!raw || !raw.trim()) return;

        var parts = raw.indexOf(';') !== -1 ? raw.split(';') : raw.split(' - ');
        var name = (parts[0] || '').trim();
        var phone = (parts[1] || '').trim();
        if (!name) return;

        if (!window.contacts) window.contacts = [];
        var newItem = { name: name, phoneNumber: phone };
        var newIdx = window.contacts.length;
        window.contacts.push(newItem);

        var rowHtml = renderRowHtml(newIdx, newItem);
        var $tbody = $('tbody[data-content="body--contact"]');
        $tbody.append(rowHtml);

        renumberTable();
        // Scroll ke baris baru
        var $newTr = $tbody.find('tr:last');
        if ($newTr.length && $newTr.offset()) {
            $('html, body').animate({
                scrollTop: $newTr.offset().top - 120
            }, 300);
        }
    });

    // Event saat pilihan link undangan diubah: perbarui seluruh tautan di tabel
    $(document).on('change', '#select_invitation_link', function () {
        var chosenLink = $(this).val();
        if (window.guestInvitationData) {
            window.guestInvitationData.invitationLink = chosenLink;
            window.guestInvitationData.to = $(this).find(':selected').attr('data-param') || 'to';
        }
        var $tbody = $('tbody[data-content="body--contact"]');
        var contacts = window.contacts || [];
        if (!contacts.length) return;

        $tbody.find('tr').each(function () {
            var $tr = $(this);
            var idx = parseInt($tr.attr('data-index'), 10);
            if (isNaN(idx)) idx = parseInt($.trim($tr.find('td:first').text()), 10) - 1;
            if (contacts[idx] && !contacts[idx].skip) {
                var updated = generateRowUrls(contacts[idx].name, contacts[idx].phoneNumber);
                contacts[idx].waLink = updated.waLink;
                contacts[idx].messageText = updated.messageText;
                contacts[idx].copyLink = updated.copyLink;

                $tr.find('a.btn.wa').attr('href', updated.waLink);
                $tr.find('a.btn.fb').attr('href', 'http://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(updated.copyLink) + '&quote=' + encodeURIComponent(updated.copyLink));
                $tr.find('a.btn.visit').attr('href', updated.copyLink);
                $tr.find('button.btn.link').attr('data-clipboard-text', updated.copyLink);
                $tr.find('button.btn.textcopy').attr('data-clipboard-text', updated.messageText);
            }
        });
    });

    // Observe perubahan pada tbody untuk memperkaya baris saat di-generate ulang
    var tbody = document.querySelector('tbody[data-content="body--contact"]');
    if (tbody && window.MutationObserver) {
        new MutationObserver(function () {
            enhanceExistingRows();
        }).observe(tbody, { childList: true });
    }

    // Pastikan clipboard copy tetap jalan untuk baris baru
    if (typeof ClipboardJS !== 'undefined') {
        new ClipboardJS('.gb-btn-copy').on('success', function (n) {
            var r = $('.gb-notify');
            r.show();
            setTimeout(function () { r.hide(); }, 1000);
            n.clearSelection();
        });
    }

})(jQuery);

