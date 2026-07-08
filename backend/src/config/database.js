import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Get the database name from environment or use default
    const dbName = process.env.DB_NAME || 'ai_investment_agent';
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: dbName // This explicitly sets the database name
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
    
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;