const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const readline = require('readline');

// --- IMPORTANT: Paste your MongoDB connection string here ---
const MONGO_URI = 'mongodb+srv://ahm3dkarim:AmAyAm7.7.7@regi.rspsxij.mongodb.net/?retryWrites=true&w=majority&appName=Regi';

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
// Use a new model name to avoid conflicts
const UserImport = mongoose.models.User || mongoose.model('User', UserSchema);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const createAdmin = async () => {
  rl.question('Enter admin username: ', (username) => {
    rl.question('Enter admin password: ', async (password) => {
      try {
        await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('MongoDB connected for admin creation...');

        const hashedPassword = await bcrypt.hash(password, 10);
        const admin = new UserImport({ username, password: hashedPassword });
        await admin.save();
        
        console.log(`Admin user '${username}' created successfully!`);
      } catch (error) {
        console.error('Error creating admin user:', error.message);
      } finally {
        await mongoose.disconnect();
        rl.close();
      }
    });
  });
};

createAdmin();