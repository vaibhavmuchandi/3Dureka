const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

let userSchema = new mongoose.Schema({
  username: String,
  name: String,
  owner: String,
  location: String,
  coordinates: [Number],
  email: String,
  contact: String,
  uploads: [{type: mongoose.Schema.Types.ObjectId, ref: 'uploads'}]
})

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', userSchema);
