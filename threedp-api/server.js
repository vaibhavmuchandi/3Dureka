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
mongoose.connect(uri, {useNewUrlParser: true, useUnifiedTopology: true});
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
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
passport.use(new LocalStrategy(User.authenticate()));
// passport.serializeUser(Printer.serializeUser());
// passport.deserializeUser(Printer.deserializeUser());
// passport.use(new LocalStrategy(Printer.authenticate()));

const routes = require('./routes/index')

app.use('/', routes);

app.get('/user/dashboard', (req, res) => {
    gfs.files.find({}, 'filename uploadDate').sort({uploadDate: 1})
    .toArray((err, files)=>{
        if(!files || files.length === 0) {
            res.render('user-dashboard', {uploads: null})
        } else {
            res.render('user-dashboard', {uploads: files})
        }
    });
})


app.listen(3000, () => {
  console.log('Listening on port 3000');
})
