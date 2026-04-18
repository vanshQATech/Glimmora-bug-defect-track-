const multer = require('multer');
const path = require('path');

// Use memory storage so we can persist file bytes in the DB.
// Render's filesystem is ephemeral, so disk-stored uploads are lost on every restart.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|csv|xlsx/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('application/');
  if (ext || mime) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = upload;
