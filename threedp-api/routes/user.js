const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer')
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const router = express.Router();
const User = require('../models/user');



//Create storage engine
const storage = new GridFsStorage({
  url: 'mongodb+srv://test:test@cluster0-2czvc.mongodb.net/3d?retryWrites=true&w=majority',
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
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

router.get('/upload', (req, res) => {
    res.render('upload')
});

router.post('/upload', upload.single('file'), (req, res) => {
  res.redirect('/');
});


module.exports =  router ;
