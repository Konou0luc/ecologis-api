const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      trim: true,
    },
    prenom: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    telephone: {
      type: String,
      required: true,
      trim: true,
    },
    motDePasse: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["proprietaire", "resident", "admin"],
      required: true,
    },
    idProprietaire: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    abonnementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Abonnement",
      default: null,
    },
    maisonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Maison",
      default: null,
    },
    firstLogin: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    deviceToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Hash du mot de passe avant sauvegarde
userSchema.pre("save", async function (next) {
  if (!this.isModified("motDePasse")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.motDePasse = await bcrypt.hash(this.motDePasse, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.motDePasse);
};

// Méthode pour obtenir le nom complet
userSchema.virtual("nomComplet").get(function () {
  return `${this.prenom} ${this.nom}`;
});

// Configuration pour inclure les virtuals dans les réponses JSON
userSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.motDePasse;
    delete ret.refreshToken;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
