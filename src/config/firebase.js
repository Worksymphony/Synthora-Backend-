const admin = require("firebase-admin");
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "synthora-24ba8.firebasestorage.app",
});

const bucket = admin.storage().bucket();

module.exports = { admin, bucket };
