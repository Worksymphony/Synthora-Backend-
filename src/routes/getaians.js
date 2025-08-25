const express=require("express");
const aianscontroller = require("../controller/aianscontroller");
const router=express.Router()
router.post("/",aianscontroller.getaians)
module.exports = router;