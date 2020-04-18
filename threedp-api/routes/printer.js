const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const router = express.Router();
const Printer = require('../models/printer');
const User = require('../models/user');

router.get('/login', (req, res) => {
    res.render('login')
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/printer/login');
    }
    req.logIn(user, function(err) {
      if (err) {
        return next(err);
      }
      res.redirect(req.session.returnTo || '/printer/dashboard');
      delete req.session.returnTo;
    });
  })(req, res, next);
});

router.get('/sign-up', (req, res) => {
  res.render('printer-signup')
})

router.post('/sign-up', (req, res) => {
  User.register(new User({ username: req.body.username, email: req.body.email, name: req.body.name, owner: req.body.owner, contact: req.body.contact, location: req.body.location, coordinates: req.body.coordinates.split(','), flag: req.body.type}), req.body.password, function(err, user) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate('local')(req, res, function() {
                res.redirect('/printer/login');
            })
        }
   });
});


function checkLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  next();
}

router.get('/dashboard',function(req,res){
  res.render('pendingorders');
});

router.get('/dashboard/print-history',function(req,res){
  res.render('printhistory');
});

router.get('/dashboard/order-details',function(req,res){
  res.render('itemsprocured');
});


function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/printer/login');
}


module.exports = router;
