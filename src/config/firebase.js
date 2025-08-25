const admin = require("firebase-admin");
const serviceAccount = require("../synthora-24ba8-firebase-adminsdk-fbsvc-090a7a5418.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "synthora-24ba8.firebasestorage.app",
});

const bucket = admin.storage().bucket();

module.exports = { admin, bucket };
