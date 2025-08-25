const express = require("express");
const router = express.Router();

const resumecontroller = require("../controller/resumecontroller");



router.get("/",(req, res, next) => {
 
  next();}, resumecontroller.getAllMetadata);
router.get("/count",(req, res, next) => {
  
  next();},resumecontroller.getCandidateCount)  
router.get("/hired",(req, res, next) => {
  
  next();},resumecontroller.getHiredCount)
module.exports = router;