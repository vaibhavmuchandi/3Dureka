const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const router = express.Router();
const Printer = require('../models/printer');
const User = require('../models/user');
const fabrichelper = require('../FabricHelper');

router.get('/login', (req, res) => {
    res.render('printer-login')
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


router.get('/dashboard',function(req,res){
  User.findOne({username: req.user.username}, (err, user) => {
    res.render('pendingorders', {orders: user.orders})
  })
});

router.get('/dashboard/print-history',function(req,res){
  res.render('printhistory');
});

router.get('/dashboard/order-details',function(req,res){
  res.render('itemsprocured');
});


router.get('/print/options', (req, res) => {
  res.render('itemsprocured', {orderid: ""})
})

router.post('/print/options', (req, res) => {
  let orderid = req.body.orderid
  res.render('itemsprocured', {orderid: orderid})
})

router.get('/print/addprocurement', (req, res) => {
  res.render('itemsprocured', {message: ""})
})

router.post('/print/addprocurement', (req, res) => {
  let orderId = req.body.orderid
  let Items = req.body.materials+", "+req.body.quantity+" "
  let doc = {
    'orderID' : orderId,
    'items' : Items
  }
  fabrichelper.addProcurement(res, req, doc)
})

router.get('/print/addtracking', (req, res,) => {
  res.render('itemsprocured', {message: ''})
})

router.post('/print/addtracking', (req, res) => {
  let orderid = req.body.orderid
  let Status = "Shipped with trackin details"+req.body.tracking
  let doc = {
    'orderID' : orderid,
    'status' : Status
  }
  fabrichelper.changeStatus(req, res, doc)
})

router.get('/print/startprinting', (req, res) => {
  res.render('itemsprocured', {message: ''})
})

router.post('/print/startprinting', (req, res) => {
  let doc = {
    'orderID' : req.body.orderid,
    'status' : 'Printing Started!'
  }
  fabrichelper.changeStatus(req, res, doc)
})

router.get('/print/endprinting', (req, res) => {
  res.render('itemsprocured', {message: ''})
})

router.post('/print/endprinting', (req, res) => {
  let doc = {
    'orderID' : req.body.orderid,
    'status' : 'Printing Stopped!'
  }
  fabrichelper.changeStatus(req, res, doc)
})


function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/printer/login');
}


module.exports = router;
