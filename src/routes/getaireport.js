const express=require("express")
const router=express.Router()
const aireportcontroller=require("../controller/aireportcontroller")
router.get("/",aireportcontroller.generateAiReport)
module.exports = router;