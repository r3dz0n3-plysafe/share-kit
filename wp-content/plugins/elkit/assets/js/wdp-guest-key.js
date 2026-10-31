/**
 * Kunci akses per tamu Kirim Kit (v4.1.0).
 *
 * Kunci = 10 karakter pertama HMAC-SHA256(PIN Master, "<post_id>|<nama tamu ternormalisasi>"), identik dengan
 * WDP_Access_Ajax::guest_access_key() di PHP. Dihitung di browser operator Kirim Kit (yang memegang PIN Master)
 * sehingga [link-magic] / [passkey] di pesan tamu tidak lagi memuat PIN Master mentah: kunci hanya membuka nama
 * tamu tersebut. SHA-256 ditulis murni (tanpa WebCrypto) agar tetap berjalan di situs HTTP.
 *
 * @package WeddingPress
 */
(function (root) {
    'use strict';

    var K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    function utf8Bytes(text) {
        var binary = unescape(encodeURIComponent(String(text)));
        var out = new Array(binary.length);
        for (var i = 0; i < binary.length; i++) {
            out[i] = binary.charCodeAt(i);
        }
        return out;
    }

    function sha256(bytes) {
        var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
        var msg = bytes.slice();
        var bitLength = bytes.length * 8;
        msg.push(0x80);
        while (msg.length % 64 !== 56) {
            msg.push(0);
        }
        // Panjang pesan 64-bit big-endian (cukup 32-bit bawah untuk teks pendek; 32-bit atas tetap dihitung).
        var high = Math.floor(bitLength / 0x100000000);
        msg.push((high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff);
        msg.push((bitLength >>> 24) & 0xff, (bitLength >>> 16) & 0xff, (bitLength >>> 8) & 0xff, bitLength & 0xff);

        var w = new Array(64);
        for (var offset = 0; offset < msg.length; offset += 64) {
            for (var t = 0; t < 16; t++) {
                w[t] = (msg[offset + t * 4] << 24) | (msg[offset + t * 4 + 1] << 16) | (msg[offset + t * 4 + 2] << 8) | msg[offset + t * 4 + 3];
            }
            for (t = 16; t < 64; t++) {
                var x = w[t - 15];
                var y = w[t - 2];
                var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
                var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
                w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
            }
            var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
            for (t = 0; t < 64; t++) {
                var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
                var ch = (e & f) ^ (~e & g);
                var t1 = (k + S1 + ch + K[t] + w[t]) | 0;
                var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
                var maj = (a & b) ^ (a & c) ^ (b & c);
                var t2 = (S0 + maj) | 0;
                k = g; g = f; f = e; e = (d + t1) | 0;
                d = c; c = b; b = a; a = (t1 + t2) | 0;
            }
            h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
            h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + k) | 0;
        }

        var out = [];
        for (var i = 0; i < 8; i++) {
            out.push((h[i] >>> 24) & 0xff, (h[i] >>> 16) & 0xff, (h[i] >>> 8) & 0xff, h[i] & 0xff);
        }
        return out;
    }

    function hmacSha256(keyBytes, messageBytes) {
        if (keyBytes.length > 64) {
            keyBytes = sha256(keyBytes);
        }
        var inner = [];
        var outer = [];
        for (var i = 0; i < 64; i++) {
            var byte = keyBytes[i] || 0;
            inner.push(byte ^ 0x36);
            outer.push(byte ^ 0x5c);
        }
        return sha256(outer.concat(sha256(inner.concat(messageBytes))));
    }

    function toHex(bytes) {
        var hex = '';
        for (var i = 0; i < bytes.length; i++) {
            hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
        }
        return hex;
    }

    /**
     * Normalisasi nama tamu: spasi/tab/baris baru beruntun = satu spasi, tanpa spasi tepi, huruf kecil.
     * Sama persis dengan WDP_Access_Ajax::normalize_guest_key_name().
     *
     * @param {string} name
     * @return {string}
     */
    function normalizeName(name) {
        return String(name === null || name === undefined ? '' : name)
            .replace(/[ \t\r\n\f\v]+/g, ' ')
            .replace(/^ /, '')
            .replace(/ $/, '')
            .toLowerCase();
    }

    /**
     * @param {string}        master PIN Master undangan (dipegang operator Kirim Kit).
     * @param {number|string} postId ID undangan.
     * @param {string}        name   Nama tamu seperti di parameter ?to=.
     * @return {string} Kunci 10 karakter heksadesimal; kosong bila data tidak lengkap.
     */
    root.wdpGuestKey = function (master, postId, name) {
        var pin = String(master === null || master === undefined ? '' : master);
        var guest = normalizeName(name);
        var id = parseInt(postId, 10) || 0;
        if (!pin || !guest || id <= 0) {
            return '';
        }
        return toHex(hmacSha256(utf8Bytes(pin), utf8Bytes(id + '|' + guest))).slice(0, 10);
    };
})(window);
