const express=require("express")

router=express.Router()
const matchingcontroller=require("../controller/matchingcontroller")
router.post("/",matchingcontroller.matchingcontroller)
router.post("/recent",matchingcontroller.matchingcontrollerRecent)
module.exports = router;