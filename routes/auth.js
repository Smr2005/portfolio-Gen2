const router = require("express").Router();
const mongoose = require("mongoose");
const User = require("../model/User");
const createError = require("http-errors");
const crypto = require("crypto");
const Joi = require("@hapi/joi");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
require("dotenv").config();

// Temporary in-memory storage for testing when MongoDB is unavailable
let tempUsers = [];
let tempResetTokens = {};

// Gmail transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../webToken/jwt");

const { sendWelcomeEmail, sendPasswordResetEmail } = require("../SERVICES/emailService");

// registration validation

const authschema = Joi.object({
  name: Joi.string().min(5).max(50),
  email: Joi.string().min(5).max(255).email(),
  password: Joi.string().min(5).max(255),
});

//registration using user schema
router.post("/register", async (req, res, next) => {
  try {
    console.log("=== REGISTRATION REQUEST ===");
    console.log("Request URL:", req.url);
    console.log("Request method:", req.method);
    console.log("Request headers:", req.headers);
    console.log("Request body:", req.body);
    
    const result = await authschema.validateAsync(req.body);
    console.log("Validation passed for:", result.email);
    
    let savedUser;
    
    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
      console.log("Using MongoDB for registration");
      
      const doesExist = await User.findOne({
        email: result.email,
      });
      
      if (doesExist) {
        console.log("User already exists:", result.email);
        throw createError.Conflict(`${result.email} is already registered`);
      }

      console.log("Creating new user in MongoDB...");
      
      // Password will be automatically hashed by the User model pre-save hook
      const user = new User(result);
      savedUser = await user.save();
      console.log("User saved successfully in MongoDB:", savedUser.email);
    } else {
      console.log("MongoDB not connected, using temporary storage");
      
      // Check if user exists in temporary storage
      const existingUser = tempUsers.find(user => user.email === result.email);
      if (existingUser) {
        console.log("User already exists in temp storage:", result.email);
        throw createError.Conflict(`${result.email} is already registered`);
      }
      
      // Hash password manually for temp storage
      const hashedPassword = await bcrypt.hash(result.password, 12);
      
      savedUser = {
        id: Date.now().toString(), // Simple ID generation
        name: result.name,
        email: result.email,
        password: hashedPassword
      };
      
      tempUsers.push(savedUser);
      console.log("User saved successfully in temp storage:", savedUser.email);
    }
    
    // Send welcome email
    try {
      await sendWelcomeEmail(savedUser.email, savedUser.name);
      console.log("Welcome email sent successfully");
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail registration if email fails
    }
    
    console.log("Generating tokens...");
    const accessToken = await signAccessToken(savedUser.id);
    const refreshToken = await signRefreshToken(savedUser.id);
    
    const response = {
      accessToken,
      refreshToken,
      user: {
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email
      }
    };
    
    console.log("Registration successful, sending response");
    res.status(201).json(response);
  } catch (error) {
    console.error("Registration error:", error);
    if (error.isJoi === true) error.status = 422;
    next(error);
  }
});

//login validation
const loginschema = Joi.object({
  email: Joi.string().min(5).max(255).required().email(),
  password: Joi.string().min(5).max(255).required(),
});

//login
router.post("/login", async (req, res, next) => {
  try {
    console.log("=== LOGIN REQUEST ===");
    console.log("Request body:", {email: req.body.email, password: "***"});
    
    const result = await loginschema.validateAsync(req.body);
    console.log("Login validation passed for:", result.email);
    
    let user;
    let isMatch = false;
    
    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
      console.log("Using MongoDB for login");
      
      user = await User.findOne({
        email: result.email,
      });
      
      if (!user) {
        console.log("User not found in MongoDB:", result.email);
        console.log("Checking if user exists in temporary storage...");
        
        // Check temporary storage as fallback
        const tempUser = tempUsers.find(u => u.email === result.email);
        if (tempUser) {
          console.log("User found in temporary storage, switching to temp mode");
          user = tempUser;
          isMatch = await bcrypt.compare(result.password, user.password);
        } else {
          console.log("User not found in MongoDB or temporary storage");
          throw createError.NotFound("User not registered");
        }
      }
    } else {
      console.log("MongoDB not connected, using temporary storage");
      
      user = tempUsers.find(u => u.email === result.email);
      
      if (!user) {
        console.log("User not found in temp storage:", result.email);
        throw createError.NotFound("User not registered");
      }
      
      console.log("User found in temp storage, checking password...");
      isMatch = await bcrypt.compare(result.password, user.password);
    }
    
    if (!isMatch) {
      console.log("Invalid password for:", result.email);
      throw createError.Unauthorized("Username/password not valid");
    }

    console.log("Password valid, generating tokens...");
    const accessToken = await signAccessToken(user.id);
    const refreshToken = await signRefreshToken(user.id);

    const response = {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    };

    console.log("Login successful for:", user.email);
    res.json(response);
  } catch (error) {
    console.error("Login error:", error);
    if (error.isJoi === true)
      return next(createError.BadRequest("Invalid Username/Password"));
    next(error);
  }
});

