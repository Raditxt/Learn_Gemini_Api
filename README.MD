# Gemini Flash API Server

This repository provides a simple REST API server for interacting with Google Gemini 1.5 Flash, supporting text, image, document, and audio inputs. It is built with Node.js, Express, and Multer for file uploads.

## Features

- Generate text responses from prompts
- Analyze and describe uploaded images
- Summarize or analyze uploaded documents (PDF, TXT, DOCX, XLSX, PPTX)
- Transcribe or analyze uploaded audio files (MP3, WAV, M4A)
- All endpoints return JSON responses

## Requirements

- Node.js (v16+ recommended)
- A valid Google Gemini API Key (set in `.env` as `GEMINI_API_KEY`)

## Installation

1. Clone this repository.
2. Run `npm install` to install dependencies.
3. Create a `.env` file with your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
4. Start the server:
   ```
   node index.js
   ```

## API Endpoints

### `POST /generate-text`

Generate a text response from a prompt.

- **Body:** `{ "prompt": "Your prompt here" }`
- **Response:** `{ "output": "Gemini's response" }`

### `POST /generate-from-image`

Generate a description or analysis from an uploaded image.

- **Form Data:** 
  - `image` (file, required): JPEG, PNG, GIF, WebP
  - `prompt` (string, optional): Custom prompt
- **Response:** `{ "output": "Gemini's response" }`

### `POST /generate-from-document`

Summarize or analyze an uploaded document.

- **Form Data:** 
  - `document` (file, required): PDF, TXT, DOCX, XLSX, PPTX
  - `prompt` (string, optional): Custom prompt
- **Response:** `{ "output": "Gemini's response" }`

### `POST /generate-from-audio`

Transcribe or analyze an uploaded audio file.

- **Form Data:** 
  - `audio` (file, required): MP3, WAV, M4A
  - `prompt` (string, optional): Custom prompt
- **Response:** `{ "output": "Gemini's response" }`

## File Uploads

Uploaded files are stored in the `uploads/` directory and served statically for debugging at `/uploads/filename`.

## Error Handling

All endpoints return appropriate error messages and HTTP status codes for invalid input, unsupported file types, or server errors.

## Documentation

For detailed API usage, request/response examples, and advanced options, please contact me.

---

**License:** MIT

---
