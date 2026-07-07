import dotenv from 'dotenv';
import connectDB from '../src/config/database.js';
import User from '../src/models/User.js';
import bcrypt from 'bcryptjs';

dotenv.config();

await connectDB();

console.log('Scanning for plaintext passwords...');

const users = await User.find().select('+password');
let updated = 0;
for (const user of users) {
  const pwd = user.password || '';
  if (pwd && !pwd.startsWith('$2')) {
    console.log('Hashing password for', user.email);
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(pwd, salt);
    await user.save();
    updated++;
  }
}

console.log('Password hashing complete. Updated users:', updated);
process.exit(0);
