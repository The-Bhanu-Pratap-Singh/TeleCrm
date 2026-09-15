import mongoose from 'mongoose';

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { 
    type: String, 
    required: true,
    enum: ['Admin', 'Telecaller', 'Technician', 'Social Media Manager']
  }
}, { timestamps: true });

// Note Sub-document
const noteSchema = new mongoose.Schema({
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  author: { type: String, required: true }
});

// Lead Schema
const leadSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  contact: { type: String, required: true },
  address: { type: String },
  assignedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requiredProduct: { type: String },
  quantity: { type: String },
  price: { type: String },
  notes: [noteSchema],
  nextFollowUp: { type: Date },
  visitSchedule: { type: Date },
  installationSchedule: { type: Date },
  actualInstallDate: { type: Date },
  status: { 
    type: String, 
    default: 'New',
    enum: ['New', 'Follow-up', 'Visiting', 'Scheduled', 'Installed', 'Closed'] 
  }
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const Lead = mongoose.model('Lead', leadSchema);
