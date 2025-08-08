const fs = require('fs');
const xlsx = require('xlsx');
const mongoose = require('mongoose');

// Define the schema directly in the script to make it self-contained
const DelegateSchema = new mongoose.Schema({
    teamId: { type: String, required: true, index: true },
    teamName: { type: String, index: true }, // Added Team Name
    delegateId: { type: String, required: true, unique: true, index: true },
    status: String,
    name: { type: String, required: true, index: true },
    cnic: { type: String, required: true, unique: true, index: true },
    phone: String,
    email: { type: String, required: true, unique: true, index: true },
    institution: String,
    accommodation: String,
    arrival: String,
    departure: String,
    allottedStream: String,
    allottedWorkshops: String,
    securityFeePaid: { type: Boolean, default: false },
    accommCheckIn: { type: Boolean, default: false },
    waiverCollected: { type: Boolean, default: false },
    tagsCollected: { type: Boolean, default: false },
    securityCheckIn: { type: Boolean, default: false },
    sessionAttendance: { type: Boolean, default: false },
    workshopAttendance1: { type: Boolean, default: false },
    workshopAttendance2: { type: Boolean, default: false },
});

// Use a new model name to avoid conflicts if server.js is running
const Delegate = mongoose.models.Delegate || mongoose.model('Delegate', DelegateSchema);


const MONGO_URI = 'mongodb+srv://ahm3dkarim:AmAyAm7.7.7@regi.rspsxij.mongodb.net/?retryWrites=true&w=majority&appName=Regi';
const EXCEL_FILE = 'delegates.xlsx'; // <-- your file name here
let results = [];

// Step 1: Read Excel and parse data
function readExcel() {
  const workbook = xlsx.readFile(EXCEL_FILE);
  const sheetName = workbook.SheetNames[0]; // read the first sheet
  const sheet = workbook.Sheets[sheetName];

  // Convert sheet to JSON
  const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  // Normalize and sanitize
  results = rawData.map(data => ({
    teamId: data['Team ID']?.toString().trim(),
    teamName: data['Team Name']?.toString().trim(), // Added Team Name
    delegateId: data['Delegate ID']?.toString().trim(),
    status: data['Participant Type']?.toString().trim(),
    name: data['Full Name']?.toString().trim(),
    cnic: data['CNIC/Passport #']?.toString().trim(),
    phone: data['Contact Number']?.toString().trim(),
    email: data['Email']?.toString().trim(),
    institution: data['Institution']?.toString().trim(),
    accommodation: data['Accommodation']?.toString().trim(), 
    arrival: data['Date of Arrival']?.toString().trim(),
    departure: data['Date of Departure']?.toString().trim(),
    allottedStream: data['Allotted Stream']?.toString().trim(),
    allottedWorkshops: data['Allotted Workshops']?.toString().trim(),
  }));

  console.log(`Excel file read successfully. Total rows: ${results.length}`);
}

// Step 2: Main async function
async function importData() {
  try {
    readExcel();
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected for import...');
    
    try {
        await Delegate.collection.dropIndex('email_1');
        console.log('✅ Unique index on email dropped.');
    } catch (error) {
        if (error.codeName === 'IndexNotFound') {
            console.log('ℹ️ No unique index on email found to drop.');
        } else { throw error; }
    }
    try {
        await Delegate.collection.dropIndex('cnic_1');
        console.log('✅ Unique index on cnic dropped.');
    } catch (error) {
        if (error.codeName === 'IndexNotFound') {
            console.log('ℹ️ No unique index on cnic found to drop.');
        } else { throw error; }
    }

    console.log('Clearing existing delegate data...');
    await Delegate.deleteMany({});

    console.log('Inserting new delegate data...');
    await Delegate.insertMany(results, { ordered: false });

    console.log('✅ Data successfully imported to MongoDB!');
  } catch (error) {
    console.error('❌ Error during data import:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

// Run the script
importData();
