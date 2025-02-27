const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect('mongodb+srv://irasubizasalynelson:agrisense@agrisense.gjhd0.mongodb.net/?retryWrites=true&w=majority&appName=AGRISENSE');
        console.log('connected to database successfully!');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

module.exports = connectDB;
