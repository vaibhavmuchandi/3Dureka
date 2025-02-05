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
      res.redirect('/printer/dashboard');
      delete req.session.returnTo;
    });
  })(req, res, next);
});

router.get('/sign-up', (req, res) => {
  res.render('printer-signup')
})

router.post('/sign-up', (req, res) => {
  User.register(new User({ username: req.body.username, email: req.body.email, name: req.body.name, owner: req.body.owner, contact: req.body.contact, location: req.body.location, coordinates: req.body.coordinates.split(','), printerTypes: req.body.typesOfPrinter.split(','), flag: req.body.type}), req.body.password, function(err, user) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate('local')(req, res, function() {
                res.redirect('/printer/login');
            })
        }
   });
});

router.use(isLoggedIn);
router.use(isPrinter);

router.get('/dashboard', function(req,res){
  User.findOne({username: req.user.username}, (err, user) => {
    res.render('pendingorders', {orders: user.orders})
  })
});

router.get('/dashboard/print-history',function(req,res){
  res.render('printhistory');
});

router.get('/dashboard/order-details',function(req,res){
  res.render('itemsprocured',{message:"", orderid:""});
});


router.get('/print/options', (req, res) => {
  res.render('itemsprocured', {orderid: "",message:""})
})

router.post('/print/options', (req, res) => {
  let orderid = req.body.orderid
  res.render('itemsprocured', {orderid: orderid,message:""})
})

router.get('/print/addprocurement', (req, res) => {
  res.render('itemsprocured', {message: "", orderid:""})
})

router.post('/print/addprocurement', (req, res) => {
  let orderId = req.body.orderid
  let Items = req.body.materials+", "+req.body.quantity+" "
  let doc = {
    'orderID' : orderId.toString(),
    'items' : Items.toString()
  }
  fabrichelper.addProcurement(req, res, doc)
})

router.get('/print/addtracking', (req, res,) => {
  res.render('itemsprocured', {message: '', orderid: ""})
})

router.post('/print/addtracking', (req, res) => {
  let orderid = req.body.orderid
  let Status = "Order has been shipped with tracking details: "+req.body.tracking
  let doc = {
    'orderID' : orderid,
    'status' : Status
  }
  fabrichelper.changeStatus(req, res, doc)
})

router.get('/print/startprinting', (req, res) => {
  res.render('itemsprocured', {message: "", orderid: ""})
})

router.post('/print/startprinting', (req, res) => {
  let doc = {
    'orderID' : req.body.orderid,
    'status' : 'Printing Started!'
  }
  fabrichelper.changeStatus(req, res, doc)
})

router.get('/print/endprinting', (req, res) => {
  res.render('itemsprocured', {message: "", orderid: ""})
})

router.post('/print/endprinting', (req, res) => {
  let doc = {
    'orderID' : req.body.orderid,
    'status' : 'Printing Stopped!'
  }
  fabrichelper.changeStatus(req, res, doc)
})

router.post('/file', async(req, res) => {
  let doc = {
    'orderID':req.body.orderid
  }
  let designid = fabrichelper.getStatusPrinter(req, res, doc)
  setTimeout(()=>{
    console.log(designid)
  }, 10000)
  
})

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/printer/login');
}

function isPrinter(req, res, next) {
  if(req.user.flag == 'printer')
    return next();
  res.redirect('/printer/login');
}


module.exports = router;
