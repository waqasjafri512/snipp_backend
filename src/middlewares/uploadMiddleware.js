const multer = require('multer');
const path = require('path');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter (images and videos)
const fileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|webp|gif|heic|mp4|mov|avi|mkv|webm/;
  const isImageOrVideo = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
  const extname = allowedExts.test(path.extname(file.originalname).toLowerCase());

  if (isImageOrVideo || extname) {
    return cb(null, true);
  }
  cb(new Error('Only images and videos are allowed'));
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for videos
  fileFilter,
});

module.exports = upload;
