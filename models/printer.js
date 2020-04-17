const mongoose = require('mongoose');

let printerSchema = new mongoose.Schema({
  name: String,
  owner: String,
  location: String,
  coordinates: [Number]
})

module.exports = mongoose.model('Printer', printerSchema);
