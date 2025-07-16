// index.js

// 1. Muat variabel lingkungan dari file .env
require('dotenv').config();

// 2. Import semua modul yang diperlukan
const express = require('express');
const cors = require('cors'); // Untuk Cross-Origin Resource Sharing
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 3. Inisialisasi aplikasi Express
const app = express();
const PORT = process.env.PORT || 3000; // Gunakan port dari .env atau default ke 3000

// 4. Konfigurasi Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// 5. Middleware
app.use(cors()); // Mengizinkan semua origin.
app.use(express.json()); // Middleware untuk parsing JSON request body

// --- 6. Definisi Endpoint API ---

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

    console.log(`Menerima prompt teks: "${prompt}"`);

    // Kirim prompt ke Gemini dan tunggu respons
    const result = await model.generateContent(prompt);
    const response = await result.response; // Ambil objek respons dari hasil
    const text = response.text(); // Ekstrak teks dari objek respons

    // Kirim respons JSON ke klien
    res.json({ output: text });

  } catch (error) {
    // Tangani error yang mungkin terjadi
    console.error('Error saat menghasilkan teks:', error);
    res.status(500).json({
      error: 'Gagal menghasilkan teks dari Gemini.',
      details: error.message, // Detail error untuk debugging
      tip: 'Pastikan API Key Gemini Anda valid dan service Gemini sedang tidak mengalami gangguan.'
    });
  }
});

// --- 7. Menjalankan Server ---
app.listen(PORT, () => {
  console.log(`Server Gemini Flash API berjalan di http://localhost:${PORT}`);
  console.log(`Pastikan GEMINI_API_KEY Anda sudah disetel di file .env`);
});