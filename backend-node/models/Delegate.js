// models/Delegate.js
const mongoose = require('mongoose');

const delegateSchema = new mongoose.Schema({
  teamId: String,
  delegateId: String,
  status: String,
  name: String,
  cnic: String,
  phone: String,
  email: {
  type: String,
  required: true
},
  institution: String,
  accommodation: String,
  arrival: String,
  departure: String,
  stream: {
    type: String,
    default: 'General'
  },  
 streamAllotted: String,
workshopsAllotted: String,
teamName: String,




});

module.exports = mongoose.model('Delegate', delegateSchema);
    