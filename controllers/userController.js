const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const sendEmail = require('../emailService');

// // Function to generate a random 5-character code in the required format
// const generateCode = () => {
//     const numbers = ['10', '20', '30', '40', '50', '60', '70', '80', '90'];
//     const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

//     // Select random numbers and letters
//     const randomNumber = numbers[Math.floor(Math.random() * numbers.length)];
//     const randomLetter = letters[Math.floor(Math.random() * letters.length)];
    
//     return `${randomNumber} ${randomLetter}`;
// };

const generateCode = () => {
    const numbers = ['10', '20', '30', '40', '50', '60', '70', '80', '90'];
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    // Select two random numbers and two random letters
    const randomNumber1 = numbers[Math.floor(Math.random() * numbers.length)];
    const randomLetter1 = letters[Math.floor(Math.random() * letters.length)];
    const randomNumber2 = numbers[Math.floor(Math.random() * numbers.length)];
    const randomLetter2 = letters[Math.floor(Math.random() * letters.length)];
    
    // Format the code with four parts
    return `${randomNumber1} ${randomLetter1} ${randomNumber2} ${randomLetter2}`;
};


const registerUser = async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate a code for the user
    const userCode = generateCode();

    // Create the user
    const user = await User.create({ username, email, password: hashedPassword, code: userCode });

    // Create the JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Send registration email with code
    const emailContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4; text-align: center;">
            <h2>Welcome to AGRISENSE, ${username}!</h2>
            <p>Thank you for registering with us.</p>
            <p><strong>Your account has been successfully created.</strong></p>
            <p><strong>Your code to continue:</strong> ${userCode}</p>
            <p><a href="http://localhost:3000/login" style="background: #28a745; padding: 10px 20px; color: #fff; text-decoration: none; border-radius: 5px;">Login Now</a></p>
            <p>For support, contact <a href="mailto:support@agrisense.com">support@agrisense.com</a></p>
            <p>Best regards,<br><strong>AGRISENSE Team</strong></p>
        </div>
    `;
    sendEmail(email, "Welcome to AGRISENSE!", emailContent);

    // Respond with success and token
    res.status(201).json({ message: 'User registered successfully', token });
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // Create the JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Send login notification email
    const emailContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4; text-align: center;">
            <h2>Hello ${user.username},</h2>
            <p>We noticed a successful login to your AGRISENSE account.</p>
            <p>If this was you, you can ignore this email.</p>
            <p>If this wasn't you, please reset your password immediately.</p>
            <p><a href="http://localhost:3000/reset-password" style="background: #dc3545; padding: 10px 20px; color: #fff; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
            <p>For support, contact <a href="mailto:support@agrisense.com">support@agrisense.com</a></p>
            <p>Best regards,<br><strong>AGRISENSE Team</strong></p>
        </div>
    `;
    sendEmail(email, "Security Alert: Successful Login", emailContent);

    // Respond with success and token
    res.status(200).json({ message: 'Login successful', token });
};

module.exports = { registerUser, loginUser };
