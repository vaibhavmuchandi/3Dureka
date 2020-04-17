const express = require('express');
const passport = require('passport');
const router = express.Router();
const Printer = require('../models/printer');

router.get('/sign-up', (req, res) => {
  res.render('printer-signup')
})

router.post('/sign-up', (req, res) => {
  Printer.register(new Printer({ username: req.body.username, email: req.body.email, name: req.body.name, owner: req.body.owner, contact: req.body.contact, location: req.body.location, coordinates: req.body.coordinates.split(',') }), req.body.password, function(err, user) {
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
