const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.get('/api/test', (req, res) => {
  res.json({ message: 'API working! 🚀' });
});
const PORT = 8000;
const JWT_SECRET = 'a-secret-string-that-should-be-in-an-env-file';

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- MongoDB Connection ---
const MONGO_URI = 'mongodb+srv://ahm3dkarim:AmAyAm7.7.7@regi.rspsxij.mongodb.net/?retryWrites=true&w=majority&appName=Regi'; 
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Models ---
const DelegateSchema = new mongoose.Schema({
    teamId: { type: String, required: true, index: true },
    teamName: { type: String, index: true },
    delegateId: { type: String, required: true, unique: true, index: true },
    status: String, name: { type: String, required: true, index: true },
    cnic: { type: String, required: true, unique: true, index: true },
    phone: String, email: { type: String, required: true, unique: true, index: true },
    institution: String, accommodation: String,
    arrival: String, departure: String,
    
    // New Fields for Attendance
    allottedStream: String,
    allottedWorkshops: String, // Comma-separated
    
    // Checkbox Fields
    securityFeePaid: { type: Boolean, default: false },
    accommCheckIn: { type: Boolean, default: false },
    waiverCollected: { type: Boolean, default: false },
    tagsCollected: { type: Boolean, default: false },
    securityCheckIn: { type: Boolean, default: false },
    sessionAttendance: { type: Boolean, default: false },
    workshopAttendance1: { type: Boolean, default: false },
    workshopAttendance2: { type: Boolean, default: false },
});
const Delegate = mongoose.model('Delegate', DelegateSchema);

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const User = mongoose.model('User', UserSchema);


// --- API ROUTES for AUTHENTICATION ---
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});


// --- API ROUTES for DELEGATES ---
// Search for a single delegate
app.get('/api/delegates/search', async (req, res) => {
    const { by, term } = req.query;
    try {
        const delegate = await Delegate.findOne({ [by]: new RegExp(term, 'i') });
        if (!delegate) return res.status(404).json({ message: 'Delegate not found' });
        res.json(delegate);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Search for a team
app.get('/api/teams/search', async (req, res) => {
    const { by, term } = req.query;
    try {
        const delegate = await Delegate.findOne({ [by]: new RegExp(term, 'i') });
        if (!delegate) return res.status(404).json({ message: 'Team not found' });
        
        const teamMembers = await Delegate.find({ teamId: delegate.teamId });
        res.json(teamMembers);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update a delegate's main info (for Admin tab)
app.patch('/api/delegates/:delegateId', async (req, res) => {
    try {
        const updatedDelegate = await Delegate.findOneAndUpdate({ delegateId: req.params.delegateId }, req.body, { new: true });
        if (!updatedDelegate) return res.status(404).json({ message: 'Delegate not found' });
        res.json(updatedDelegate);
    } catch (error) {
        res.status(500).json({ message: 'Update failed' });
    }
});

// Update a single checkbox for a delegate
app.patch('/api/delegates/:delegateId/update_check', async (req, res) => {
    try {
        await Delegate.updateOne({ delegateId: req.params.delegateId }, { $set: req.body });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Update failed' });
    }
});

// Update the security fee for a whole team
app.patch('/api/teams/:teamId/update_fee', async (req, res) => {
    try {
        await Delegate.updateMany({ teamId: req.params.teamId }, { $set: { securityFeePaid: req.body.securityFeePaid } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Update failed' });
    }
});


// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`API Server is running on http://localhost:${PORT}`);
});
