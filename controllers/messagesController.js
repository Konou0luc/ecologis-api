const Message = require('../models/Message');
const User = require('../models/User');
const { uploadToCloudinary } = require('../middlewares/upload');

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
      path: req.file.path
    });

    // Upload vers Cloudinary
    const cloudinaryResult = await uploadToCloudinary(req.file.path);

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


