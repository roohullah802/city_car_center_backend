import express from 'express';
import mongoose, { connect } from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from './src/db/mongodb'

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI || '', {
}).then(() => {
    connectDB()
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
    console.error('DB connection failed:', err);
});
