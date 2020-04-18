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
const conn = mongoose.createConnection(uri, {useNewUrlParser: true, useUnifiedTopology: true});
let app = express();

app.set('view engine', 'ejs')
app.use(express.static(__dirname + '/assets'))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(methodOverride('_method'));

let gfs;
conn.once('open', () => {
  gfs = Grid(conn.db, mongoose.mongo);
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
passport.serializeUser(Printer.serializeUser());
passport.deserializeUser(Printer.deserializeUser());
passport.use(new LocalStrategy(Printer.authenticate()));

const routes = require('./routes/index')

app.use('/', routes);

app.get('/user/files', (req, res) => {
    gfs.files.find().toArray((err, files)=>{
        //check if file exist
        if(!files || files.length === 0) {
            return res.status(404).json({
                err: 'No files exist'
            });

        }
        return res.json(files);
    });
})


app.listen(3000, () => {
  console.log('Listening on port 3000');
})
