const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const path = require('path');
const crypto = require('crypto');
const multer = require('multer')
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const router = express.Router();
const User = require('../models/user');
//const fabrichelper = require('../FabricHelper')

//Create storage engine
const storage = new GridFsStorage({
  url: 'mongodb+srv://test:test@cluster0-2czvc.mongodb.net/3d?retryWrites=true&w=majority',
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = `${req.body.filename} (${file.originalname})` ;
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});
const upload = multer({ storage });


router.get('/login', (req, res) => {
    res.render('user-login')
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/user/login');
    }
    req.logIn(user, function(err) {
      if (err) {
        return next(err);
      }
      res.redirect(req.session.returnTo || '/user/dashboard');
      delete req.session.returnTo;
    });
  })(req, res, next);
});

router.get('/sign-up', (req, res) => {
  res.render('user-signup')
})

router.post('/sign-up', (req, res) => {
  User.register(new User({ username: req.body.username, email: req.body.email, name: req.body.name, contact: req.body.contact, flag: req.body.type }), req.body.password, function(err, user) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate('local')(req, res, function() {
                res.redirect('/user/login');
            })
        }
   });
})

router.post('/upload', upload.single('file'), (req, res) => {
  let Designid = makeid(16)
  User.collection.findOneAndUpdate(
    {username: req.user.username},
    {$push: {uploads: res.req.file.id, designid: Designid}}
  )
  let Dbid = res.req.file.id
  let Ownerid = req.user._id
  let Ownername = req.user.name
  let Owneremail = req.user.email
  let doc = {
    'designID' : Designid,
    'dbID' : Dbid.toString(),
    'ownerID' : Ownerid.toString(),
    'ownerName' : Ownername,
    'ownerEmail' : Owneremail
  }
  //fabrichelper.registerDesign(req, res, doc)
  res.redirect('/user/dashboard')
});

router.get('/dashboard/order-details', isLoggedIn, (req, res) => {
  res.render('orderdetails', {details: {}})
});

router.post('/place-order/add-details', (req, res) => {
  designId = req.body.designid;
  userId = req.user._id
  details = {
    'designid' : designId,
    'userid' : userId
  }
  res.render('orderdetails', {details: details})
})

router.post('/place-order/success', (req, res)=> {
  let orderid = makeid(4)
  let designId = req.body.designid;
  let userId = req.body.userid;
  let address1 = req.body.address1;
  let coordinates = req.body.coordinates.split(',');
  let address2 = req.body.address2;
  let quantity = req.body.quantity;
  let doc = {
    'orderID' : orderid,
    'designID' : designId,
    'userID' : userId,
    'quantity' : quantity
  }
  User.find({flag: 'printer'}, 'coordinates location', (err, printers) => {
    console.log(printers);
    let distance = []
    for(let i in printers) {
      distance.push(calcDist(coordinates, printers[i].coordinates))
    }
    min = Math.min(...distance);
    res.send(printers[distance.indexOf(min)])
  })
});

function toRadians(deg) {
  return (deg * (Math.PI / 180))
}

function calcDist(cood1, cood2) {
  let lat1 = toRadians(cood1[1]);
  let lat2 = toRadians(cood2[1]);
  let lon1 = toRadians(cood1[0]);
  let lon2 = toRadians(cood2[0]);

  let dlon = lon2 - lon1;
  let dlat = lat2 - lat1;
  let a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;

  let c = 2 * Math.asin(Math.sqrt(a))
  return (c * 6371)
}


function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/user/luser-login');
}

function makeid(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
     result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}


module.exports =  router ;
