const Message = require('../models/Message');
const User = require('../models/User');
const { uploadBufferToCloudinary, cloudinary } = require('../middlewares/upload');

// POST /messages/file -> créer un message avec fichier
exports.createFileMessage = async (req, res) => {
  try {
    const { receiverId, contenu, maisonId } = req.body;
    const senderId = req.user._id;

    // Validation des données
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    if (!maisonId) {
      return res.status(400).json({ message: 'L\'ID de la maison est requis' });
    }

    console.log('📁 [API] Upload de fichier:', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      storage: 'memory'
    });

    // Upload vers Cloudinary depuis le buffer (compat. serverless)
    const cloudinaryResult = await uploadBufferToCloudinary(req.file);

    // Déterminer le type de message selon le type de fichier
    let messageType = 'file';
    if (req.file.mimetype.startsWith('image/')) {
      messageType = 'image';
    } else if (req.file.mimetype.startsWith('video/')) {
      messageType = 'video';
    } else if (req.file.mimetype.startsWith('audio/')) {
      messageType = 'audio';
    }

    // Créer le message avec fichier
    const message = new Message({
      senderId,
      receiverId: receiverId || null,
      maisonId,
      contenu: contenu || req.file.originalname,
      type: messageType,
      dateEnvoi: new Date(),
      metadata: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        fileUrl: cloudinaryResult.secure_url,
        thumbnailUrl: cloudinaryResult.format === 'jpg' || cloudinaryResult.format === 'png' 
          ? cloudinaryResult.secure_url 
          : null
      }
    });

    await message.save();

    console.log('✅ [API] Message avec fichier créé:', {
      id: message._id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      maisonId: message.maisonId,
      type: message.type,
      fileName: message.metadata.fileName,
      fileUrl: message.metadata.fileUrl
    });

    res.status(201).json({
      message: 'Message avec fichier envoyé avec succès',
      data: message,
    });
  } catch (error) {
    console.error('💥 [API] createFileMessage error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi du message avec fichier' });
  }
};

// Proxy/stream d'un fichier Cloudinary pour contourner les blocages publics
exports.proxyFile = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'url manquante' });
    }
    if (!url.includes('res.cloudinary.com')) {
      return res.status(400).json({ message: 'URL non autorisée' });
    }

    // Petites sécurités: forcer raw si pdf/doc
    let target = url;
    if (target.includes('/image/upload/') && (target.endsWith('.pdf') || target.includes('application/pdf'))) {
      target = target.replace('/image/upload/', '/raw/upload/');
    }

    const fetch = require('node-fetch');
    let response = await fetch(target);

    // Si échec d'accès direct (401/403/404), tenter URL signée Cloudinary
    if (![200].includes(response.status)) {
      // Essayer d'extraire public_id et format
      // URL forme: https://res.cloudinary.com/<cloud>/[resource]/upload/.../<public_id>.<ext>
      try {
        const u = new URL(url);
        const parts = u.pathname.split('/');
        // public_id est après 'upload/'
        const uploadIndex = parts.findIndex((p) => p === 'upload');
        if (uploadIndex !== -1 && uploadIndex + 1 < parts.length) {
          const publicWithExt = parts.slice(uploadIndex + 1).join('/');
          const last = publicWithExt.split('/').pop();
          const hasDot = last && last.includes('.');
          const ext = hasDot ? last.split('.').pop() : undefined;
          const publicId = hasDot
            ? publicWithExt.substring(0, publicWithExt.lastIndexOf('.'))
            : publicWithExt;

          // Générer une URL signée téléchargeable (expirant)
          // Utiliser raw par défaut pour PDF/doc/audio
          const isPdf = (ext || '').toLowerCase() === 'pdf';
          const resourceType = isPdf ? 'raw' : 'image';
          const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60; // 5 minutes

          // Pour les ressources privées/authentifiées, private_download_url est recommandé
          // On l'emploie quelle que soit la config actuelle si l'accès public échoue
          const signedUrl = cloudinary.utils.private_download_url(
            publicId,
            ext || 'bin',
            {
              resource_type: resourceType,
              attachment: true,
              expires_at: expiresAt,
            }
          );

          if (signedUrl) {
            response = await fetch(signedUrl);
          }
        }
      } catch (e) {
        // On ignore et on retombera sur l'erreur initiale
      }
    }

    if (!response.ok) {
      return res.status(response.status).send(await response.text());
    }

    // Propager content-type et dispo si dispo
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('content-disposition');
    res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    }

    response.body.pipe(res);
  } catch (err) {
    console.error('❌ [FILE PROXY] Erreur:', err);
    res.status(500).json({ message: 'Erreur proxy fichier' });
  }
};

// POST /messages -> créer un message
exports.createMessage = async (req, res) => {
  try {
    const { receiverId, contenu, maisonId } = req.body;
    const senderId = req.user._id;

    // Validation des données
    if (!contenu || contenu.trim().length === 0) {
      return res.status(400).json({ message: 'Le contenu du message est requis' });
    }

    if (!maisonId) {
      return res.status(400).json({ message: 'L\'ID de la maison est requis' });
    }

    // Créer le message
    const message = new Message({
      senderId,
      receiverId: receiverId || null, // null pour les messages de groupe
      maisonId,
      contenu: contenu.trim(),
      type: 'text',
      dateEnvoi: new Date(),
    });

    await message.save();

    console.log('✅ [API] Message créé:', {
      id: message._id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      maisonId: message.maisonId,
      contenu: message.contenu.substring(0, 50) + '...',
    });

    res.status(201).json({
      message: 'Message envoyé avec succès',
      data: message,
    });
  } catch (error) {
    console.error('💥 [API] createMessage error:', error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi du message' });
  }
};

// GET /messages/private/:otherUserId -> historique messages privés (bidirectionnels)
exports.getPrivateHistory = async (req, res) => {
  try {
    const myId = req.user._id;
    const otherUserId = req.params.otherUserId;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: myId },
      ],
    })
      .sort({ dateEnvoi: 1 })
      .lean();

    res.json({ messages });
  } catch (error) {
    console.error('💥 [API] getPrivateHistory error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'historique' });
  }
};

// GET /messages/house/:maisonId -> historique messages de groupe (maison)
exports.getHouseHistory = async (req, res) => {
  try {
    const maisonId = req.params.maisonId;
    const messages = await Message.find({ maisonId, receiverId: null })
      .sort({ dateEnvoi: 1 })
      .lean();
    res.json({ messages });
  } catch (error) {
    console.error('💥 [API] getHouseHistory error:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'historique' });
  }
};


