const admin = require("firebase-admin");
const serviceAccount = require("../config/ecologis-833c5-firebase-adminsdk-fbsvc-73e15ab86a.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
