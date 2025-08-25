const express=require("express")
const router=express.Router()
const uploadjdcontroller=require("../controller/uploadjscontroller")
router.post("/",uploadjdcontroller.getjobdesc)
module.exports = router;