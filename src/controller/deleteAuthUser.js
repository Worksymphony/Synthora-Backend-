const { admin } = require("../config/firebase");

exports.deleteauthuser = async (req, res) => {
  try {
    const { id } = req.body; // destructure from object
    

    await admin.auth().deleteUser(id);

          
    res.status(200).json({ success: true, message: "User deleted from Auth" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};