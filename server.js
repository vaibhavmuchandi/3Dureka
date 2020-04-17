const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/user')
const uri = 'mongodb+srv://test:test@cluster0-2czvc.mongodb.net/3d?retryWrites=true&w=majority';
mongoose.connect(uri, {useNewUrlParser: true, useUnifiedTopology: true});
let app = express();

app.set('view engine', 'ejs')
app.use(express.static(__dirname + '/assets'))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

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

const routes = require('./routes/index')

app.use('/', routes);

app.listen(3000, () => {
  console.log('Listening on port 3000');
})
