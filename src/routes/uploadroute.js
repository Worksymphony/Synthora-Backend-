const express = require("express");
const router = express.Router();
const multer = require("multer");
const uploadController = require("../controller/uploadcontroller");

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", upload.array("files"), uploadController.uploadToFirebase);
router.patch("/hiringstatus/:id",uploadController.updatehiringstatus)

module.exports = router;
