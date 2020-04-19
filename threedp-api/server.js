const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const methodOverride = require('method-override');
const User = require('./models/user');
const Printer = require('./models/printer');
const Grid = require('gridfs-stream');
const uri = 'mongodb+srv://test:test@cluster0-2czvc.mongodb.net/3d?retryWrites=true&w=majority';
mongoose.connect(uri, {useUnifiedTopology: true, useNewUrlParser: true});
let db = mongoose.connection;
let app = express();

app.set('view engine', 'ejs')
app.use(express.static(__dirname + '/assets'))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(methodOverride('_method'));

let gfs;
db.once('open', () => {
  gfs = Grid(db, mongoose.mongo);
  gfs.collection('uploads')
});

app.use(require('express-session')({
  secret: 'I love 3D',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
//Authentication
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
passport.use(new LocalStrategy(User.authenticate()));

app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
})

const routes = require('./routes/index')


app.use('/', routes);
app.use(function(req, res, next){
  res.locals.user = req.user;
  next();
});

app.get('/user/dashboard', isLoggedIn, (req, res) => {
  User.findOne({username: req.user.username}, '-_id uploads designid',
  (err, user) => {
    if(user.uploads.length==0)
      res.render('user-dashboard', {uploads: [], designid: []})
    else
      gfs.files.find({_id: {$in: user.uploads}}, 'filename uploadDate').sort({uploadDate: -1})
      .toArray((err, files)=>{
              res.render('user-dashboard', {uploads: files, designid: user.designid});
      });
    })
});


app.get('/printer/download-file', (req, res) => {
//to check if fie exist
  gfs.files.find({_id: mongoose.Types.ObjectId("5e9c26bcc7888f389093cc5f")}).toArray(function(err, files){
      if(!files || files.length === 0){
          return res.status(404).json({
              responseCode: 1,
              responseMessage: "error"
          });
      }
      // create read stream
      var readstream = gfs.createReadStream({
          filename: files[0].filename,
          root: "uploads"
      });
      // set the proper content type
      res.set('Content-Type', files[0].contentType)
      // Return response
      return readstream.pipe(res);
  });
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/user/login');
}


app.listen(3000, () => {
  console.log('Listening on port 3000');
})
