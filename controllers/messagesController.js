const Message = require('../models/Message');
const User = require('../models/User');

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


