const express=require("express");
const deleteuser=require("../controller/deleteAuthUser")
const router=express.Router()
router.post("/",deleteuser.deleteauthuser)
module.exports = router;