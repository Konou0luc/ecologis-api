const Message = require('../models/Message');
const User = require('../models/User');
const Maison = require('../models/Maison');

const socketManager = (io) => {
  // Stocker les connexions utilisateurs
  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    console.log(`Nouvelle connexion: ${socket.id}`);

    // Authentification du socket
    socket.on('authenticate', async (data) => {
      try {
        const { token } = data;
        
        // Vérifier le token (simplifié pour l'exemple)
        // En production, utiliser jwt.verify
        if (!token) {
          socket.emit('auth_error', { message: 'Token manquant' });
          return;
        }

        // Simuler la vérification du token
        // En production, décoder le JWT et récupérer l'utilisateur
        const userId = token; // Simplifié pour l'exemple
        
        // Récupérer l'utilisateur
        const user = await User.findById(userId);
        if (!user) {
          socket.emit('auth_error', { message: 'Utilisateur non trouvé' });
          return;
        }

        // Stocker les informations de l'utilisateur
        socket.userId = user._id;
        socket.userRole = user.role;
        socket.userNom = user.nomComplet;

        // Ajouter à la liste des utilisateurs connectés
        connectedUsers.set(user._id.toString(), {
          socketId: socket.id,
          user: user
        });

        // Rejoindre la room personnelle
        socket.join(`user:${user._id}`);

        // Si c'est un résident, rejoindre les rooms des maisons
        if (user.role === 'resident') {
          const maisons = await Maison.find({ listeResidents: user._id });
          maisons.forEach(maison => {
            socket.join(`maison:${maison._id}`);
          });
        } else if (user.role === 'proprietaire') {
          // Si c'est un propriétaire, rejoindre les rooms de ses maisons
          const maisons = await Maison.find({ proprietaireId: user._id });
          maisons.forEach(maison => {
            socket.join(`maison:${maison._id}`);
          });
        }

        socket.emit('authenticated', {
          message: 'Authentification réussie',
          user: {
            id: user._id,
            nom: user.nomComplet,
            role: user.role
          }
        });

        console.log(`Utilisateur authentifié: ${user.nomComplet} (${user.role})`);
      } catch (error) {
        console.error('Erreur d\'authentification socket:', error);
        socket.emit('auth_error', { message: 'Erreur d\'authentification' });
      }
    });

    // Envoyer un message privé
    socket.on('send_private_message', async (data) => {
      try {
        const { receiverId, contenu, maisonId } = data;

        if (!socket.userId) {
          socket.emit('error', { message: 'Non authentifié' });
          return;
        }

        // Créer le message
        const message = new Message({
          senderId: socket.userId,
          receiverId,
          maisonId,
          contenu,
          type: 'text'
        });

        await message.save();

        // Émettre vers le destinataire
        const receiverSocket = connectedUsers.get(receiverId);
        if (receiverSocket) {
          io.to(receiverSocket.socketId).emit('new_private_message', {
            message: {
              ...message.toObject(),
              sender: {
                id: socket.userId,
                nom: socket.userNom
              }
            }
          });
        }

        // Confirmation à l'expéditeur
        socket.emit('message_sent', {
          message: 'Message envoyé',
          messageId: message._id
        });

      } catch (error) {
        console.error('Erreur lors de l\'envoi du message privé:', error);
        socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
      }
    });

    // Envoyer un message de groupe (maison)
    socket.on('send_group_message', async (data) => {
      try {
        const { maisonId, contenu, type = 'text' } = data;

        if (!socket.userId) {
          socket.emit('error', { message: 'Non authentifié' });
          return;
        }

        // Vérifier que l'utilisateur appartient à la maison
        const maison = await Maison.findById(maisonId);
        if (!maison) {
          socket.emit('error', { message: 'Maison non trouvée' });
          return;
        }

        const isInHouse = socket.userRole === 'proprietaire' 
          ? maison.proprietaireId.equals(socket.userId)
          : maison.listeResidents.includes(socket.userId);

        if (!isInHouse) {
          socket.emit('error', { message: 'Accès non autorisé à cette maison' });
          return;
        }

        // Créer le message
        const message = new Message({
          senderId: socket.userId,
          maisonId,
          contenu,
          type
        });

        await message.save();

        // Émettre vers tous les membres de la maison
        io.to(`maison:${maisonId}`).emit('new_group_message', {
          message: {
            ...message.toObject(),
            sender: {
              id: socket.userId,
              nom: socket.userNom
            }
          }
        });

        // Confirmation à l'expéditeur
        socket.emit('message_sent', {
          message: 'Message envoyé',
          messageId: message._id
        });

      } catch (error) {
        console.error('Erreur lors de l\'envoi du message de groupe:', error);
        socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
      }
    });

    // Marquer un message comme lu
    socket.on('mark_as_read', async (data) => {
      try {
        const { messageId } = data;

        if (!socket.userId) {
          socket.emit('error', { message: 'Non authentifié' });
          return;
        }

        const message = await Message.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message non trouvé' });
          return;
        }

        // Vérifier que l'utilisateur est le destinataire
        if (!message.receiverId.equals(socket.userId)) {
          socket.emit('error', { message: 'Accès non autorisé' });
          return;
        }

        await message.marquerCommeLu();

        // Notifier l'expéditeur
        const senderSocket = connectedUsers.get(message.senderId.toString());
        if (senderSocket) {
          io.to(senderSocket.socketId).emit('message_read', {
            messageId: message._id,
            readBy: socket.userId,
            readAt: message.dateLecture
          });
        }

        socket.emit('message_marked_read', {
          messageId: message._id
        });

      } catch (error) {
        console.error('Erreur lors du marquage comme lu:', error);
        socket.emit('error', { message: 'Erreur lors du marquage' });
      }
    });

    // Rejoindre une room de maison
    socket.on('join_house', async (data) => {
      try {
        const { maisonId } = data;

        if (!socket.userId) {
          socket.emit('error', { message: 'Non authentifié' });
          return;
        }

        // Vérifier l'accès à la maison
        const maison = await Maison.findById(maisonId);
        if (!maison) {
          socket.emit('error', { message: 'Maison non trouvée' });
          return;
        }

        const isInHouse = socket.userRole === 'proprietaire' 
          ? maison.proprietaireId.equals(socket.userId)
          : maison.listeResidents.includes(socket.userId);

        if (!isInHouse) {
          socket.emit('error', { message: 'Accès non autorisé' });
          return;
        }

        socket.join(`maison:${maisonId}`);
        socket.emit('joined_house', { maisonId });

      } catch (error) {
        console.error('Erreur lors de la jointure de maison:', error);
        socket.emit('error', { message: 'Erreur lors de la jointure' });
      }
    });

    // Quitter une room de maison
    socket.on('leave_house', (data) => {
      const { maisonId } = data;
      socket.leave(`maison:${maisonId}`);
      socket.emit('left_house', { maisonId });
    });

    // Typing indicators
    socket.on('typing_start', (data) => {
      const { receiverId, maisonId } = data;
      
      if (receiverId) {
        // Message privé
        const receiverSocket = connectedUsers.get(receiverId);
        if (receiverSocket) {
          io.to(receiverSocket.socketId).emit('user_typing', {
            userId: socket.userId,
            userName: socket.userNom
          });
        }
      } else if (maisonId) {
        // Message de groupe
        socket.to(`maison:${maisonId}`).emit('user_typing', {
          userId: socket.userId,
          userName: socket.userNom
        });
      }
    });

    socket.on('typing_stop', (data) => {
      const { receiverId, maisonId } = data;
      
      if (receiverId) {
        const receiverSocket = connectedUsers.get(receiverId);
        if (receiverSocket) {
          io.to(receiverSocket.socketId).emit('user_stopped_typing', {
            userId: socket.userId
          });
        }
      } else if (maisonId) {
        socket.to(`maison:${maisonId}`).emit('user_stopped_typing', {
          userId: socket.userId
        });
      }
    });

    // Déconnexion
    socket.on('disconnect', () => {
      console.log(`Déconnexion: ${socket.id}`);
      
      if (socket.userId) {
        connectedUsers.delete(socket.userId.toString());
      }
    });
  });

  // Fonction pour envoyer une notification système
  const sendSystemNotification = async (userId, message, type = 'system') => {
    try {
      const userSocket = connectedUsers.get(userId.toString());
      if (userSocket) {
        io.to(userSocket.socketId).emit('system_notification', {
          message,
          type,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi de notification système:', error);
    }
  };

  // Fonction pour envoyer une notification de facture
  const sendFactureNotification = async (userId, factureData) => {
    try {
      const userSocket = connectedUsers.get(userId.toString());
      if (userSocket) {
        io.to(userSocket.socketId).emit('facture_notification', {
          facture: factureData,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi de notification facture:', error);
    }
  };

  return {
    sendSystemNotification,
    sendFactureNotification,
    connectedUsers
  };
};

module.exports = socketManager;
