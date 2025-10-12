const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configuration du stockage local temporaire
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/messages';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configuration multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Vérifier le type de fichier
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'video/mp4',
      'audio/mp3',
      'audio/wav',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'), false);
    }
  }
});

// Middleware pour upload de fichiers
const uploadFile = upload.single('file');

// Middleware pour upload de fichiers avec gestion d'erreur
const uploadFileMiddleware = (req, res, next) => {
  uploadFile(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          message: 'Fichier trop volumineux. Taille maximale: 10MB' 
        });
      }
      return res.status(400).json({ 
        message: 'Erreur lors de l\'upload du fichier',
        error: err.message 
      });
    } else if (err) {
      return res.status(400).json({ 
        message: err.message 
      });
    }
    next();
  });
};

// Fonction pour uploader vers Cloudinary
const uploadToCloudinary = async (filePath, folder = 'ecologis/messages') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'auto',
      quality: 'auto',
      transformation: [
        { width: 1000, height: 1000, crop: 'limit' }
      ]
    });
    
    // Supprimer le fichier local après upload
    fs.unlinkSync(filePath);
    
    return result;
  } catch (error) {
    console.error('Erreur upload Cloudinary:', error);
    // Supprimer le fichier local en cas d'erreur
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
};

module.exports = {
  uploadFileMiddleware,
  uploadToCloudinary,
  cloudinary
};
