// index.js

// 1. Muat variabel lingkungan dari file .env
require('dotenv').config();

// 2. Import semua modul yang diperlukan
const express = require('express');
const multer = require('multer');
const fs = require('fs'); // Untuk operasi sistem file (baca/hapus file)
const path = require('path'); // Untuk bekerja dengan jalur file
const cors = require('cors'); // Untuk Cross-Origin Resource Sharing
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 3. Inisialisasi aplikasi Express
const app = express();
const PORT = process.env.PORT || 3000; // Gunakan port dari .env atau default ke 3000

// 4. Konfigurasi Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Menggunakan model Flash. Penting: Pastikan model ID sudah benar, 'gemini-1.5-flash' adalah yang umum.
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// 5. Konfigurasi Multer untuk penanganan file upload
// Menentukan tempat penyimpanan file: 'uploads/'
const upload = multer({ dest: 'uploads/' });

// --- Helper Function untuk Konversi File ke Format Gemini ---
// Fungsi ini mengonversi jalur file lokal menjadi InlineDataPart yang bisa dikirim ke Gemini.
function fileToGenerativePart(filePath, mimeType) {
  // Membaca file secara sinkron dan mengonversinya ke Base64
  const fileData = fs.readFileSync(filePath);
  return {
    inlineData: {
      data: Buffer.from(fileData).toString('base64'),
      mimeType // Penting: MIME type harus sesuai dengan tipe file
    },
  };
}

// 6. Middleware
app.use(cors()); // Mengizinkan semua origin. Sesuaikan jika Anda membutuhkan konfigurasi CORS yang lebih ketat.
app.use(express.json()); // Middleware untuk parsing JSON request body

// Middleware untuk melayani file statis dari folder uploads (opsional, untuk debugging)
// Ini memungkinkan Anda mengakses file yang diupload melalui URL (misal: http://localhost:3000/uploads/namafile.jpg)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 7. Definisi Endpoint API ---

// Endpoint Dasar: Untuk menguji apakah server berjalan
app.get('/', (req, res) => {
  res.send('Gemini Flash API server is running!');
});

/**
 * @route POST /generate-text
 * @description Menghasilkan respons teks dari Gemini berdasarkan prompt teks.
 * @body {string} prompt - Teks prompt dari pengguna.
 */
app.post('/generate-text', async (req, res) => {
  try {
    const { prompt } = req.body;

    // --- Validasi Input Prompt ---
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: 'Prompt teks diperlukan dan harus berupa string non-kosong.' });
    }

    console.log(`[${new Date().toISOString()}] Menerima prompt teks: "${prompt}"`);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ output: text });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error saat menghasilkan teks:`, error);
    res.status(500).json({
      error: 'Gagal menghasilkan teks dari Gemini.',
      details: error.message,
      tip: 'Pastikan API Key Gemini Anda valid dan service Gemini sedang tidak mengalami gangguan. Periksa juga log server untuk detail lebih lanjut.'
    });
  }
});

/**
 * @route POST /generate-from-image
 * @description Menghasilkan deskripsi teks dari Gemini berdasarkan gambar yang diunggah.
 * @body {file} image - File gambar (JPEG, PNG, dll.) dengan nama field 'image'.
 * @body {string} [prompt] - Opsional: Prompt teks kustom yang akan digabungkan dengan gambar.
 */
app.post('/generate-from-image', upload.single('image'), async (req, res) => {
  try {
    // --- Validasi file upload ---
    if (!req.file) {
      return res.status(400).json({ error: 'File gambar diperlukan.' });
    }

    const imagePath = req.file.path; // Path file gambar yang diunggah oleh Multer
    const mimeType = req.file.mimetype; // MIME type dari gambar

    // Opsional: Validasi MIME type jika Anda hanya ingin menerima jenis gambar tertentu
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(mimeType)) {
      // Hapus file yang tidak valid dan kirim error
      fs.unlink(imagePath, (err) => { // Menggunakan fs.unlink asinkron
        if (err) console.error(`[${new Date().toISOString()}] Gagal menghapus file tidak valid:`, err);
      });
      return res.status(400).json({ error: `Tipe file ${mimeType} tidak didukung. Hanya JPEG, PNG, GIF, WebP yang diizinkan.` });
    }

    // Mengambil prompt dari body atau menggunakan default jika tidak ada
    const prompt = req.body.prompt || 'Describe the image in detail.';

    console.log(`[${new Date().toISOString()}] Menerima file gambar: ${req.file.originalname} (${mimeType}) dengan prompt: "${prompt}"`);

    // Konversi gambar yang diupload ke format yang dapat diterima Gemini
    const imagePart = fileToGenerativePart(imagePath, mimeType);

    // Buat array konten untuk dikirim ke Gemini (prompt teks dan gambar)
    // Urutan elemen dalam array penting, pastikan teks dan gambar ada di sini
    const parts = [
      { text: prompt }, // Prompt teks sebagai bagian terpisah
      imagePart
    ];

    const result = await model.generateContent({ contents: [{ parts }] });
    const response = await result.response;
    const text = response.text();

    res.json({ output: text }); // Menggunakan 'output' sebagai key respons

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error saat menghasilkan deskripsi gambar:`, error);
    res.status(500).json({
      error: 'Gagal menghasilkan deskripsi dari gambar.',
      details: error.message,
      tip: 'Pastikan file yang diunggah adalah gambar yang valid dan API Key Gemini Anda berfungsi. Periksa juga log server.'
    });
  } finally {
    // Pastikan file dihapus dari folder uploads, baik sukses atau gagal
    if (req.file && fs.existsSync(req.file.path)) { // Cek apakah file ada sebelum mencoba menghapus
        fs.unlink(req.file.path, (err) => { // Gunakan fs.unlink (asinkron) untuk performa lebih baik
            if (err) console.error(`[${new Date().toISOString()}] Gagal menghapus file ${req.file.path}:`, err);
            else console.log(`[${new Date().toISOString()}] File dihapus: ${req.file.path}`);
        });
    }
  }
});

// --- 8. Menjalankan Server ---
app.listen(PORT, () => {
  console.log(`Server Gemini Flash API berjalan di http://localhost:${PORT}`);
  console.log(`Pastikan GEMINI_API_KEY Anda sudah disetel di file .env`);
});