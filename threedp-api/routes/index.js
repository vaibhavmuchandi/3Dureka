const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index')
})

router.use('/printer', require('./printer'))
router.use('/user', require('./user'))

module.exports = router
