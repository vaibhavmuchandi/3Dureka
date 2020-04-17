const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/user');


router.get('/log-in', (req, res) => {
  res.render('login');  
});

router.get('/sign-up', (req, res) => {
  res.render('user-signup')
})

router.post('/sign-up', (req, res) => {
  User.register(new User({ username: req.body.username, email: req.body.email, name: req.body.name, contact: req.body.contact }), req.body.password, function(err, user) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate('local')(req, res, function() {
                res.redirect('/');
            })
        }
   });
})

module.exports = router;
