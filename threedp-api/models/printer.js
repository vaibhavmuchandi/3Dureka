const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

let printerSchema = new mongoose.Schema({
  username: String,
  name: String,
  owner: String,
  contact: String,
  email: String,
  location: String,
  coordinates: [Number]
})

printerSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('Printer', printerSchema);
