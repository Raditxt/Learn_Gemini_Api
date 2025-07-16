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
// Menentukan tempat penyimpanan file: 'uploads/'. Multer akan membuat folder ini jika belum ada.
const upload = multer({ dest: 'uploads/' });

// --- Helper Function untuk Konversi File ke Format Gemini ---
// Fungsi ini mengonversi jalur file lokal menjadi InlineDataPart yang bisa dikirim ke Gemini.
// Penting: Hanya membaca file yang secara aman diasumsikan ada dan valid.
function fileToGenerativePart(filePath, mimeType) {
  const fileData = fs.readFileSync(filePath); // Membaca file secara sinkron
  return {
    inlineData: {
      data: Buffer.from(fileData).toString('base64'),
      mimeType // Penting: MIME type harus sesuai dengan tipe file
    },
  };
}

// 6. Middleware Global
app.use(cors()); // Mengizinkan semua origin. Untuk produksi, pertimbangkan untuk membatasi origin tertentu.
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

    // Kirim prompt ke Gemini dan tunggu respons
    const result = await model.generateContent(prompt);
    const response = await result.response; // Ambil objek respons dari hasil
    const text = response.text(); // Ekstrak teks dari objek respons

    // Kirim respons JSON ke klien
    res.json({ output: text });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error saat menghasilkan teks:`, error);
    res.status(500).json({
      error: 'Gagal menghasilkan teks dari Gemini.',
      details: error.message, // Detail error untuk debugging
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
    const allowedImageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedImageMimeTypes.includes(mimeType)) {
      // Hapus file yang tidak valid dan kirim error
      fs.unlink(imagePath, (err) => { // Menggunakan fs.unlink asinkron
        if (err) console.error(`[${new Date().toISOString()}] Gagal menghapus file tidak valid:`, err);
      });
      return res.status(400).json({ error: `Tipe file ${mimeType} tidak didukung. Hanya JPEG, PNG, GIF, WebP yang diizinkan untuk gambar.` });
    }

    // Mengambil prompt dari body atau menggunakan default jika tidak ada
    const prompt = req.body.prompt || 'Describe the image in detail.';

    console.log(`[${new Date().toISOString()}] Menerima file gambar: ${req.file.originalname} (${mimeType}) dengan prompt: "${prompt}"`);

    // Konversi gambar yang diupload ke format yang dapat diterima Gemini
    const imagePart = fileToGenerativePart(imagePath, mimeType);

    // Buat array konten untuk dikirim ke Gemini (prompt teks dan gambar)
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
  }
});

/**
 * @route POST /generate-from-document
 * @description Menghasilkan analisis/ringkasan teks dari Gemini berdasarkan dokumen yang diunggah.
 * @body {file} document - File dokumen (PDF, TXT, DOCX, XLSX, PPTX) dengan nama field 'document'.
 * @body {string} [prompt] - Opsional: Prompt teks kustom.
 */
app.post('/generate-from-document', upload.single('document'), async (req, res) => {
  try {
    // --- Validasi file upload ---
    if (!req.file) {
      return res.status(400).json({ error: 'File dokumen diperlukan.' });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    // --- Validasi MIME type dokumen ---
    const allowedDocMimeTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',     // .xlsx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' // .pptx
    ];
    if (!allowedDocMimeTypes.includes(mimeType)) {
      // Hapus file yang tidak valid dan kirim error
      fs.unlink(filePath, (err) => {
        if (err) console.error(`[${new Date().toISOString()}] Gagal menghapus file tidak valid:`, err);
      });
      return res.status(400).json({ error: `Tipe file ${mimeType} tidak didukung. Dokumen yang diizinkan: PDF, TXT, DOCX, XLSX, PPTX.` });
    }

    // Mengambil prompt dari body atau menggunakan default
    const prompt = req.body.prompt || 'Analyze this document and summarize its key points:';

    console.log(`[${new Date().toISOString()}] Menerima file dokumen: ${req.file.originalname} (${mimeType}) dengan prompt: "${prompt}"`);

    // Baca file secara asinkron dan konversi ke Base64
    const fileBuffer = await fs.promises.readFile(filePath); // Menggunakan Promise-based fs.readFile
    const base64Data = fileBuffer.toString('base64');

    const documentPart = {
      inlineData: { data: base64Data, mimeType }
    };

    // Buat array konten untuk Gemini
    const parts = [
        { text: prompt },
        documentPart
    ];

    const result = await model.generateContent({ contents: [{ parts }] });
    const response = await result.response;
    const text = response.text();

    res.json({ output: text });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error saat memproses dokumen:`, error);
    res.status(500).json({
      error: 'Gagal memproses dokumen dengan Gemini.',
      details: error.message,
      tip: 'Pastikan file yang diunggah adalah dokumen yang valid dan API Key Gemini Anda berfungsi. Periksa juga log server.'
    });
  }
});

/**
 * @route POST /generate-from-audio
 * @description Menerima file audio dan mengembalikan transkripsi atau analisis dari Gemini 1.5 Flash.
 * @body {file} audio - File audio (MP3, WAV, dll.) dengan nama field 'audio'.
 * @body {string} [prompt] - Opsional: Prompt teks kustom.
 */
app.post('/generate-from-audio', upload.single('audio'), async (req, res) => {
  try {
    // --- Validasi file upload ---
    if (!req.file) {
      return res.status(400).json({ error: 'File audio diperlukan.' });
    }

    const audioPath = req.file.path;
    const mimeType = req.file.mimetype;

    // --- Validasi MIME type audio ---
    // Pastikan ini sesuai dengan format yang didukung Gemini dan kebutuhan Anda.
    // Gemini 1.5 Flash mendukung MP3 dan WAV untuk inline data.
    const allowedAudioMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-m4a'];
    if (!allowedAudioMimeTypes.includes(mimeType)) {
      fs.unlink(audioPath, (err) => { // Hapus file yang tidak valid
        if (err) console.error(`[${new Date().toISOString()}] Gagal menghapus file tidak valid:`, err);
      });
      return res.status(400).json({ error: `Tipe file ${mimeType} tidak didukung. Hanya MP3, WAV, M4A yang diizinkan untuk audio.` });
    }

    // Mengambil prompt dari body atau menggunakan default
    const prompt = req.body.prompt || 'Transcribe the following audio:';

    console.log(`[${new Date().toISOString()}] Menerima file audio: ${req.file.originalname} (${mimeType}) dengan prompt: "${prompt}"`);

    // Baca file secara asinkron dan konversi ke Base64
    const audioBuffer = await fs.promises.readFile(audioPath);
    const base64Audio = audioBuffer.toString('base64');

    const audioPart = {
      inlineData: {
        data: base64Audio,
        mimeType: mimeType
      }
    };

    const parts = [
      { text: prompt },
      audioPart
    ];

    const result = await model.generateContent({ contents: [{ parts }] });
    const response = await result.response;
    const text = response.text();

    res.json({ output: text });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error saat memproses audio:`, error);
    res.status(500).json({
      error: 'Gagal memproses audio dengan Gemini.',
      details: error.message,
      tip: 'Pastikan file audio berukuran/durasi sesuai batasan Gemini (maks 2 menit untuk Flash) dan API Key Anda valid. Periksa juga log server.'
    });
  } 
});

// --- 8. Menjalankan Server ---
app.listen(PORT, () => {
  console.log(`Server Gemini Flash API berjalan di http://localhost:${PORT}`);
  console.log(`Pastikan GEMINI_API_KEY Anda sudah disetel di file .env`);
});