//jwt refresh if expires

router.post("/refresh-token", async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw createError.BadRequest();
    const userId = await verifyRefreshToken(refreshToken);

    const accessToken = await signAccessToken(userId);
    const refToken = await signRefreshToken(userId);
    res.send({
      accessToken: accessToken,
      refreshToken: refToken,
    });
  } catch (error) {
    next(error);
  }
});

//delete route

router.delete("/logout", async (req, res, next) => {
  console.log("logout");
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw createError.BadRequest();
    const userId = await verifyRefreshToken(refreshToken);
    
    // For JWT-based auth, logout is handled client-side by removing tokens
    // Server just validates the refresh token and responds with success
    console.log(`User ${userId} logged out successfully`);
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    console.log("=== PASSWORD RESET REQUEST ===");
    console.log("Email:", req.body.email);
    
    if (!req.body.email) {
      return res.status(422).json({ error: "Email is required" });
    }
    
    let user;
    const token = crypto.randomBytes(32).toString("hex");
    
    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
      console.log("Using MongoDB for password reset");
      
      user = await User.findOne({ email: req.body.email });
      if (!user) {
        return res.status(422).json({ error: "User doesn't exist with that email" });
      }
      
      user.resetToken = token;
      user.expireToken = Date.now() + 3600000; // 1 hour
      await user.save();
    } else {
      console.log("MongoDB not connected, using temporary storage");
      
      user = tempUsers.find(u => u.email === req.body.email);
      if (!user) {
        return res.status(422).json({ error: "User doesn't exist with that email" });
      }
      
      // Store reset token in temporary storage
      tempResetTokens[token] = {
        email: user.email,
        expireTime: Date.now() + 3600000 // 1 hour
      };
    }
    
    console.log("Reset token generated for:", user.email);
    
    // For development/testing, return success without sending email
    // In production, you would want to send actual emails
    console.log("Password reset token generated:", token);
    console.log("Reset link would be: http://localhost:3000/reset/" + token);
    
    // Try to send email, but don't fail if it doesn't work
    try {
      const emailResult = await sendPasswordResetEmail(user.email, user.name, token);
      if (emailResult.success) {
        console.log("Password reset email sent successfully");
        res.json({ message: "Password reset email sent! Check your inbox." });
      } else {
        console.error("Failed to send reset email:", emailResult.error);
        // For development, still return success even if email fails
        res.json({ 
          message: "Password reset initiated. Check console for reset link (email service unavailable).",
          resetToken: token // Include token for testing
        });
      }
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
      // For development, still return success even if email fails
      res.json({ 
        message: "Password reset initiated. Check console for reset link (email service unavailable).",
        resetToken: token // Include token for testing
      });
    }
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/new-password", async (req, res) => {
  try {
    console.log("=== NEW PASSWORD REQUEST ===");
    console.log("Token:", req.body.token);
    
    const newPassword = req.body.password;
    const sentToken = req.body.token;
    
    if (!newPassword || !sentToken) {
      return res.status(422).json({ error: "Password and token are required" });
    }
    
    if (newPassword.length < 5) {
      return res.status(422).json({ error: "Password must be at least 5 characters long" });
    }
    
    let user;
    
    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
      console.log("Using MongoDB for password update");
      
      user = await User.findOne({ resetToken: sentToken, expireToken: { $gt: Date.now() } });
      
      if (!user) {
        return res.status(422).json({ error: "Invalid or expired reset token" });
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      user.password = hashedPassword;
      user.resetToken = undefined;
      user.expireToken = undefined;
      
      await user.save();
    } else {
      console.log("MongoDB not connected, using temporary storage");
      
      // Check if token exists and is not expired
      const tokenData = tempResetTokens[sentToken];
      if (!tokenData || tokenData.expireTime < Date.now()) {
        return res.status(422).json({ error: "Invalid or expired reset token" });
      }
      
      // Find user in temp storage
      user = tempUsers.find(u => u.email === tokenData.email);
      if (!user) {
        return res.status(422).json({ error: "User not found" });
      }
      
      // Update password in temp storage
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      user.password = hashedPassword;
      
      // Remove the reset token
      delete tempResetTokens[sentToken];
    }
    
    console.log("Password updated successfully for:", user.email);
    res.json({ message: "Password updated successfully" });
    
  } catch (error) {
    console.error("New password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Debug endpoint to check database connection and user status
router.get("/debug-status", async (req, res) => {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      mongoConnection: {
        readyState: mongoose.connection.readyState,
        status: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      tempUsersCount: tempUsers.length,
      environment: process.env.NODE_ENV || 'development'
    };

    // If MongoDB is connected, try to count users
    if (mongoose.connection.readyState === 1) {
      try {
        const userCount = await User.countDocuments();
        debugInfo.mongoUsers = {
          totalCount: userCount,
          sampleEmails: []
        };
        
        // Get first 5 user emails for debugging (without passwords)
        const sampleUsers = await User.find({}, { email: 1, name: 1, _id: 0 }).limit(5);
        debugInfo.mongoUsers.sampleEmails = sampleUsers.map(u => u.email);
      } catch (dbError) {
        debugInfo.mongoUsers = { error: dbError.message };
      }
    }

    // Add temp users info (without passwords)
    if (tempUsers.length > 0) {
      debugInfo.tempUsers = tempUsers.map(u => ({ email: u.email, name: u.name }));
    }

    res.json(debugInfo);
  } catch (error) {
    console.error("Debug status error:", error);
    res.status(500).json({ error: "Failed to get debug status", details: error.message });
  }
});

// Debug endpoint to check specific user
router.post("/debug-user", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const debugInfo = {
      email: email,
      timestamp: new Date().toISOString(),
      mongoConnection: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      found: {
        inMongo: false,
        inTempStorage: false
      }
    };

    // Check MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        const mongoUser = await User.findOne({ email: email }, { email: 1, name: 1, _id: 1 });
        if (mongoUser) {
          debugInfo.found.inMongo = true;
          debugInfo.mongoUser = {
            id: mongoUser._id,
            email: mongoUser.email,
            name: mongoUser.name
          };
        }
      } catch (dbError) {
        debugInfo.mongoError = dbError.message;
      }
    }

    // Check temp storage
    const tempUser = tempUsers.find(u => u.email === email);
    if (tempUser) {
      debugInfo.found.inTempStorage = true;
      debugInfo.tempUser = {
        email: tempUser.email,
        name: tempUser.name
      };
    }

    res.json(debugInfo);
  } catch (error) {
    console.error("Debug user error:", error);
    res.status(500).json({ error: "Failed to debug user", details: error.message });
  }
});

// Emergency user creation endpoint (for debugging)
router.post("/emergency-register", async (req, res) => {
  try {
    console.log("=== EMERGENCY REGISTRATION ===");
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }
    
    // Force registration in temporary storage
    const existingUser = tempUsers.find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({ error: "User already exists in temporary storage" });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const tempUser = {
      id: Date.now().toString(),
      name: name,
      email: email,
      password: hashedPassword,
      createdAt: new Date()
    };
    
    tempUsers.push(tempUser);
    console.log("Emergency user created:", tempUser.email);
    console.log("Total temp users:", tempUsers.length);
    
    const accessToken = await signAccessToken(tempUser.id);
    const refreshToken = await signRefreshToken(tempUser.id);
    
    res.json({
      message: "User created successfully in temporary storage",
      accessToken,
      refreshToken,
      user: {
        id: tempUser.id,
        name: tempUser.name,
        email: tempUser.email
      }
    });
    
  } catch (error) {
    console.error("Emergency registration error:", error);
    res.status(500).json({ error: "Emergency registration failed", details: error.message });
  }
});

module.exports = router;
