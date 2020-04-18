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
// passport.serializeUser(Printer.serializeUser());
// passport.deserializeUser(Printer.deserializeUser());
// passport.use('printer', new LocalStrategy(
//   function(username, password, done) {
//    Printer.findOne({ username: username }, function (err, user) {
//      if (err) { return done(err); }
//      if (!user) {
//        return done(null, false, { message: 'Incorrect username.' });
//      }
//      if (!user.validPassword(password)) {
//        return done(null, false, { message: 'Incorrect password.' });
//      }
//      return done(null, user);
//    });
//  }
// ));

app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
})

const routes = require('./routes/index')

app.use('/', routes);

app.get('/user/dashboard', isLoggedIn, (req, res) => {
  User.findOne({username: req.user.username}, '-_id uploads',
  (err, user) => {
    console.log(user);
    if(user.uploads.length==0)
      res.render('user-dashboard', {uploads: []})
    else
      gfs.files.find({_id: {$in: user.uploads}}, 'filename uploadDate').sort({uploadDate: -1})
      .toArray((err, files)=>{
              res.render('user-dashboard', {uploads: files});
      });
    })
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
