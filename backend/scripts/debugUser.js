import dotenv from 'dotenv';
import connectDB from '../src/config/database.js';
import User from '../src/models/User.js';

dotenv.config();

const emailArg = process.argv[2];
if (!emailArg) {
  console.error('Usage: node scripts/debugUser.js <email>');
  process.exit(1);
}

await connectDB();

const email = String(emailArg).trim().toLowerCase();
const user = await User.findOne({ email }).select('+password');

if (!user) {
  console.log('User not found for', email);
} else {
  console.log('User email:', user.email);
  console.log('Stored password hash:', user.password);
}

process.exit(0);
