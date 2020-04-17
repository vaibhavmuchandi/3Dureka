const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer')
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override'); 

const app = express();

//middleware
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
 
//mongodb URI
const url = 'mongodb://127.0.0.1:27017/3duploads';

//mongo connections 
const conn = mongoose.createConnection(url);

//init gfs
let gfs;

conn.once('open',  () => {

     gfs = Grid(conn.db, mongoose.mongo);
     gfs.collection('uploads')
  });

  //create storage engine
  const storage = new GridFsStorage({
    url: url,
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

  //@route GET/
  //@desc Loads form 

app.get('/', (req,res) => {
 res.render('app');
});

//@route POST /upload
//@desc uploads file to DB 
app.post('/upload', upload.single('file'), (req, res) => {
    //res.json({file: req.file});
    res.redirect('/');
})


//not neccesary can be excluded
//@route GET/files
//@desc display all file in JSONs
app.get('/files', (req, res) => {
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

// //@route GET/files/:filename
// //@desc display all file in JSON
// app.get('/files/:filename', (req, res) => {
//     gfs.files.findOne({filename: req.params.filename}, (err, file) => {
//         if(!file || file.length === 0) {
//             return res.status(404).json({
//                 err: 'No file exist'
//             });
//        }

//        return res.json(file);
//     });
// }); 


const port = 5000;

app.listen(port, () => console.log('server running on port'+ port));