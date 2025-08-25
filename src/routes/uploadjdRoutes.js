const express=require("express")
const router=express.Router()
const multer = require("multer");
const uploadjdcontroller=require("../controller/uploadjscontroller")

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/",uploadjdcontroller.uploadjobdesc)
router.post("/file",upload.single("file"),uploadjdcontroller.uploadJDFromFile)
router.put("/:id", uploadjdcontroller.updateJobById);
router.delete("/:id",uploadjdcontroller.deletejd)
module.exports = router;