const express = require("express");
const passport = require("passport");
const keys = require("./config/keys");
const cookieSession = require("cookie-session");
const cors = require("cors");
const path = require("path");
//ROUTES
const authRoute = require("./routes/auth");
const portfolioRoute = require("./routes/portfolio");
const uploadRoute = require("./routes/upload");

//MODELS
require("./model/User");
require("./model/Portfolio");
require("./model/Feedback");

//CHORE
const app = express();
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// Load environment variables
dotenv.config();

// Enable CORS for frontend communication
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = process.env.NODE_ENV === 'production' || process.env.PORT
            ? ["https://portfolio-gen-i1bg.onrender.com"]
            : ["http://localhost:3000", "http://localhost:3001"];
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(null, true); // Allow all origins for now to debug
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token', 'x-admin-secret', 'x-admin-username', 'x-admin-password', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar']
}));

//mongo connect
console.log("Attempting to connect to MongoDB...");
mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
})
.then(() => {
    console.log("✅ Connected to MongoDB successfully");
})
.catch((error) => {
    console.error("❌ MongoDB connection error:", error.message);
    console.log("⚠️  Server will continue without database connection");
    // Don't exit, continue without database for now
});

// useCreateIndex is deprecated in Mongoose 6+

// Handle MongoDB connection events
mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

//
// Cookie session temporarily disabled
// app.use(
//     cookieSession({
//         maxAge: 30 * 24 * 60 * 60 * 1000,
//         keys: [keys.cookieKey],
//     })
// );
// OAuth temporarily disabled for basic functionality
// app.use(passport.initialize());
// app.use(passport.session());
// require("./SERVICES/passport");
// require("./routes/oauth")(app);
//

const {
    verifyAccessToken
} = require("./webToken/jwt");
const { upload } = require("./SERVICES/fileUploadService");
dotenv.config();

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Handle preflight requests
app.options('*', cors());

//Route Middleware For Login And Signup routes
app.use("/api/user", authRoute);

//Route Middleware For Portfolio routes
app.use("/api/portfolio", portfolioRoute);

//Route Middleware For File Upload routes
app.use("/api/upload", uploadRoute);

//Route Middleware For Admin routes
const adminRoute = require("./routes/admin");
app.use("/api/admin", adminRoute);

//Route Middleware For User Profile routes
const userProfileRoute = require("./routes/userProfile");
app.use("/api/user-profile", userProfileRoute);

// Note: Files are now stored in MongoDB as base64 data, no longer serving static files from uploads directory

// Admin cleanup interface
app.get("/admin-cleanup", (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-cleanup.html'));
});

// Admin simple interface (new simplified version)
app.get("/admin-simple", (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-simple.html'));
});

// Admin secure interface (completely secure - no content before login)
app.get("/admin-secure", (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-secure.html'));
});

// Admin test interface
app.get("/admin-test", (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-test.html'));
});

// API health check route (moved after API routes)
app.get("/api/health", async (req, res, next) => {
    res.json({ 
        status: "Portfolio Generator Backend is running!",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 5000,
        cors_origin: req.headers.origin
    });
});

// Test upload endpoint without authentication
app.post("/api/test-upload", upload.single('testFile'), (req, res) => {
    res.json({
        message: "Test upload endpoint working",
        file: req.file ? "File received" : "No file",
        headers: req.headers
    });
});

// Test data storage endpoint
app.get("/api/test-data-storage", (req, res) => {
    const testData = {
        profileImage: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...", // Sample base64 data
        resume: "data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO8w6...", // Sample base64 data
        projects: [
            {
                image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
                title: "Test Project"
            }
        ]
    };
    
    res.json({
        message: "Files are now stored as base64 data URLs in MongoDB",
        storageType: "MongoDB Base64",
        sampleData: testData,
        environment: process.env.NODE_ENV || 'development',
        backendUrl: process.env.BACKEND_URL,
        advantages: [
            "No file system dependencies",
            "Works on any hosting platform",
            "No file persistence issues",
            "All data in one database"
        ]
    });
});

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production' || process.env.PORT) {
    // Serve static files from React build
    const buildPath = path.join(__dirname, 'client/build');
    console.log('Serving static files from:', buildPath);
    console.log('Directory exists:', require('fs').existsSync(buildPath));
    
    app.use(express.static(buildPath));
    
    // Add explicit file serving for common assets
    app.get('/static/*', (req, res, next) => {
        const filePath = path.join(buildPath, req.path);
        console.log('Serving static file:', filePath);
        if (require('fs').existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            next();
        }
    });
}

// API endpoint to get portfolio data (for React app)
app.get("/api/portfolio/:slug", async (req, res) => {
    try {
        const Portfolio = require("./model/Portfolio");
        const { slug } = req.params;
        
        const portfolio = await Portfolio.findOne({ slug, isPublished: true });
        
        if (!portfolio) {
            return res.status(404).json({ error: "Portfolio not found" });
        }
        
        // Increment view count
        portfolio.views += 1;
        portfolio.lastViewed = new Date();
        await portfolio.save();
        
        // Return portfolio data as JSON
        res.json(portfolio);
        
    } catch (error) {
        console.error("Get portfolio API error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Public route to serve published portfolios as React app
app.get("/portfolio/:slug", async (req, res) => {
    try {
        const Portfolio = require("./model/Portfolio");
        const { slug } = req.params;
        
        // Check if portfolio exists (but don't increment views here)
        const portfolio = await Portfolio.findOne({ slug, isPublished: true });
        
        if (!portfolio) {
            // Serve React app for 404 handling
            return res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
        }
        
        // Serve React app - it will fetch data via /api/portfolio/:slug
        res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
        
    } catch (error) {
        console.error("Serve portfolio error:", error);
        // Serve React app even on error - let React handle error display
        res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    }
});

// Utility function to get the correct base URL
function getBaseUrl() {
    return process.env.BACKEND_URL || 
           (process.env.NODE_ENV === 'production' || process.env.PORT 
             ? 'https://portfolio-gen-i1bg.onrender.com' 
             : 'http://localhost:5000');
}

// Utility function to get the correct frontend URL
function getFrontendUrl() {
    return process.env.FRONTEND_URL || 
           (process.env.NODE_ENV === 'production' || process.env.PORT 
             ? 'https://portfolio-gen-i1bg.onrender.com' 
             : 'http://localhost:3000');
}

// Helper function to ensure data URLs are properly formatted (files are now stored as base64 data URLs)
function ensureDataUrls(data) {
    // Files are now stored as data URLs (data:image/jpeg;base64,xxx), no conversion needed
    // This function is kept for backward compatibility with any existing URL-based data
    const productionUrl = process.env.BACKEND_URL || 'https://portfolio-gen-i1bg.onrender.com';
    const localhostPattern = /http:\/\/localhost:\d+/g;
    
    let dataString = JSON.stringify(data);
    dataString = dataString.replace(localhostPattern, productionUrl);
    
    return JSON.parse(dataString);
}

// Function to generate HTML for portfolio
function generatePortfolioHTML(portfolio) {
    let { data, meta, templateId } = portfolio;
    
    // Ensure data URLs are properly formatted (backward compatibility)
    if (process.env.NODE_ENV === 'production' || process.env.PORT) {
        data = ensureDataUrls(data);
    }
    
    // Generate HTML based on template ID
    switch(templateId) {
        case 'template1':
            return generateTemplate1HTML(data, meta);
        case 'template2':
            return generateTemplate2HTML(data, meta);
        case 'template3':
            console.log('Generating Template3 with data:', { name: data.name, templateId });
            return generateTemplate3HTML(data, meta);
        case 'template4':
            return generateTemplate4HTML(data, meta);
        case 'template5':
            return generateTemplate5HTML(data, meta);
        case 'template6':
            return generateTemplate6HTML(data, meta);
        default:
            return generateTemplate1HTML(data, meta);
    }
}

function generateTemplate1HTML(data, meta) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${meta?.title || data.name + ' - Portfolio'}</title>
    <meta name="description" content="${meta?.description || 'Portfolio of ' + data.name}">
    <meta name="keywords" content="${meta?.keywords ? meta.keywords.join(', ') : ''}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="${meta?.title || data.name + ' - Portfolio'}">
    <meta property="og:description" content="${meta?.description || 'Portfolio of ' + data.name}">
    <meta property="og:image" content="${data.profileImage || ''}">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:title" content="${meta?.title || data.name + ' - Portfolio'}">
    <meta property="twitter:description" content="${meta?.description || 'Portfolio of ' + data.name}">
    <meta property="twitter:image" content="${data.profileImage || ''}">
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <style>
        body { 
            font-family: 'Inter', sans-serif; 
            background-color: #f8fafc;
            overflow-x: hidden;
        }
        
        /* ENHANCED 3D ANIMATIONS - EXACT MATCH TO REACT TEMPLATE */
        @keyframes float3d {
            0%, 100% { transform: translateY(0px) rotateX(0deg) rotateY(0deg); }
            25% { transform: translateY(-10px) rotateX(5deg) rotateY(5deg); }
            50% { transform: translateY(-20px) rotateX(0deg) rotateY(10deg); }
            75% { transform: translateY(-10px) rotateX(-5deg) rotateY(5deg); }
        }
        
        @keyframes rotate3d {
            0% { transform: rotateY(0deg) rotateX(0deg); }
            100% { transform: rotateY(360deg) rotateX(360deg); }
        }
        
        @keyframes slideIn3d {
            0% { transform: translateX(-100px) rotateY(-90deg); opacity: 0; }
            100% { transform: translateX(0) rotateY(0deg); opacity: 1; }
        }
        
        @keyframes glow {
            0%, 100% { box-shadow: 0 0 20px rgba(102, 126, 234, 0.3); }
            50% { box-shadow: 0 0 40px rgba(102, 126, 234, 0.6); }
        }
        
        .card-3d {
            transform-style: preserve-3d;
            transition: transform 0.3s ease;
        }
        
        .card-3d:hover {
            transform: rotateY(10deg) rotateX(5deg) translateZ(20px);
        }
        
        .profile-3d {
            animation: float3d 6s ease-in-out infinite;
            transform-style: preserve-3d;
        }
        
        .skill-bar-3d {
            transform-style: preserve-3d;
            transition: transform 0.3s ease;
        }
        
        .skill-bar-3d:hover {
            transform: translateZ(10px) rotateX(5deg);
        }
        
        /* Navigation */
        .navbar {
            background: rgba(30, 41, 59, 0.95) !important;
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        
        .navbar-brand {
            font-weight: bold;
            font-size: 1.5rem;
        }
        
        /* Hero Section */
        .hero-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            color: white;
            padding-top: 80px;
            position: relative;
            overflow: hidden;
        }
        
        .hero-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
            animation: shimmer 3s ease-in-out infinite;
        }
        
        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        .floating-element {
            position: absolute;
            border-radius: 50%;
            z-index: 1;
        }
        
        .floating-1 {
            top: 20%;
            left: 10%;
            width: 100px;
            height: 100px;
            background: rgba(255,255,255,0.1);
            animation: float3d 8s ease-in-out infinite;
        }
        
        .floating-2 {
            top: 60%;
            right: 15%;
            width: 150px;
            height: 150px;
            background: rgba(255,255,255,0.05);
            animation: float3d 6s ease-in-out infinite reverse;
        }
        
        .floating-3 {
            bottom: 30%;
            left: 20%;
            width: 80px;
            height: 80px;
            background: rgba(255,255,255,0.08);
            animation: rotate3d 10s linear infinite;
        }
        
        .profile-container {
            position: relative;
            z-index: 2;
            margin-bottom: 2rem;
        }
        
        .profile-img { 
            width: 200px; 
            height: 200px; 
            border-radius: 50% !important; 
            border: 5px solid rgba(255,255,255,0.3);
            animation: float3d 6s ease-in-out infinite;
            transform-style: preserve-3d;
            transition: all 0.3s ease;
            object-fit: cover;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }
        
        .profile-img:hover {
            animation-play-state: paused;
            transform: scale(1.1) rotateY(15deg);
            border-color: rgba(255,255,255,0.8);
            box-shadow: 0 30px 60px rgba(0,0,0,0.3);
        }
        
        .hero-content {
            position: relative;
            z-index: 2;
        }
        
        .hero-title {
            font-size: 3.5rem;
            font-weight: 700;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .hero-subtitle {
            font-size: 1.5rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        
        .hero-buttons {
            margin-top: 2rem;
        }
        
        .btn-hero {
            padding: 12px 30px;
            font-size: 1.1rem;
            font-weight: 600;
            border-radius: 50px;
            margin: 0.5rem;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        
        .btn-hero.primary {
            background: rgba(255,255,255,0.2);
            color: white;
            border: 2px solid rgba(255,255,255,0.3);
            backdrop-filter: blur(10px);
        }
        
        .btn-hero.primary:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-3px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            color: white;
            text-decoration: none;
        }
        
        .btn-hero.secondary {
            background: transparent;
            color: white;
            border: 2px solid rgba(255,255,255,0.5);
        }
        
        .btn-hero.secondary:hover {
            background: rgba(255,255,255,0.1);
            color: white;
            text-decoration: none;
        }
        
        /* Section Styles */
        .section-title { 
            color: #333; 
            margin-bottom: 3rem; 
            font-weight: 700;
            font-size: 2.5rem;
            text-align: center;
            position: relative;
        }
        
        .section-title::after {
            content: '';
            position: absolute;
            bottom: -15px;
            left: 50%;
            transform: translateX(-50%);
            width: 60px;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 2px;
        }
        
        .card-3d {
            background: white;
            border-radius: 20px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            border: none;
        }
        
        .card-3d:hover {
            transform: translateY(-10px) rotateY(5deg) rotateX(5deg);
            box-shadow: 0 20px 50px rgba(0,0,0,0.15);
        }
        
        .skill-item { 
            background: white;
            padding: 1.5rem; 
            border-radius: 15px; 
            margin-bottom: 1.5rem;
            box-shadow: 0 5px 15px rgba(0,0,0,0.08);
            transition: all 0.3s ease;
            border-left: 4px solid #667eea;
        }
        
        .skill-item:hover {
            transform: translateX(10px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.12);
        }
        
        .skill-item:hover {
            transform: translateZ(10px) rotateX(5deg);
            background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
            box-shadow: 0 15px 30px rgba(0,0,0,0.15);
            border-left-color: #764ba2;
        }
        
        .progress {
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            background: #e9ecef;
        }
        
        .progress-bar {
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            transition: width 2s ease-in-out;
            animation: progressFill 2s ease-in-out;
        }
        
        .skill-bar-3d {
            transform-style: preserve-3d;
            transition: transform 0.3s ease;
        }
        
        .skill-bar-3d:hover {
            transform: translateZ(10px) rotateX(5deg);
        }
        
        @keyframes progressFill {
            0% { width: 0% !important; }
        }
        
        .card-3d { 
            border: none; 
            box-shadow: 0 8px 25px rgba(0,0,0,0.1); 
            transition: all 0.3s ease;
            transform-style: preserve-3d;
            border-radius: 15px;
            overflow: hidden;
        }
        
        .card-3d:hover { 
            transform: rotateY(10deg) rotateX(5deg) translateZ(20px);
            box-shadow: 0 25px 50px rgba(0,0,0,0.2);
        }
        
        .project-card {
            border: none; 
            box-shadow: 0 8px 25px rgba(0,0,0,0.1); 
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transform-style: preserve-3d;
            border-radius: 15px;
            overflow: hidden;
            position: relative;
        }
        
        .project-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, transparent, rgba(102, 126, 234, 0.05), transparent);
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .project-card:hover::before {
            opacity: 1;
        }
        
        .project-card:hover { 
            transform: rotateY(8deg) rotateX(4deg) translateZ(15px) scale(1.02);
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }
        
        .btn {
            border-radius: 25px;
            padding: 10px 25px;
            font-weight: 600;
            transition: all 0.3s ease;
            transform-style: preserve-3d;
        }
        
        .btn:hover {
            transform: translateZ(5px) scale(1.05);
            box-shadow: 0 10px 20px rgba(0,0,0,0.15);
        }
        
        .btn-outline-light:hover {
            animation: glow 2s ease-in-out infinite;
        }
        
        .footer { 
            background: linear-gradient(135deg, #333 0%, #1a1a1a 100%);
            color: white; 
            padding: 40px 0; 
            margin-top: 50px;
            position: relative;
        }
        
        .powered-by { 
            text-align: center; 
            padding: 20px; 
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            color: #666;
        }
        
        /* MOBILE OPTIMIZATIONS */
        @media (max-width: 768px) {
            .card-3d:hover,
            .project-card:hover,
            .skill-item:hover {
                transform: none !important;
            }
            
            .profile-img {
                animation: none;
            }
            
            .profile-img:hover {
                transform: scale(1.05);
            }
        }
        
        /* LOADING ANIMATIONS */
        .fade-in {
            animation: fadeIn 1s ease-in;
        }
        
        @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes float3d {
            0%, 100% { transform: translateY(0px) rotateX(0deg) rotateY(0deg); }
            25% { transform: translateY(-10px) rotateX(5deg) rotateY(5deg); }
            50% { transform: translateY(-20px) rotateX(0deg) rotateY(10deg); }
            75% { transform: translateY(-10px) rotateX(-5deg) rotateY(5deg); }
        }
        
        @keyframes slideIn3d {
            0% { transform: translateX(-100px) rotateY(-90deg); opacity: 0; }
            100% { transform: translateX(0) rotateY(0deg); opacity: 1; }
        }
    </style>
</head>
<body>
    <!-- Enhanced Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark fixed-top">
        <div class="container">
            <a class="navbar-brand fw-bold" href="#" style="font-size: 1.5rem;">${data.name}</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item"><a class="nav-link" href="#about">About</a></li>
                    <li class="nav-item"><a class="nav-link" href="#experience">Experience</a></li>
                    <li class="nav-item"><a class="nav-link" href="#skills">Skills</a></li>
                    <li class="nav-item"><a class="nav-link" href="#projects">Projects</a></li>
                    <li class="nav-item"><a class="nav-link" href="#contact">Contact</a></li>
                </ul>
            </div>
        </div>
    </nav>

    <!-- Contact Section -->
    <section id="contact" class="gradient-bg text-center" style="padding: 60px 0; color: white;">
        <div class="container">
            <h3 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem;">Ready to Drive Results Together?</h3>
            <p style="font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9;">Let's discuss how I can help grow your business.</p>
            ${data.email ? `<a href="mailto:${data.email}" class="btn-marketing primary" style="font-size: 1.1rem; padding: 15px 40px;">
                <i class="fas fa-envelope me-2"></i>Start the Conversation
            </a>` : ''}
            <div style="margin-top: 3rem;">
                <p style="opacity: 0.8; margin: 0;">&copy; ${new Date().getFullYear()} ${data.name} - Marketing Portfolio</p>
                <small style="opacity: 0.6;">Powered by <a href="${getFrontendUrl()}" target="_blank" style="color: rgba(255,255,255,0.8);">Portfolio Generator</a></small>
            </div>
        </div>
    </section>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
    \`;
}

      </div>
        </div>
    </nav>

    <!-- Enhanced Hero Section with Profile Picture -->
    <section style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        display: flex;
        align-items: center;
        color: white;
        padding-top: 80px;
        position: relative;
        overflow: hidden;
    ">
        <!-- 3D Background Elements -->
        <div style="
            position: absolute;
            top: 20%;
            left: 10%;
            width: 100px;
            height: 100px;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            animation: float3d 8s ease-in-out infinite;
            transform-style: preserve-3d;
        "></div>
        <div style="
            position: absolute;
            bottom: 20%;
            right: 15%;
            width: 80px;
            height: 80px;
            background: rgba(255,255,255,0.08);
            border-radius: 50%;
            animation: float3d 6s ease-in-out infinite reverse;
        "></div>

        <div class="container">
            <div class="row align-items-center">
                <div class="col-md-6">
                    <div style="animation: slideIn3d 1s ease-out;">
                        <h1 style="
                            font-size: 3.5rem;
                            font-weight: 700;
                            margin-bottom: 1rem;
                            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                        ">
                            Hi, I'm ${data.name}
                        </h1>
                        <h2 style="
                            font-size: 1.8rem;
                            margin-bottom: 2rem;
                            opacity: 0.9;
                            font-weight: 400;
                        ">
                            ${data.title}
                        </h2>
                        <p style="
                            font-size: 1.2rem;
                            margin-bottom: 2rem;
                            opacity: 0.8;
                            line-height: 1.6;
                        ">
                            ${data.about || ''}
                        </p>
                        <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem;">
                            <a href="#projects" class="btn btn-light btn-lg" style="
                                font-weight: 600;
                                padding: 12px 30px;
                                border-radius: 25px;
                                text-decoration: none;
                            ">
                                VIEW MY WORK
                            </a>
                            <a href="#contact" class="btn btn-outline-light btn-lg" style="
                                font-weight: 600;
                                padding: 12px 30px;
                                border-radius: 25px;
                                text-decoration: none;
                            ">
                                GET IN TOUCH
                            </a>
                        </div>
                        <!-- Social Links -->
                        <div style="display: flex; gap: 1rem;">
                            ${data.linkedin ? `<a href="${data.linkedin}" target="_blank" rel="noopener noreferrer" style="color: white; font-size: 1.5rem; opacity: 0.8; text-decoration: none;">💼</a>` : ''}
                            ${data.github ? `<a href="${data.github}" target="_blank" rel="noopener noreferrer" style="color: white; font-size: 1.5rem; opacity: 0.8; text-decoration: none;">🔗</a>` : ''}
                            ${data.website ? `<a href="${data.website}" target="_blank" rel="noopener noreferrer" style="color: white; font-size: 1.5rem; opacity: 0.8; text-decoration: none;">🌐</a>` : ''}
                        </div>
                    </div>
                </div>
                <div class="col-md-6 text-center">
                    <div class="profile-3d" style="
                        width: 350px;
                        height: 350px;
                        margin: 0 auto;
                        position: relative;
                    ">
                        ${data.profileImage ? `
                        <img src="${data.profileImage}" alt="${data.name}" style="
                            width: 100%;
                            height: 100%;
                            border-radius: 50%;
                            object-fit: cover;
                            border: 8px solid rgba(255,255,255,0.2);
                            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                            animation: float3d 6s ease-in-out infinite;
                            transform-style: preserve-3d;
                        ">
                        <!-- Status Indicator -->
                        <div style="
                            position: absolute;
                            bottom: 20px;
                            right: 20px;
                            width: 40px;
                            height: 40px;
                            background: #10b981;
                            border-radius: 50%;
                            border: 4px solid white;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 1.2rem;
                            animation: float3d 4s ease-in-out infinite;
                        ">
                            ✓
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Skills Section -->
    ${data.skills && data.skills.length > 0 ? `
    <section class="py-5">
        <div class="container">
            <h2 class="section-title text-center">Skills</h2>
            <div class="row">
                ${data.skills.map(skill => `
                    <div class="col-md-4 mb-3">
                        <div class="skill-item skill-bar-3d">
                            <h5>${skill.name}</h5>
                            <div class="progress">
                                <div class="progress-bar" style="width: ${skill.level}%">${skill.level}%</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- Experience Section -->
    ${data.experience && data.experience.length > 0 ? `
    <section class="py-5 bg-light">
        <div class="container">
            <h2 class="section-title text-center">Experience</h2>
            ${data.experience.map(exp => `
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card card-3d">
                            <div class="card-body">
                                <h5 class="card-title" style="color: #667eea; font-weight: 700;">${exp.position}</h5>
                                <h6 class="card-subtitle mb-2 text-muted">${exp.company} • ${exp.duration}</h6>
                                ${exp.location ? `<p class="text-muted"><i class="fas fa-map-marker-alt"></i> ${exp.location}</p>` : ''}
                                ${exp.description ? `<p class="card-text">${exp.description}</p>` : ''}
                                ${exp.achievements && exp.achievements.length > 0 ? `
                                    <ul style="list-style-type: none; padding-left: 0;">
                                        ${exp.achievements.map(achievement => `<li style="padding: 5px 0; color: #555;"><i class="fas fa-check-circle" style="color: #667eea; margin-right: 8px;"></i>${achievement}</li>`).join('')}
                                    </ul>
            </div>
        </div>
    </nav>

    <!-- Contact Section -->
    <section id="contact" class="gradient-bg text-center" style="padding: 60px 0; color: white;">
        <div class="container">
            <h3 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem;">Ready to Drive Results Together?</h3>
            <p style="font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9;">Let's discuss how I can help grow your business.</p>
            ${data.email ? `<a href="mailto:${data.email}" class="btn-marketing primary" style="font-size: 1.1rem; padding: 15px 40px;">
                <i class="fas fa-envelope me-2"></i>Start the Conversation
            </a>` : ''}
            <div style="margin-top: 3rem;">
                <p style="opacity: 0.8; margin: 0;">&copy; ${new Date().getFullYear()} ${data.name} - Marketing Portfolio</p>
                <small style="opacity: 0.6;">Powered by <a href="${getFrontendUrl()}" target="_blank" style="color: rgba(255,255,255,0.8);">Portfolio Generator</a></small>
            </div>
        </div>
    </section>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
    \`;
}

                          ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </section>
    ` : ''}

    <!-- Projects Section -->
    ${data.projects && data.projects.length > 0 ? `
    <section class="py-5">
        <div class="container">
            <h2 class="section-title text-center">Projects</h2>
            <div class="row">
                ${data.projects.map(project => `
                    <div class="col-md-6 mb-4">
                        <div class="card project-card h-100 fade-in">
                            ${project.image ? `<img src="${project.image}" class="card-img-top" alt="${project.title}" style="height: 200px; object-fit: cover;">` : ''}
                            <div class="card-body">
                                <h5 class="card-title" style="color: #667eea; font-weight: 700;">${project.title}</h5>
                                <p class="card-text">${project.description}</p>
                                ${project.tech && project.tech.length > 0 ? `
                                    <div class="mb-3">
                                        ${project.tech.map(tech => `<span class="badge me-1" style="background: linear-gradient(90deg, #667eea, #764ba2); color: white; border-radius: 15px; padding: 5px 12px;">${tech}</span>`).join('')}
                                    </div>
                                ` : ''}
                                <div>
                                    ${project.demo ? `<a href="${project.demo}" target="_blank" class="btn btn-primary btn-sm me-2" style="background: linear-gradient(90deg, #667eea, #764ba2); border: none; border-radius: 20px;">🚀 Live Demo</a>` : ''}
                                    ${project.github ? `<a href="${project.github}" target="_blank" class="btn btn-outline-secondary btn-sm" style="border-radius: 20px;"><i class="fab fa-github"></i> Code</a>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- Education Section -->
    ${data.education && data.education.length > 0 ? `
    <section class="py-5 bg-light">
        <div class="container">
            <h2 class="section-title text-center">Education</h2>
            ${data.education.map(edu => `
                <div class="row mb-3">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-body">
                                <h5 class="card-title">${edu.degree} ${edu.field ? 'in ' + edu.field : ''}</h5>
                                <h6 class="card-subtitle mb-2 text-muted">${edu.institution} • ${edu.duration}</h6>
                                ${edu.location ? `<p class="text-muted"><i class="fas fa-map-marker-alt"></i> ${edu.location}</p>` : ''}
                                ${edu.gpa ? `<p class="text-muted">GPA: ${edu.gpa}</p>` : ''}
                                ${edu.description ? `<p class="card-text">${edu.description}</p>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </section>
    ` : ''}

    <!-- Certifications Section -->
    ${data.certifications && data.certifications.length > 0 ? `
    <section class="py-5">
        <div class="container">
            <h2 class="section-title text-center">Certifications</h2>
            <div class="row">
                ${data.certifications.map(cert => `
                    <div class="col-md-6 mb-4">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <div class="mb-3">
                                    <i class="fas fa-certificate fa-3x text-warning"></i>
                                </div>
                                <h5 class="card-title">${cert.name}</h5>
                                <h6 class="card-subtitle mb-2 text-muted">${cert.issuer}</h6>
                                ${cert.date ? `<p class="text-muted"><i class="fas fa-calendar"></i> ${cert.date}</p>` : ''}
                                ${cert.url ? `<a href="${cert.url}" target="_blank" class="btn btn-outline-primary btn-sm">View Certificate</a>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- Internships Section -->
    ${data.internships && data.internships.length > 0 ? `
    <section class="py-5 bg-light">
        <div class="container">
            <h2 class="section-title text-center">Internships & Early Experience</h2>
            ${data.internships.map(internship => `
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-body">
                                <div class="d-flex align-items-center mb-3">
                                    <i class="fas fa-rocket fa-2x text-primary me-3"></i>
                                    <div>
                                        <h5 class="card-title mb-1">${internship.position}</h5>
                                        <h6 class="card-subtitle text-muted">${internship.company} • ${internship.duration}</h6>
                                    </div>
                                </div>
                                ${internship.location ? `<p class="text-muted"><i class="fas fa-map-marker-alt"></i> ${internship.location}</p>` : ''}
                                ${internship.description ? `<p class="card-text">${internship.description}</p>` : ''}
                                ${internship.achievements && internship.achievements.length > 0 ? `
                                    <div>
                                        <h6 class="fw-bold">Key Achievements:</h6>
                                        <ul>
                                            ${internship.achievements.map(achievement => `<li>${achievement}</li>`).join('')}
                                        </ul>
            </div>
        </div>
    </nav>

    <!-- Contact Section -->
    <section id="contact" class="gradient-bg text-center" style="padding: 60px 0; color: white;">
        <div class="container">
            <h3 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem;">Ready to Drive Results Together?</h3>
            <p style="font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9;">Let's discuss how I can help grow your business.</p>
            ${data.email ? `<a href="mailto:${data.email}" class="btn-marketing primary" style="font-size: 1.1rem; padding: 15px 40px;">
                <i class="fas fa-envelope me-2"></i>Start the Conversation
            </a>` : ''}
            <div style="margin-top: 3rem;">
                <p style="opacity: 0.8; margin: 0;">&copy; ${new Date().getFullYear()} ${data.name} - Marketing Portfolio</p>
                <small style="opacity: 0.6;">Powered by <a href="${getFrontendUrl()}" target="_blank" style="color: rgba(255,255,255,0.8);">Portfolio Generator</a></small>
            </div>
        </div>
    </section>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
    \`;
}

                              </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </section>
    ` : ''}

    <!-- Footer -->
    <footer class="footer">
        <div class="container text-center">
            <h5>${data.name}</h5>
            <p>${data.title}</p>
            <div class="mb-3">
                ${data.email ? `<a href="mailto:${data.email}" class="text-white me-3"><i class="fas fa-envelope"></i></a>` : ''}
                ${data.linkedin ? `<a href="${data.linkedin}" target="_blank" class="text-white me-3"><i class="fab fa-linkedin"></i></a>` : ''}
                ${data.github ? `<a href="${data.github}" target="_blank" class="text-white me-3"><i class="fab fa-github"></i></a>` : ''}
                ${data.website ? `<a href="${data.website}" target="_blank" class="text-white"><i class="fas fa-globe"></i></a>` : ''}
            </div>
        </div>
    </footer>

    <!-- Powered By -->
    <div class="powered-by">
        <small>Powered by <a href="${getFrontendUrl()}" target="_blank">Portfolio Generator</a></small>
    </div>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
    `;
}

function generateTemplate2HTML(data, meta) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${meta?.title || data.name + ' - Creative Portfolio'}</title>
    <meta name="description" content="${meta?.description || 'Creative Portfolio of ' + data.name}">
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    
    <style>
        body { 
            font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0;
            padding: 0;
            overflow-x: hidden;
        }
        
        /* ENHANCED CREATIVE ANIMATIONS - EXACT MATCH TO REACT TEMPLATE */
        @keyframes creativeFloat {
            0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
            25% { transform: translateY(-15px) rotate(2deg) scale(1.05); }
            50% { transform: translateY(-25px) rotate(-1deg) scale(1.1); }
            75% { transform: translateY(-10px) rotate(1deg) scale(1.05); }
        }
        
        @keyframes colorShift {
            0% { filter: hue-rotate(0deg); }
            25% { filter: hue-rotate(90deg); }
            50% { filter: hue-rotate(180deg); }
            75% { filter: hue-rotate(270deg); }
            100% { filter: hue-rotate(360deg); }
        }
        
        @keyframes morphShape {
            0%, 100% { border-radius: 50% 30% 70% 40%; transform: rotate(0deg); }
            25% { border-radius: 30% 70% 40% 50%; transform: rotate(90deg); }
            50% { border-radius: 70% 40% 50% 30%; transform: rotate(180deg); }
            75% { border-radius: 40% 50% 30% 70%; transform: rotate(270deg); }
        }
        
        @keyframes slideInCreative {
            0% { transform: translateX(-100px) rotateY(-45deg) scale(0.8); opacity: 0; }
            100% { transform: translateX(0) rotateY(0deg) scale(1); opacity: 1; }
        }
        
        @keyframes morphShape {
            0%, 100% { border-radius: 50% 30% 70% 40%; transform: rotate(0deg); }
            25% { border-radius: 30% 70% 40% 50%; transform: rotate(90deg); }
            50% { border-radius: 70% 40% 50% 30%; transform: rotate(180deg); }
            75% { border-radius: 40% 50% 30% 70%; transform: rotate(270deg); }
        }
        
        @keyframes slideInCreative {
            0% { transform: translateX(-100px) rotateY(-45deg) scale(0.8); opacity: 0; }
            100% { transform: translateX(0) rotateY(0deg) scale(1); opacity: 1; }
        }
        
        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
        .creative-header { 
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57);
            background-size: 400% 400%;
            animation: gradientShift 15s ease infinite;
            color: white; 
            padding: 100px 0;
            position: relative;
            overflow: hidden;
        }
        
        .creative-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%),
                        radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%);
            animation: colorShift 8s linear infinite;
        }
        
        .profile-img { 
            width: 180px; 
            height: 180px;
            border-radius: 0 !important;
            border: 6px solid white; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            animation: morphShape 15s ease-in-out infinite;
            transition: all 0.3s ease;
            transform-style: preserve-3d;
            object-fit: cover;
        }
        
        .profile-img:hover {
            animation-play-state: paused;
            transform: scale(1.2) rotateY(15deg);
            box-shadow: 0 25px 50px rgba(0,0,0,0.4);
            border-color: #feca57;
        }
        
        .creative-card { 
            border: none; 
            border-radius: 20px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.1); 
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            overflow: hidden;
            transform-style: preserve-3d;
            animation: slideInCreative 1s ease-out;
            position: relative;
        }
        
        .creative-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, rgba(255, 107, 107, 0.1), rgba(78, 205, 196, 0.1));
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .creative-card:hover::before {
            opacity: 1;
        }
        
        .creative-card:hover { 
            transform: rotateY(15deg) rotateX(10deg) translateZ(30px) scale(1.05);
            box-shadow: 0 30px 60px rgba(0,0,0,0.2);
        }
        
        .skill-orb {
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4); 
            color: white; 
            border: none;
            border-radius: 50px;
            padding: 10px 20px;
            margin: 8px;
            display: inline-block;
            font-weight: 600;
            transform-style: preserve-3d;
            transition: all 0.3s ease;
            animation: creativeFloat 6s ease-in-out infinite;
            box-shadow: 0 8px 25px rgba(255, 107, 107, 0.3);
        }
        
        .skill-orb:hover {
            transform: translateZ(20px) rotateY(180deg) scale(1.2);
            animation-play-state: paused;
            box-shadow: 0 15px 40px rgba(255, 107, 107, 0.5);
        }
        
        .project-showcase {
            border: none; 
            border-radius: 20px; 
            overflow: hidden; 
            box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
            transform-style: preserve-3d;
            transition: all 0.5s ease;
            position: relative;
        }
        
        .project-showcase::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, rgba(255, 107, 107, 0.1), rgba(78, 205, 196, 0.1));
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .project-showcase:hover::after {
            opacity: 1;
        }
        
        .project-showcase:hover { 
            transform: perspective(1000px) rotateX(10deg) rotateY(5deg) translateZ(20px) scale(1.02);
            box-shadow: 0 25px 50px rgba(0,0,0,0.3);
        }
        
        .section-title { 
            color: #2c3e50; 
            font-weight: 800; 
            margin-bottom: 40px; 
            position: relative;
            animation: slideInCreative 1s ease-out;
        }
        
        .section-title::after { 
            content: ''; 
            position: absolute; 
            bottom: -10px; 
            left: 50%; 
            transform: translateX(-50%); 
            width: 80px; 
            height: 4px; 
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1); 
            border-radius: 2px;
            animation: gradientShift 3s ease infinite;
            background-size: 200% 100%;
        }
        
        .btn {
            border-radius: 25px;
            padding: 12px 30px;
            font-weight: 600;
            transition: all 0.3s ease;
            transform-style: preserve-3d;
            position: relative;
            overflow: hidden;
        }
        
        .btn::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
            transition: all 0.5s ease;
            border-radius: 50%;
            transform: translate(-50%, -50%);
        }
        
        .btn:hover::before {
            width: 300px;
            height: 300px;
        }
        
        .btn:hover {
            transform: translateZ(10px) scale(1.05);
            box-shadow: 0 15px 30px rgba(0,0,0,0.2);
        }
        
        /* MOBILE OPTIMIZATIONS */
        @media (max-width: 768px) {
            .creative-card:hover,
            .skill-orb:hover,
            .project-showcase:hover {
                transform: none !important;
            }
            
            .skill-orb,
            .profile-img {
                animation: none !important;
            }
            
            .creative-card:hover {
                transform: translateY(-5px) !important;
            }
            
            .profile-img:hover {
                transform: scale(1.1) !important;
            }
        }
        
        .fade-in-creative {
            animation: slideInCreative 1s ease-out;
        }
        
        /* Hero Section Styles - EXACT MATCH TO REACT */
        .hero-section {
            background: linear-gradient(45deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
            min-height: 100vh;
            position: relative;
            overflow: hidden;
            padding-top: 100px;
        }
        
        .bg-shape {
            position: absolute;
            background: rgba(255,255,255,0.15);
            border-radius: 50% 30% 70% 40%;
        }
        
        .white-card {
            background: rgba(255,255,255,0.95);
            padding: 4rem;
            border-radius: 30px;
            box-shadow: 0 30px 60px rgba(0,0,0,0.15);
            backdrop-filter: blur(20px);
            animation: slideInCreative 1.2s ease-out;
        }
        
        .creative-badge {
            display: inline-block;
            background: linear-gradient(45deg, #ff6b6b, #feca57);
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .hero-name {
            font-size: 4rem;
            font-weight: 800;
            color: #2c3e50;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
            line-height: 1.1;
        }
        
        .hero-title {
            font-size: 1.8rem;
            color: #e74c3c;
            margin-bottom: 2rem;
            font-style: italic;
            font-weight: 400;
        }
        
        .hero-description {
            font-size: 1.2rem;
            color: #34495e;
            line-height: 1.8;
            margin-bottom: 2.5rem;
        }
        
        .hero-buttons {
            display: flex;
            gap: 1rem;
            margin-bottom: 2rem;
            flex-wrap: wrap;
        }
        
        .btn-primary {
            background: linear-gradient(45deg, #e74c3c, #f39c12);
            border: none;
            padding: 15px 35px;
            font-size: 1.1rem;
            border-radius: 30px;
            box-shadow: 0 8px 25px rgba(231,76,60,0.3);
            font-weight: 600;
            color: white;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
        }
        
        .btn-primary:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 35px rgba(231,76,60,0.4);
            color: white;
            text-decoration: none;
        }
        
        .btn-secondary {
            background: transparent;
            border: 2px solid #e74c3c;
            color: #e74c3c;
            padding: 13px 33px;
            font-size: 1.1rem;
            border-radius: 30px;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
        }
        
        .btn-secondary:hover {
            background: #e74c3c;
            color: white;
            transform: translateY(-3px);
            text-decoration: none;
        }
        
        .social-icons {
            display: flex;
            gap: 1.5rem;
        }
        
        .social-icon {
            color: #e74c3c;
            font-size: 1.8rem;
            transition: transform 0.3s ease;
            text-decoration: none;
        }
        
        .social-icon:hover {
            transform: scale(1.2) rotate(10deg);
            color: #e74c3c;
            text-decoration: none;
        }
        
        .profile-container {
            position: relative;
            width: 400px;
            height: 400px;
            margin: 0 auto;
        }
        
        .profile-floating {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 350px;
            height: 350px;
            background: linear-gradient(45deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1));
            border-radius: 50%;
            animation: creativeFloat 8s ease-in-out infinite;
        }
        
        .profile-img {
            position: relative;
            width: 300px;
            height: 300px;
            border-radius: 0 !important;
            object-fit: cover;
            border: 8px solid rgba(255,255,255,0.3);
            box-shadow: 0 25px 50px rgba(0,0,0,0.2);
            z-index: 2;
            animation: creativeFloat 6s ease-in-out infinite reverse;
        }
        
        .status-badge {
            position: absolute;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(45deg, #10b981, #34d399);
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.5rem;
            font-weight: bold;
            box-shadow: 0 8px 20px rgba(16,185,129,0.3);
        }
        
        /* Mobile Optimizations */
        @media (max-width: 768px) {
            .creative-card:hover,
            .profile-floating:hover {
                transform: none !important;
                animation: none !important;
            }
            
            .hero-section {
                padding-top: 80px !important;
                min-height: auto !important;
            }
            
            .white-card {
                margin: 1rem !important;
                padding: 1.5rem !important;
            }
            
            .profile-container {
                width: 250px !important;
                height: 250px !important;
            }
            
            .profile-img {
                width: 180px !important;
                height: 180px !important;
            }
            
            .hero-name {
                font-size: 2rem !important;
            }
            
            .hero-title {
                font-size: 1.2rem !important;
            }
            
            .hero-description {
                font-size: 0.9rem !important;
            }
            
            .hero-buttons {
                flex-direction: column;
            }
            
            .btn-primary, .btn-secondary {
                width: 100%;
                max-width: 300px;
                font-size: 0.9rem !important;
                padding: 12px 25px !important;
            }
        }
    </style>
</head>
<body>
    <!-- Creative Hero Section - EXACT MATCH TO REACT -->
    <section class="hero-section">
        <!-- Animated Background Shapes -->
        <div class="bg-shape" style="top: 10%; left: 5%; width: 150px; height: 150px; animation: morphShape 8s ease-in-out infinite, colorShift 12s linear infinite;"></div>
        <div class="bg-shape" style="top: 60%; right: 10%; width: 120px; height: 120px; animation: morphShape 6s ease-in-out infinite reverse, colorShift 10s linear infinite reverse;"></div>
        <div class="bg-shape" style="bottom: 20%; left: 15%; width: 100px; height: 100px; animation: morphShape 10s ease-in-out infinite, colorShift 8s linear infinite;"></div>
        
        <div class="container h-100 d-flex align-items-center">
            <div class="row w-100 align-items-center">
                <div class="col-lg-6">
                    <div class="white-card">
                        <div class="creative-badge">Creative Professional</div>
                        <h1 class="hero-name">${data.name}</h1>
                        <h2 class="hero-title">${data.title}</h2>
                        <p class="hero-description">${data.about || 'Creative professional passionate about innovative design and user experience.'}</p>
                        <div class="hero-buttons">
                            <a href="#portfolio" class="btn-primary">🎨 View Portfolio</a>
                            <a href="#contact" class="btn-secondary">💬 Let's Talk</a>
                        </div>
                        <div class="social-icons">
                            <a href="#" class="social-icon">🎨</a>
                            <a href="#" class="social-icon">🏀</a>
                            <a href="#" class="social-icon">💼</a>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6 text-center">
                    <div class="profile-container">
                        <div class="profile-floating"></div>
                        ${data.profileImage ? `<img src="${data.profileImage}" alt="${data.name}" class="profile-img">` : ''}
                        <div class="status-badge">✓</div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Skills Section -->
    ${data.skills && data.skills.length > 0 ? `
    <section class="py-5">
        <div class="container">
            <h2 class="section-title text-center">Creative Skills</h2>
            <div class="row">
                ${data.skills.map(skill => `
                    <div class="col-md-4 mb-4">
                        <div class="creative-card p-4 text-center h-100">
                            <h5 class="mb-3" style="color: #2c3e50; font-weight: 700;">${skill.name}</h5>
                            <div class="progress mb-3" style="height: 12px; border-radius: 10px; background: #f8f9fa;">
                                <div class="progress-bar" style="width: ${skill.level}%; background: linear-gradient(45deg, #ff6b6b, #4ecdc4); border-radius: 10px; transition: width 2s ease-in-out;"></div>
                            </div>
                            <span class="skill-orb">${skill.level}%</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- Projects Section -->
    ${data.projects && data.projects.length > 0 ? `
    <section class="py-5 bg-light">
        <div class="container">
            <h2 class="section-title text-center">Creative Projects</h2>
            <div class="row">
                ${data.projects.map(project => `
                    <div class="col-lg-6 mb-5">
                        <div class="project-showcase h-100">
                            ${project.image ? `<img src="${project.image}" class="card-img-top" style="height: 250px; object-fit: cover;" alt="${project.title}">` : ''}
                            <div class="card-body p-4">
                                <h5 class="card-title fw-bold" style="color: #2c3e50; font-size: 1.5rem;">${project.title}</h5>
                                <p class="card-text" style="color: #555; line-height: 1.6;">${project.description}</p>
                                ${project.tech && project.tech.length > 0 ? `
                                    <div class="mb-3">
                                        ${project.tech.map(tech => `<span class="skill-orb me-2 mb-2" style="font-size: 0.85rem; padding: 8px 16px;">${tech}</span>`).join('')}
                                    </div>
                                ` : ''}
                                <div class="d-flex gap-2">
                                    ${project.demo ? `<a href="${project.demo}" target="_blank" class="btn" style="background: linear-gradient(45deg, #ff6b6b, #4ecdc4); color: white; border: none; border-radius: 25px; padding: 10px 25px; font-weight: 600;">🚀 View Live</a>` : ''}
                                    ${project.github ? `<a href="${project.github}" target="_blank" class="btn btn-outline-secondary" style="border-radius: 25px; padding: 10px 25px; font-weight: 600;"><i class="fab fa-github"></i> Code</a>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- Experience Section -->
    ${data.experience && data.experience.length > 0 ? `
    <section class="py-5">
        <div class="container">
            <h2 class="section-title text-center">Experience</h2>
            ${data.experience.map(exp => `
                <div class="creative-card mb-4 p-4">
                    <div class="row">
                        <div class="col-md-8">
                            <h4 class="fw-bold">${exp.position}</h4>
                            <h5 class="text-primary">${exp.company}</h5>
                            <p class="text-muted">${exp.duration} • ${exp.location || ''}</p>
                            <p>${exp.description}</p>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </section>
    ` : ''}

    <!-- Internships Section -->
    ${data.internships && data.internships.length > 0 ? `
    <section class="py-5 bg-light">
        <div class="container">
            <h2 class="section-title text-center">Internships</h2>
            ${data.internships.map(internship => `
                <div class="creative-card mb-4 p-4">
                    <div class="row">
                        <div class="col-md-8">
                            <h4 class="fw-bold">${internship.position}</h4>
                            <h5 class="text-primary">${internship.company}</h5>
                            <p class="text-muted">${internship.duration} • ${internship.location || ''}</p>
                            <p>${internship.description}</p>
                            ${internship.achievements && internship.achievements.length > 0 ? `
                                <ul class="mt-3">
                                    ${internship.achievements.map(achievement => `<li>${achievement}</li>`).join('')}
                                </ul>
            </div>
        </div>
    </nav>

    <!-- Contact Section -->
    <section id="contact" class="gradient-bg text-center" style="padding: 60px 0; color: white;">
        <div class="container">
            <h3 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem;">Ready to Drive Results Together?</h3>
            <p style="font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9;">Let's discuss how I can help grow your business.</p>
            ${data.email ? `<a href="mailto:${data.email}" class="btn-marketing primary" style="font-size: 1.1rem; padding: 15px 40px;">
                <i class="fas fa-envelope me-2"></i>Start the Conversation
            </a>` : ''}
            <div style="margin-top: 3rem;">
                <p style="opacity: 0.8; margin: 0;">&copy; ${new Date().getFullYear()} ${data.name} - Marketing Portfolio</p>
                <small style="opacity: 0.6;">Powered by <a href="${getFrontendUrl()}" target="_blank" style="color: rgba(255,255,255,0.8);">Portfolio Generator</a></small>
            </div>
        </div>
    </section>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
    \`;
}

                      ` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </section>
    ` : ''}

    <!-- Education Section -->
    ${data.education && data.education.length > 0 ? `
    <section class="py-5">
        <div class="container">
            <h2 class="section-title text-center">Education</h2>
            ${data.education.map(edu => `
                <div class="creative-card mb-4 p-4">
                    <div class="row">
                        <div class="col-md-8">
                            <h4 class="fw-bold">${edu.degree}</h4>
                            <h5 class="text-primary">${edu.institution}</h5>
                            <p class="text-muted">${edu.duration} ${edu.gpa ? `• GPA: ${edu.gpa}` : ''}</p>
                            ${edu.description ? `<p>${edu.description}</p>` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </section>
    ` : ''}

    <!-- Footer -->
    <footer class="creative-header text-center py-4">
        <div class="container">
            <p class="mb-0">&copy; ${new Date().getFullYear()} ${data.name}. All rights reserved.</p>
            <small class="d-block mt-2">Powered by <a href="${getFrontendUrl()}" target="_blank" class="text-white">Portfolio Generator</a></small>
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
    `;
}

function generateTemplate3HTML(data, meta) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${meta?.title || data.name + ' - Business Portfolio'}</title>
    <meta name="description" content="${meta?.description || 'Business Portfolio of ' + data.name}">
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    
    <style>
        body { 
            font-family: 'Georgia', serif; 
            line-height: 1.6; 
            overflow-x: hidden;
        }
        
        /* ENHANCED BUSINESS PROFESSIONAL ANIMATIONS - MATCHING REACT TEMPLATE */
        @keyframes professionalSlide {
            0% { transform: translateX(-50px) rotateY(-15deg); opacity: 0; }
            100% { transform: translateX(0) rotateY(0deg); opacity: 1; }
        }
        
        @keyframes businessFloat {
            0%, 100% { transform: translateY(0px) rotateX(0deg); }
            50% { transform: translateY(-10px) rotateX(2deg); }
        }
        
        @keyframes dataVisualization {
            0% { transform: scaleY(0.3); }
            50% { transform: scaleY(1); }
            100% { transform: scaleY(0.8); }
        }
        
        @keyframes professionalGlow {
            0%, 100% { box-shadow: 0 5px 15px rgba(30,60,114,0.2); }
            50% { box-shadow: 0 10px 30px rgba(30,60,114,0.4); }
        }
        
        @keyframes progressGrow {
            0% { width: 0% !important; }
        }
        
        .business-header { 
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); 
            color: white; 
            padding: 80px 0;
            position: relative;
            overflow: hidden;
        }
        
        .business-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.05) 50%, transparent 70%);
            animation: shimmer 4s ease-in-out infinite;
        }
        
        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        .profile-img { 
            width: 160px; 
            height: 160px; 
            border-radius: 0 !important; 
            border: 4px solid white;
            transition: all 0.3s ease;
            animation: subtleFloat 4s ease-in-out infinite;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            object-fit: cover;
        }
        
        .profile-img:hover {
            transform: scale(1.1) rotateY(5deg);
            border-color: #ffd700;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            animation-play-state: paused;
        }
        
        .business-card { 
            border: 1px solid #e9ecef; 
            border-radius: 15px; 
            box-shadow: 0 5px 20px rgba(0,0,0,0.08);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transform-style: preserve-3d;
            animation: professionalGlow 3s ease-in-out infinite;
            position: relative;
            overflow: hidden;
        }
        
        .business-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, rgba(30, 60, 114, 0.02), rgba(42, 82, 152, 0.02));
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .business-card:hover::before {
            opacity: 1;
        }
        
        .business-card:hover { 
            transform: rotateY(8deg) rotateX(4deg) translateZ(15px) scale(1.02);
            box-shadow: 0 25px 50px rgba(30,60,114,0.3);
            border-color: #2a5298;
        }
        
        .section-title { 
            color: #1e3c72; 
            font-weight: 700; 
            border-bottom: 3px solid #2a5298; 
            padding-bottom: 10px;
            animation: professionalSlide 1s ease-out;
            position: relative;
        }
        
        .section-title::after {
            content: '';
            position: absolute;
            bottom: -3px;
            left: 0;
            width: 0;
            height: 3px;
            background: linear-gradient(90deg, #1e3c72, #2a5298);
            animation: progressGrow 2s ease-out forwards;
        }
        
        .achievement-item { 
            background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            border-left: 4px solid #2a5298; 
            padding: 20px; 
            margin-bottom: 15px;
            border-radius: 8px;
            transition: all 0.3s ease;
            animation: professionalSlide 1s ease-out;
            position: relative;
        }
        
        .achievement-item:hover {
            transform: translateX(10px);
            border-left-color: #1e3c72;
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }
        
        .achievement-item::before {
            content: '✓';
            position: absolute;
            left: -2px;
            top: 50%;
            transform: translateY(-50%);
            width: 20px;
            height: 20px;
            background: #2a5298;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }
        
        .btn {
            border-radius: 8px;
            padding: 12px 24px;
            font-weight: 600;
            transition: all 0.3s ease;
            transform-style: preserve-3d;
        }
        
        .btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
        }
        
        .progress {
            height: 10px;
            border-radius: 5px;
            background: #f8f9fa;
            overflow: hidden;
        }
        
        .progress-bar {
            background: linear-gradient(90deg, #1e3c72, #2a5298);
            transition: width 2s ease-in-out;
            animation: progressGrow 2s ease-out;
        }
        
        /* MOBILE OPTIMIZATIONS */
        @media (max-width: 768px) {
            .business-card:hover,
            .achievement-item:hover {
                transform: none !important;
            }
            
            .profile-img {
                animation: none !important;
            }
            
            .profile-img:hover {
                transform: scale(1.05) !important;
            }
            
            .business-card:hover {
                transform: translateY(-3px) !important;
            }
        }
        
        .fade-in-minimal {
            animation: professionalSlide 1s ease-out;
        }
    </style>
</head>
<body>
    <!-- Professional Navigation -->
    <nav style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: rgba(30, 60, 114, 0.95);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(255,255,255,0.1);
        z-index: 1000;
        padding: 1rem 0;
    ">
        <div class="container">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: white;
                ">
                    ${data.name}
                </div>
                <div style="display: flex; gap: 2rem; align-items: center;">
                    <a href="#about" style="color: rgba(255,255,255,0.9); text-decoration: none; font-weight: 500;">About</a>
                    <a href="#experience" style="color: rgba(255,255,255,0.9); text-decoration: none; font-weight: 500;">Experience</a>
                    <a href="#projects" style="color: rgba(255,255,255,0.9); text-decoration: none; font-weight: 500;">Projects</a>
                    <a href="#skills" style="color: rgba(255,255,255,0.9); text-decoration: none; font-weight: 500;">Expertise</a>
                    <a href="#contact" style="color: rgba(255,255,255,0.9); text-decoration: none; font-weight: 500;">Contact</a>
                    <button class="btn" style="
                        background: linear-gradient(135deg, #64b5f6, #42a5f5);
                        border: none;
                        border-radius: 6px;
                        padding: 8px 20px;
                        font-weight: 600;
                        color: white;
                    ">
                        Resume
                    </button>
                </div>
            </div>
        </div>
    </nav>

    <!-- Professional Hero Section -->
    <section style="
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
        color: white;
        min-height: 100vh;
        position: relative;
        padding-top: 100px;
    ">
        <!-- Professional Background Pattern -->
        <div style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%),
                linear-gradient(-45deg, rgba(255,255,255,0.03) 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.03) 75%),
                linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.03) 75%);
            background-size: 60px 60px;
            background-position: 0 0, 0 30px, 30px -30px, -30px 0px;
        "></div>
        
        <div class="container h-100 d-flex align-items-center position-relative">
            <div class="row w-100 align-items-center">
                <div class="col-lg-7">
                    <div style="
                        background: rgba(255,255,255,0.1);
                        padding: 4rem;
                        border-radius: 15px;
                        backdrop-filter: blur(20px);
                        border: 1px solid rgba(255,255,255,0.2);
                        animation: professionalSlide 1s ease-out;
                    ">
                        <div style="
                            display: inline-block;
                            background: rgba(100,181,246,0.2);
                            color: #64b5f6;
                            padding: 8px 20px;
                            border-radius: 6px;
                            font-size: 0.9rem;
                            font-weight: 600;
                            margin-bottom: 1.5rem;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            border: 1px solid rgba(100,181,246,0.3);
                        ">
                            Senior Business Consultant
                        </div>
                        <h1 style="
                            font-size: 4rem;
                            font-weight: 300;
                            margin-bottom: 1rem;
                            letter-spacing: -1px;
                            line-height: 1.1;
                        ">
                            ${data.name}
                        </h1>
                        <h2 style="
                            font-size: 1.6rem;
                            font-weight: 400;
                            margin-bottom: 2rem;
                            color: #64b5f6;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        ">
                            ${data.title}
                        </h2>
                        <p style="
                            font-size: 1.2rem;
                            line-height: 1.8;
                            margin-bottom: 3rem;
                            opacity: 0.9;
                            max-width: 600px;
                        ">
                            ${data.about || ''}
                        </p>
                        <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 2rem;">
                            <a href="#projects" class="btn" style="
                                background: transparent;
                                border: 2px solid #64b5f6;
                                color: #64b5f6;
                                padding: 12px 30px;
                                font-weight: 600;
                                text-transform: uppercase;
                                letter-spacing: 1px;
                                border-radius: 6px;
                                text-decoration: none;
                            ">
                                View Case Studies
                            </a>
                            <a href="#contact" class="btn" style="
                                background: #64b5f6;
                                border: 2px solid #64b5f6;
                                color: white;
                                padding: 12px 30px;
                                font-weight: 600;
                                text-transform: uppercase;
                                letter-spacing: 1px;
                                border-radius: 6px;
                                text-decoration: none;
                            ">
                                Schedule Consultation
                            </a>
                        </div>
                        <!-- Professional Links -->
                        <div style="display: flex; gap: 1.5rem;">
                            ${data.linkedin ? `<a href="${data.linkedin}" target="_blank" rel="noopener noreferrer" style="color: #64b5f6; font-size: 1.5rem; opacity: 0.8; text-decoration: none;">💼</a>` : ''}
                            ${data.website ? `<a href="${data.website}" target="_blank" rel="noopener noreferrer" style="color: #64b5f6; font-size: 1.5rem; opacity: 0.8; text-decoration: none;">🌐</a>` : ''}
                        </div>
                    </div>
                </div>
                <div class="col-lg-5 text-center">
                    <div style="
                        position: relative;
                        width: 350px;
                        height: 350px;
                        margin: 0 auto;
                    ">
                        <div style="
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            width: 300px;
                            height: 300px;
                            background: rgba(255,255,255,0.1);
                            border-radius: 15px;
                            animation: businessFloat 6s ease-in-out infinite;
                        "></div>
                        ${data.profileImage ? `
                        <img src="${data.profileImage}" alt="${data.name}" style="
                            position: relative;
                            width: 280px;
                            height: 280px;
                            border-radius: 15px;
                            object-fit: cover;
                            border: 4px solid rgba(255,255,255,0.2);
                            box-shadow: 0 25px 50px rgba(0,0,0,0.3);
                            z-index: 2;
                        ">
                        <div style="
                            position: absolute;
                            bottom: 20px;
                            right: 20px;
                            background: linear-gradient(135deg, #10b981, #34d399);
                            width: 50px;
                            height: 50px;
                            border-radius: 8px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 1.5rem;
                            border: 3px solid white;
                            animation: businessFloat 4s ease-in-out infinite reverse;
                            z-index: 3;
                        ">
                            ✓
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    </section>

    ${data.experience && data.experience.length > 0 ? `
    <section class="py-5">
        <div class="container">
            <h2 class="section-title mb-4">Professional Experience</h2>
            ${data.experience.map(exp => `
                <div class="business-card p-4 mb-4">
                    <div class="row">
                        <div class="col-md-9">
                            <h4 class="fw-bold text-primary">${exp.position}</h4>
                            <h5>${exp.company}</h5>
                            <p class="text-muted">${exp.duration} • ${exp.location || ''}</p>
                            <p>${exp.description}</p>
                            ${exp.achievements && exp.achievements.length > 0 ? `
                                <div class="mt-3">
                                    <h6>Key Achievements:</h6>
                                    ${exp.achievements.map(achievement => `
                                        <div class="achievement-item">${achievement}</div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </section>
    ` : ''}

    ${data.internships && data.internships.length > 0 ? `
    <section class="py-5 bg-light">
        <div class="container">
            <h2 class="section-title mb-4">Internship Experience</h2>
            ${data.internships.map(internship => `
                <div class="business-card p-4 mb-4">
                    <div class="row">
                        <div class="col-md-9">
                            <h4 class="fw-bold text-primary">${internship.position}</h4>
                            <h5>${internship.company}</h5>
                            <p class="text-muted">${internship.duration} • ${internship.location || ''}</p>
                            <p>${internship.description}</p>
                            ${internship.achievements && internship.achievements.length > 0 ? `
                                <div class="mt-3">
                                    <h6>Key Achievements:</h6>
                                    ${internship.achievements.map(achievement => `
                                        <div class="achievement-item">${achievement}</div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                        <div class="col-md-3 text-center">
                            <div style="
                                width: 80px;
                                height: 80px;
                                background: linear-gradient(135deg, #64b5f6, #42a5f5);
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin: 0 auto;
                                font-size: 2rem;
                                animation: businessFloat 6s ease-in-out infinite;
                            ">
                                🚀
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </section>
    ` : ''}

    ${data.education && data.education.length > 0 ? `
    <section class="py-5">
        <div class="container">
            <h2 class="section-title mb-4">Education</h2>
            ${data.education.map(edu => `
                <div class="business-card p-4 mb-4">
                    <div class="row">
                        <div class="col-md-9">
                            <h4 class="fw-bold text-primary">${edu.degree}</h4>
                            <h5>${edu.institution || edu.school}</h5>
                            <p class="text-muted">${edu.duration} ${edu.location ? `• ${edu.location}` : ''}</p>
                            ${edu.gpa ? `<p><strong>GPA:</strong> ${edu.gpa}</p>` : ''}
                            ${edu.description ? `<p>${edu.description}</p>` : ''}
                            ${edu.honors ? `<p><strong>Honors:</strong> ${edu.honors}</p>` : ''}
                            ${edu.relevant && edu.relevant.length > 0 ? `
                                <div class="mt-3">
                                    <h6>Relevant Coursework:</h6>
                                    <div class="d-flex flex-wrap gap-2">
                                        ${edu.relevant.map(course => `
                                            <span class="badge bg-secondary">${course}</span>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="col-md-3 text-center">
                            <div style="
                                width: 80px;
                                height: 80px;
                                background: linear-gradient(135deg, #10b981, #34d399);
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin: 0 auto;
                                font-size: 2rem;
                                animation: businessFloat 6s ease-in-out infinite;
                            ">
                                🎓
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </section>
    ` : ''}

    ${data.certifications && data.certifications.length > 0 ? `
    <section class="py-5 bg-light">
        <div class="container">
            <h2 class="section-title mb-4">Professional Certifications</h2>
            <div class="row">
                ${data.certifications.map(cert => `
                    <div class="col-md-6 col-lg-4 mb-4">
                        <div class="business-card p-4 h-100 text-center">
                            <div style="
                                width: 60px;
                                height: 60px;
                                background: linear-gradient(135deg, #64b5f6, #42a5f5);
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin: 0 auto 1rem auto;
                                font-size: 1.5rem;
                                animation: businessFloat 6s ease-in-out infinite;
                            ">
                                🏆
                            </div>
                            <h5 class="fw-bold">${cert.name}</h5>
                            <p class="text-muted">${cert.issuer}</p>
                            <p class="small">${cert.date}</p>
                            ${cert.validUntil ? `<p class="small text-success">Valid until: ${cert.validUntil}</p>` : ''}
                            ${cert.verifyLink ? `<a href="${cert.verifyLink}" target="_blank" class="btn btn-outline-primary btn-sm">Verify</a>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    ${data.projects && data.projects.length > 0 ? `
    <section class="py-5">
        <div class="container">
            <h2 class="section-title mb-4">Case Studies & Projects</h2>
            <div class="row">
                ${data.projects.map(project => `
                    <div class="col-md-6 col-lg-4 mb-4">
                        <div class="business-card p-4 h-100">
                            ${project.image ? `
                                <div style="
                                    width: 100%;
                                    height: 200px;
                                    background-image: url('${project.image}');
                                    background-size: cover;
                                    background-position: center;
                                    border-radius: 10px;
                                    margin-bottom: 1rem;
                                    position: relative;
                                    overflow: hidden;
                                ">
                                    <div style="
                                        position: absolute;
                                        top: 0;
                                        left: 0;
                                        right: 0;
                                        bottom: 0;
                                        background: linear-gradient(135deg, rgba(30,60,114,0.8), rgba(42,82,152,0.8));
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        opacity: 0;
                                        transition: opacity 0.3s ease;
                                    " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                                        <span style="color: white; font-size: 1.2rem; font-weight: 600;">View Project</span>
                                    </div>
                                </div>
                            ` : `
                                <div style="
                                    width: 100%;
                                    height: 200px;
                                    background: linear-gradient(135deg, #64b5f6, #42a5f5);
                                    border-radius: 10px;
                                    margin-bottom: 1rem;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 3rem;
                                    animation: businessFloat 6s ease-in-out infinite;
                                ">
                                    💼
                                </div>
                            `}
                            <h5 class="fw-bold">${project.title}</h5>
                            <p class="text-muted small">${project.description}</p>
                            ${project.tech && project.tech.length > 0 ? `
                                <div class="mb-3">
                                    ${project.tech.map(tech => `
                                        <span class="badge bg-primary me-1 mb-1">${tech}</span>
                                    `).join('')}
                                </div>
                            ` : ''}
                            <div class="d-flex gap-2">
                                ${project.liveUrl ? `<a href="${project.liveUrl}" target="_blank" class="btn btn-outline-primary btn-sm">Live Demo</a>` : ''}
                                ${project.githubUrl ? `<a href="${project.githubUrl}" target="_blank" class="btn btn-outline-secondary btn-sm">GitHub</a>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    ${data.skills && data.skills.length > 0 ? `
    <section class="py-5 bg-light">
        <div class="container">
            <h2 class="section-title mb-4">Core Competencies</h2>
            <div class="row">
                ${data.skills.map(skill => `
                    <div class="col-md-6 mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="fw-semibold">${skill.name}</span>
                            <span class="badge bg-primary">${skill.level}%</span>
                        </div>
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar bg-primary" style="width: ${skill.level}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <footer class="bg-dark text-white py-4">
        <div class="container text-center">
            <p class="mb-0">&copy; ${new Date().getFullYear()} ${data.name}. Professional Portfolio.</p>
            <small class="d-block mt-2">Powered by <a href="${getFrontendUrl()}" target="_blank" class="text-white">Portfolio Generator</a></small>
        </div>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
    `;
}

function generateTemplate4HTML(data, meta) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${meta?.title || data.name + ' - Minimal Portfolio'}</title>
    <meta name="description" content="${meta?.description || 'Minimal Portfolio of ' + data.name}">
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100;300;400;500;600&display=swap" rel="stylesheet">
    
    <style>
        /* OVERRIDE BOOTSTRAP ROUNDED CLASSES FIRST */
        .rounded, .rounded-circle, .img-thumbnail, .img-fluid {
            border-radius: 0 !important;
        }
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
            background-color: #ffffff;
            color: #1a1a1a;
            line-height: 1.6;
            overflow-x: hidden;
            margin: 0;
            padding: 0;
        }
        
        /* SIMPLE SQUARE IMAGE OVERRIDE */
        .profile-img,
        img.profile-img {
            border-radius: 0 !important;
            width: 300px !important;
            height: 300px !important;
            object-fit: cover !important;
        }
        
        /* EXACT PREVIEW MATCH - Hero Section */
        .minimal-hero {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #ffffff;
            padding: 50px 20px;
        }
        
        .hero-content {
            text-align: center;
            max-width: 800px;
        }
        
        /* Profile Image - Square/Rectangle like in preview - NO BORDER RADIUS */
        .profile-img, 
        img.profile-img,
        .hero-content .profile-img,
        .minimal-hero .profile-img { 
            width: 300px !important; 
            height: 300px !important; 
            object-fit: cover !important;
            border-radius: 0 !important;
            margin: 0 auto 40px auto !important;
            display: block !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1) !important;
            -webkit-border-radius: 0 !important;
            -moz-border-radius: 0 !important;
        }
        
        /* Name - Large, bold, exactly like preview */
        .hero-title {
            font-size: 3.5rem;
            font-weight: 400;
            margin-bottom: 20px;
            letter-spacing: -2px;
            color: #000000;
            line-height: 1;
        }
        
        /* Horizontal divider line - exactly like preview */
        .hero-divider {
            width: 60px;
            height: 1px;
            background: #000000;
            margin: 30px auto;
        }
        
        /* Subtitle - uppercase, spaced, exactly like preview */
        .hero-subtitle {
            font-size: 0.9rem;
            font-weight: 400;
            margin-bottom: 40px;
            color: #666666;
            text-transform: uppercase;
            letter-spacing: 4px;
        }
        
        /* About text - if present */
        .hero-description {
            font-size: 1rem;
            font-weight: 300;
            line-height: 1.6;
            margin-bottom: 40px;
            color: #666666;
            max-width: 500px;
            margin-left: auto;
            margin-right: auto;
        }
        
        /* Button - exactly like preview */
        .minimal-btn {
            background: transparent;
            border: 1px solid #000000;
            color: #000000;
            padding: 12px 30px;
            font-size: 0.8rem;
            font-weight: 400;
            text-transform: uppercase;
            letter-spacing: 2px;
            border-radius: 0;
            text-decoration: none;
            transition: all 0.3s ease;
            display: inline-block;
        }
        
        .minimal-btn:hover {
            background: #000000;
            color: #ffffff;
        }
        
        /* Section Styles */
        .minimal-section { 
            padding: 80px 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        
        .section-title { 
            font-size: 2rem;
            font-weight: 300;
            margin-bottom: 20px;
            color: #000000;
            text-align: center;
        }
        
        .section-divider {
            width: 40px;
            height: 1px;
            background: #000000;
            margin: 20px auto 60px auto;
        }
        
        /* Education Section */
        .education-item {
            margin-bottom: 40px;
            padding-bottom: 40px;
            border-bottom: 1px solid #e5e5e5;
        }
        
        .education-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .education-degree {
            font-size: 1.3rem;
            font-weight: 400;
            color: #000000;
            margin-bottom: 8px;
        }
        
        .education-school {
            font-size: 1rem;
            color: #666666;
            margin-bottom: 8px;
        }
        
        .education-meta {
            font-size: 0.85rem;
            color: #999999;
            margin-bottom: 15px;
        }
        
        .education-field {
            font-size: 0.9rem;
            color: #666666;
            margin-bottom: 10px;
        }
        
        .education-description {
            font-size: 0.9rem;
            color: #666666;
            line-height: 1.6;
        }
        
        /* Experience Section */
        .experience-item {
            margin-bottom: 40px;
            padding-bottom: 40px;
            border-bottom: 1px solid #e5e5e5;
        }
        
        .experience-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .experience-position {
            font-size: 1.3rem;
            font-weight: 400;
            margin-bottom: 8px;
            color: #000000;
        }
        
        .experience-company {
            font-size: 1rem;
            font-weight: 400;
            margin-bottom: 8px;
            color: #666666;
        }
        
        .experience-duration {
            font-size: 0.85rem;
            color: #999999;
            margin-bottom: 15px;
        }
        
        .experience-description {
            font-size: 0.9rem;
            font-weight: 300;
            line-height: 1.6;
            color: #666666;
        }
        
        /* Projects Section */
        .project-item {
            margin-bottom: 50px;
            padding-bottom: 50px;
            border-bottom: 1px solid #e5e5e5;
        }
        
        .project-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .project-title {
            font-size: 1.3rem;
            font-weight: 400;
            margin-bottom: 15px;
            color: #000000;
        }
        
        .project-description {
            font-size: 0.95rem;
            font-weight: 300;
            line-height: 1.6;
            color: #666666;
            margin-bottom: 20px;
        }
        
        .project-tech {
            margin-bottom: 20px;
        }
        
        .project-tech-label {
            font-size: 0.8rem;
            color: #999999;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
        }
        
        .project-tech-list {
            font-size: 0.9rem;
            color: #666666;
        }
        
        .project-links {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
        }
        
        .project-link {
            color: #000000;
            text-decoration: none;
            font-size: 0.8rem;
            font-weight: 400;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1px solid #000000;
            padding-bottom: 2px;
            transition: opacity 0.3s ease;
        }
        
        .project-link:hover {
            opacity: 0.6;
            color: #000000;
        }
        
        /* Skills Section */
        .skill-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .skill-name {
            font-size: 0.95rem;
            font-weight: 400;
            color: #000000;
        }
        
        .skill-level {
            font-size: 0.85rem;
            color: #666666;
            font-weight: 300;
        }
        
        /* Certifications Section */
        .cert-item {
            background: #fafafa;
            padding: 30px;
            border: 1px solid #e5e5e5;
            margin-bottom: 20px;
            transition: all 0.3s ease;
        }
        
        .cert-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        
        .cert-name {
            color: #000000;
            font-weight: 400;
            margin-bottom: 8px;
            font-size: 1.1rem;
        }
        
        .cert-issuer {
            font-size: 0.9rem;
            color: #666666;
            margin-bottom: 15px;
        }
        
        .cert-date {
            font-size: 0.85rem;
            color: #999999;
            margin-bottom: 15px;
        }
        
        .cert-verify {
            margin-top: 15px;
        }
        
        /* Achievements Section */
        .achievements {
            margin-top: 15px;
        }
        
        .achievement-item {
            font-size: 0.9rem;
            color: #666666;
            margin-bottom: 5px;
            line-height: 1.5;
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
            .profile-img,
            img.profile-img,
            .hero-content .profile-img,
            .minimal-hero .profile-img {
                width: 250px !important;
                height: 250px !important;
                border-radius: 0 !important;
                -webkit-border-radius: 0 !important;
                -moz-border-radius: 0 !important;
            }
            
            .hero-title {
                font-size: 2.5rem;
            }
            
            .hero-subtitle {
                font-size: 0.8rem;
                letter-spacing: 3px;
            }
            
            .section-title {
                font-size: 1.5rem;
            }
            
            .minimal-section {
                padding: 60px 20px;
            }
        }
    </style>
</head>
<body>
    <!-- Minimal Navigation -->
    <nav style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: rgba(255,255,255,0.95);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid #e5e5e5;
        z-index: 1000;
        padding: 1.5rem 0;
    ">
        <div style="
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <div style="
                font-size: 1.5rem;
                font-weight: 300;
                color: #000000;
                letter-spacing: -0.5px;
            ">
                ${data.name}
            </div>
            <div style="display: flex; gap: 3rem; align-items: center;">
                <a href="#about" style="
                    color: #666666;
                    text-decoration: none;
                    font-weight: 400;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                ">About</a>
                <a href="#work" style="
                    color: #666666;
                    text-decoration: none;
                    font-weight: 400;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                ">Work</a>
                <a href="#experience" style="
                    color: #666666;
                    text-decoration: none;
                    font-weight: 400;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                ">Experience</a>
                <a href="#contact" style="
                    color: #666666;
                    text-decoration: none;
                    font-weight: 400;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                ">Contact</a>
            </div>
        </div>
    </nav>

    <!-- Hero Section - Exact Preview Match -->
    <section style="
        min-height: 100vh;
        display: flex;
        align-items: center;
        background: #ffffff;
        padding-top: 100px;
    ">
        <div style="
            max-width: 1200px;
            width: 100%;
            margin: 0 auto;
            padding: 0 20px;
        ">
            <div style="
                text-align: center;
                max-width: 800px;
                margin: 0 auto;
            ">
                <!-- Profile Image - Square with Checkmark -->
                <div style="
                    width: 300px;
                    height: 300px;
                    margin: 0 auto 3rem auto;
                    position: relative;
                ">
                    ${data.profileImage ? `
                    <img src="${data.profileImage}" alt="${data.name}" class="profile-img" style="
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        border-radius: 0;
                        filter: grayscale(20%);
                        transition: filter 0.3s ease;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    ">
                    ` : ''}
                    <div style="
                        position: absolute;
                        bottom: -10px;
                        right: -10px;
                        width: 30px;
                        height: 30px;
                        background: #000000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 0.8rem;
                    ">
                        ✓
                    </div>
                </div>

                <!-- Name -->
                <h1 style="
                    font-size: 4rem;
                    font-weight: 100;
                    margin-bottom: 1rem;
                    letter-spacing: -3px;
                    color: #000000;
                    line-height: 0.9;
                ">${data.name || 'Your Name'}</h1>
                
                <!-- Divider Line -->
                <div style="
                    width: 80px;
                    height: 1px;
                    background: #000000;
                    margin: 2rem auto;
                "></div>
                
                <!-- Title -->
                <h2 style="
                    font-size: 1rem;
                    font-weight: 300;
                    margin-bottom: 3rem;
                    color: #666666;
                    text-transform: uppercase;
                    letter-spacing: 3px;
                ">${data.title || data.tagline || 'YOUR TITLE'}</h2>
                
                <!-- About Text -->
                ${data.about ? `
                <p style="
                    font-size: 1.1rem;
                    font-weight: 300;
                    line-height: 1.8;
                    margin-bottom: 3rem;
                    color: #666666;
                    max-width: 600px;
                    margin: 0 auto 3rem auto;
                ">${data.about}</p>
                ` : ''}
                
                <!-- Contact Information -->
                <div style="
                    display: flex;
                    justify-content: center;
                    gap: 3rem;
                    margin-bottom: 3rem;
                    flex-wrap: wrap;
                ">
                    ${data.email ? `
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        font-size: 0.9rem;
                        color: #666666;
                    ">
                        <span>📧</span>
                        <a href="mailto:${data.email}" style="
                            color: #666666;
                            text-decoration: none;
                        ">${data.email}</a>
                    </div>
                    ` : ''}
                    ${data.phone ? `
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        font-size: 0.9rem;
                        color: #666666;
                    ">
                        <span>📞</span>
                        <a href="tel:${data.phone}" style="
                            color: #666666;
                            text-decoration: none;
                        ">${data.phone}</a>
                    </div>
                    ` : ''}
                    ${data.location ? `
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        font-size: 0.9rem;
                        color: #666666;
                    ">
                        <span>📍</span>
                        <span>${data.location}</span>
                    </div>
                    ` : ''}
                </div>
                
                <!-- Social Links -->
                ${(data.linkedin || data.github || data.website || data.twitter) ? `
                <div style="
                    display: flex;
                    justify-content: center;
                    gap: 2rem;
                    margin-bottom: 3rem;
                ">
                    ${data.linkedin ? `
                    <a href="${data.linkedin}" target="_blank" style="
                        color: #666666;
                        text-decoration: none;
                        font-size: 0.8rem;
                        font-weight: 400;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        border-bottom: 1px solid transparent;
                        padding-bottom: 2px;
                        transition: all 0.3s ease;
                    ">LinkedIn</a>
                    ` : ''}
                    ${data.github ? `
                    <a href="${data.github}" target="_blank" style="
                        color: #666666;
                        text-decoration: none;
                        font-size: 0.8rem;
                        font-weight: 400;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        border-bottom: 1px solid transparent;
                        padding-bottom: 2px;
                        transition: all 0.3s ease;
                    ">GitHub</a>
                    ` : ''}
                    ${data.website ? `
                    <a href="${data.website}" target="_blank" style="
                        color: #666666;
                        text-decoration: none;
                        font-size: 0.8rem;
                        font-weight: 400;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        border-bottom: 1px solid transparent;
                        padding-bottom: 2px;
                        transition: all 0.3s ease;
                    ">Website</a>
                    ` : ''}
                    ${data.twitter ? `
                    <a href="${data.twitter}" target="_blank" style="
                        color: #666666;
                        text-decoration: none;
                        font-size: 0.8rem;
                        font-weight: 400;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        border-bottom: 1px solid transparent;
                        padding-bottom: 2px;
                        transition: all 0.3s ease;
                    ">Twitter</a>
                    ` : ''}
                </div>
                ` : ''}
                
                <!-- Button -->
                <button onclick="document.getElementById('work').scrollIntoView({behavior: 'smooth'})" style="
                    background: transparent;
                    border: 1px solid #000000;
                    color: #000000;
                    padding: 15px 40px;
                    font-size: 0.8rem;
                    font-weight: 400;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    border-radius: 0;
                    margin-bottom: 3rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                ">VIEW SELECTED WORK</button>
                
                <!-- Philosophy Quote -->
                ${data.philosophy ? `
                <div style="
                    border-top: 1px solid #e5e5e5;
                    padding-top: 3rem;
                    margin-top: 3rem;
                ">
                    <blockquote style="
                        font-size: 1rem;
                        font-style: italic;
                        color: #999999;
                        font-weight: 300;
                        line-height: 1.6;
                        max-width: 500px;
                        margin: 0 auto;
                    ">${data.philosophy}</blockquote>
                </div>
                ` : ''}
            </div>
        </div>
    </section>

    <!-- Skills Section -->
    ${data.skills && data.skills.length > 0 ? `
    <section style="
        padding: 120px 0;
        background-color: #fafafa;
    ">
        <div style="
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            text-align: center;
        ">
            <h2 style="
                font-size: 2.5rem;
                font-weight: 400;
                color: #000000;
                margin-bottom: 2rem;
                letter-spacing: -1px;
            ">Skills</h2>
            <div style="
                width: 60px;
                height: 1px;
                background: #000000;
                margin: 2rem auto 4rem auto;
            "></div>
            
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 2rem;
                text-align: left;
            ">
                ${data.skills.map(skill => `
                <div style="
                    background: white;
                    padding: 2rem;
                    border: 1px solid #f0f0f0;
                    transition: all 0.3s ease;
                ">
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 1rem;
                    ">
                        <h5 style="
                            font-size: 1.1rem;
                            font-weight: 500;
                            color: #000000;
                            margin: 0;
                        ">${typeof skill === 'object' ? skill.name : skill}</h5>
                        <span style="
                            font-size: 0.9rem;
                            font-weight: 300;
                            color: #666666;
                        ">${typeof skill === 'object' ? skill.level + '%' : '85%'}</span>
                    </div>
                    <div style="
                        width: 100%;
                        height: 2px;
                        background: #f0f0f0;
                        overflow: hidden;
                    ">
                        <div style="
                            width: ${typeof skill === 'object' ? skill.level : 85}%;
                            height: 100%;
                            background: #000000;
                            transition: width 2s ease-in-out;
                        "></div>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- Experience Section -->
    ${data.experience && data.experience.length > 0 ? `
    <section style="
        padding: 120px 0;
        background-color: white;
    ">
        <div style="
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        ">
            <h2 style="
                font-size: 2.5rem;
                font-weight: 400;
                color: #000000;
                margin-bottom: 2rem;
                letter-spacing: -1px;
                text-align: center;
            ">Experience</h2>
            <div style="
                width: 60px;
                height: 1px;
                background: #000000;
                margin: 2rem auto 4rem auto;
            "></div>
            
            ${data.experience.map(exp => `
            <div style="
                margin-bottom: 4rem;
                padding: 3rem;
                border: 1px solid #f0f0f0;
                background: #fafafa;
                transition: all 0.3s ease;
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 2rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                ">
                    <div>
                        <h3 style="
                            font-size: 1.5rem;
                            font-weight: 600;
                            color: #000000;
                            margin-bottom: 0.5rem;
                        ">${exp.position || exp.role || 'Position'}</h3>
                        <h4 style="
                            font-size: 1.2rem;
                            font-weight: 300;
                            color: #666666;
                            margin-bottom: 0.5rem;
                        ">${exp.company || exp.organization || 'Company'}</h4>
                        ${exp.location ? `
                        <p style="
                            font-size: 0.9rem;
                            color: #999999;
                            margin: 0;
                        ">${exp.location}</p>
                        ` : ''}
                    </div>
                    <div style="
                        text-align: right;
                        font-size: 0.9rem;
                        color: #666666;
                        font-weight: 300;
                    ">
                        ${exp.duration || ''}
                    </div>
                </div>
                
                ${exp.description ? `
                <p style="
                    font-size: 1rem;
                    font-weight: 300;
                    line-height: 1.6;
                    color: #555555;
                    margin-bottom: 2rem;
                ">${exp.description}</p>
                ` : ''}
                
                ${exp.achievements && exp.achievements.length > 0 ? `
                <div>
                    <h6 style="
                        font-size: 0.9rem;
                        font-weight: 500;
                        color: #000000;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 1rem;
                    ">Key Achievements</h6>
                    <div style="
                        display: grid;
                        gap: 0.5rem;
                    ">
                        ${exp.achievements.map(achievement => `
                        <div style="
                            font-size: 0.95rem;
                            color: #666666;
                            padding-left: 1rem;
                            position: relative;
                        ">
                            <span style="
                                position: absolute;
                                left: 0;
                                top: 0.2rem;
                                width: 4px;
                                height: 4px;
                                background: #000000;
                                border-radius: 50%;
                            "></span>
                            ${achievement}
                        </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
            `).join('')}
        </div>
    </section>
    ` : ''}

    <!-- Projects Section -->
    ${data.projects && data.projects.length > 0 ? `
    <section id="work" style="
        padding: 120px 0;
        background-color: white;
    ">
        <div style="
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            text-align: center;
        ">
            <h2 style="
                font-size: 2.5rem;
                font-weight: 400;
                color: #000000;
                margin-bottom: 2rem;
                letter-spacing: -1px;
            ">
                Selected Work
            </h2>
            <div style="
                width: 60px;
                height: 1px;
                background: #000000;
                margin: 2rem auto 4rem auto;
            "></div>
            
            <!-- Project Grid -->
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                gap: 3rem;
                margin-top: 4rem;
            ">
                ${data.projects.map(project => `
                <div style="
                    text-align: left;
                    background: #fafafa;
                    padding: 0;
                    border: 1px solid #f0f0f0;
                    transition: all 0.3s ease;
                    overflow: hidden;
                ">
                    ${project.image ? `
                    <div style="
                        width: 100%;
                        height: 250px;
                        background-image: url('${project.image}');
                        background-size: cover;
                        background-position: center;
                        margin-bottom: 2rem;
                    "></div>
                    ` : ''}
                    
                    <div style="padding: 2rem;">
                        <h3 style="
                            font-size: 1.3rem;
                            font-weight: 600;
                            color: #000000;
                            margin-bottom: 1rem;
                        ">${project.title || project.name || 'Project'}</h3>
                        
                        <p style="
                            font-size: 1rem;
                            font-weight: 300;
                            line-height: 1.6;
                            color: #666666;
                            margin-bottom: 1.5rem;
                        ">${project.description || ''}</p>
                        
                        ${project.tech && project.tech.length > 0 ? `
                        <div style="
                            display: flex;
                            flex-wrap: wrap;
                            gap: 0.5rem;
                            margin-bottom: 1.5rem;
                        ">
                            ${project.tech.map(tech => `
                            <span style="
                                font-size: 0.8rem;
                                font-weight: 300;
                                color: #888888;
                                background: #f8f8f8;
                                padding: 0.3rem 0.8rem;
                                border-radius: 0;
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                            ">${tech}</span>
                            `).join('')}
                        </div>
                        ` : ''}
                        
                        <div style="
                            display: flex;
                            gap: 1rem;
                        ">
                            ${project.demo || project.liveLink ? `
                            <a href="${project.demo || project.liveLink}" target="_blank" style="
                                color: #000000;
                                text-decoration: none;
                                font-size: 0.8rem;
                                font-weight: 400;
                                text-transform: uppercase;
                                letter-spacing: 1px;
                                border-bottom: 1px solid #000000;
                                padding-bottom: 2px;
                                transition: all 0.3s ease;
                            ">View Live</a>
                            ` : ''}
                            
                            ${project.github || project.source ? `
                            <a href="${project.github || project.source}" target="_blank" style="
                                color: #666666;
                                text-decoration: none;
                                font-size: 0.8rem;
                                font-weight: 400;
                                text-transform: uppercase;
                                letter-spacing: 1px;
                                border-bottom: 1px solid #666666;
                                padding-bottom: 2px;
                                transition: all 0.3s ease;
                            ">View Code</a>
                            ` : ''}
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- Education Section -->
    ${data.education && data.education.length > 0 ? `
    <section style="
        padding: 120px 0;
        background-color: #fafafa;
    ">
        <div style="
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        ">
            <h2 style="
                font-size: 2.5rem;
                font-weight: 400;
                color: #000000;
                margin-bottom: 2rem;
                letter-spacing: -1px;
                text-align: center;
            ">Education</h2>
            <div style="
                width: 60px;
                height: 1px;
                background: #000000;
                margin: 2rem auto 4rem auto;
            "></div>
            
            ${data.education.map(edu => `
            <div style="
                margin-bottom: 3rem;
                padding: 3rem;
                background: white;
                border: 1px solid #f0f0f0;
                transition: all 0.3s ease;
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                ">
                    <div>
                        <h3 style="
                            font-size: 1.4rem;
                            font-weight: 600;
                            color: #000000;
                            margin-bottom: 0.5rem;
                        ">${edu.degree || edu.institution || 'Education'}</h3>
                        <h4 style="
                            font-size: 1.1rem;
                            font-weight: 300;
                            color: #666666;
                            margin-bottom: 0.5rem;
                        ">${edu.school || edu.institution || ''}</h4>
                        ${edu.location ? `
                        <p style="
                            font-size: 0.9rem;
                            color: #999999;
                            margin: 0;
                        ">${edu.location}</p>
                        ` : ''}
                    </div>
                    <div style="
                        text-align: right;
                        font-size: 0.9rem;
                        color: #666666;
                        font-weight: 300;
                    ">
                        ${edu.duration || ''}
                    </div>
                </div>
                
                ${edu.fieldOfStudy ? `
                <p style="
                    font-size: 0.9rem;
                    color: #888888;
                    margin-bottom: 1rem;
                    font-weight: 300;
                ">Field of Study: ${edu.fieldOfStudy}</p>
                ` : ''}
                
                ${edu.gpa ? `
                <p style="
                    font-size: 0.9rem;
                    color: #888888;
                    margin-bottom: 1rem;
                    font-weight: 300;
                ">GPA: ${edu.gpa}</p>
                ` : ''}
                
                ${edu.description ? `
                <p style="
                    font-size: 1rem;
                    font-weight: 300;
                    line-height: 1.6;
                    color: #555555;
                    margin: 0;
                ">${edu.description}</p>
                ` : ''}
            </div>
            `).join('')}
        </div>
    </section>
    ` : ''}



    <!-- Projects Section -->
    ${data.projects && data.projects.length > 0 ? `
    <section id="work" style="
        padding: 120px 0;
        background-color: white;
    ">
        <div style="
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            text-align: center;
        ">
            <h2 style="
                font-size: 2.5rem;
                font-weight: 400;
                color: #000000;
                margin-bottom: 2rem;
                letter-spacing: -1px;
            ">
                Selected Work
            </h2>
            <div style="
                width: 60px;
                height: 1px;
                background: #000000;
                margin: 2rem auto 4rem auto;
            "></div>
            
            <!-- Project Grid -->
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                gap: 3rem;
                margin-top: 4rem;
            ">
                ${data.projects.map(project => `
                <div style="
                    text-align: left;
                    border: 1px solid #f0f0f0;
                    transition: all 0.3s ease;
                    padding: 0;
                    background: white;
                ">
                    ${project.image ? `
                    <div style="
                        width: 100%;
                        height: 250px;
                        overflow: hidden;
                        background: #f8f8f8;
                    ">
                        <img src="${project.image}" alt="${project.title}" style="
                            width: 100%;
                            height: 100%;
                            object-fit: cover;
                            transition: transform 0.3s ease;
                        ">
                    </div>
                    ` : ''}
                    <div style="padding: 2rem;">
                        <h3 style="
                            font-size: 1.3rem;
                            font-weight: 600;
                            color: #000000;
                            margin-bottom: 1rem;
                            letter-spacing: -0.5px;
                        ">${project.title}</h3>
                        <p style="
                            font-size: 0.95rem;
                            font-weight: 300;
                            color: #666666;
                            line-height: 1.6;
                            margin-bottom: 1.5rem;
                        ">${project.description}</p>
                        ${project.technologies ? `
                        <div style="
                            margin-bottom: 1.5rem;
                        ">
                            <div style="
                                display: flex;
                                flex-wrap: wrap;
                                gap: 0.5rem;
                            ">
                                ${Array.isArray(project.technologies) ? project.technologies.map(tech => `
                                <span style="
                                    font-size: 0.75rem;
                                    color: #666666;
                                    background: #f8f8f8;
                                    padding: 0.3rem 0.8rem;
                                    border-radius: 2px;
                                    font-weight: 400;
                                    text-transform: uppercase;
                                    letter-spacing: 0.5px;
                                ">${tech}</span>
                                `).join('') : `<span style="color: #666666; font-size: 0.9rem;">${project.technologies}</span>`}
                            </div>
                        </div>
                        ` : ''}
                        <div style="display: flex; gap: 1rem;">
                            ${project.liveLink || project.demo ? `
                            <a href="${project.liveLink || project.demo}" target="_blank" style="
                                color: #000000;
                                text-decoration: none;
                                font-size: 0.8rem;
                                font-weight: 400;
                                text-transform: uppercase;
                                letter-spacing: 1px;
                                border-bottom: 1px solid #000000;
                                padding-bottom: 2px;
                                transition: all 0.3s ease;
                            ">Live Demo</a>
                            ` : ''}
                            ${project.github ? `
                            <a href="${project.github}" target="_blank" style="
                                color: #000000;
                                text-decoration: none;
                                font-size: 0.8rem;
                                font-weight: 400;
                                text-transform: uppercase;
                                letter-spacing: 1px;
                                border-bottom: 1px solid #000000;
                                padding-bottom: 2px;
                                transition: all 0.3s ease;
                            ">GitHub</a>
                            ` : ''}
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}



    <!-- Internships Section -->
    ${(data.internships && Array.isArray(data.internships) && data.internships.length > 0) || (data.internship && Array.isArray(data.internship) && data.internship.length > 0) ? `
    <section style="
        padding: 120px 0;
        background-color: white;
    ">
        <div style="
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        ">
            <h2 style="
                font-size: 2.5rem;
                font-weight: 400;
                color: #000000;
                margin-bottom: 2rem;
                letter-spacing: -1px;
                text-align: center;
            ">Internships</h2>
            <div style="
                width: 60px;
                height: 1px;
                background: #000000;
                margin: 2rem auto 4rem auto;
            "></div>
            
            ${(data.internships || data.internship).map(internship => `
            <div style="
                margin-bottom: 4rem;
                padding: 3rem;
                border: 1px solid #f0f0f0;
                background: #fafafa;
                transition: all 0.3s ease;
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 2rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                ">
                    <div>
                        <h3 style="
                            font-size: 1.5rem;
                            font-weight: 600;
                            color: #000000;
                            margin-bottom: 0.5rem;
                        ">${internship.position || internship.role || 'Position'}</h3>
                        <h4 style="
                            font-size: 1.2rem;
                            font-weight: 300;
                            color: #666666;
                            margin-bottom: 0.5rem;
                        ">${internship.company || internship.organization || 'Company'}</h4>
                        ${internship.location ? `
                        <p style="
                            font-size: 0.9rem;
                            color: #999999;
                            margin: 0;
                        ">${internship.location}</p>
                        ` : ''}
                    </div>
                    <div style="
                        text-align: right;
                        font-size: 0.9rem;
                        color: #666666;
                        font-weight: 300;
                    ">
                        ${internship.duration || ''}
                    </div>
                </div>
                
                ${internship.description ? `
                <p style="
                    font-size: 1rem;
                    font-weight: 300;
                    line-height: 1.6;
                    color: #555555;
                    margin-bottom: 2rem;
                ">${internship.description}</p>
                ` : ''}
                
                ${internship.achievements && internship.achievements.length > 0 ? `
                <div>
                    <h6 style="
                        font-size: 0.9rem;
                        font-weight: 500;
                        color: #000000;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 1rem;
                    ">Key Achievements</h6>
                    <div style="
                        display: grid;
                        gap: 0.5rem;
                    ">
                        ${internship.achievements.map(achievement => `
                        <div style="
                            font-size: 0.95rem;
                            color: #666666;
                            padding-left: 1rem;
                            position: relative;
                        ">
                            <span style="
                                position: absolute;
                                left: 0;
                                top: 0.2rem;
                                width: 4px;
                                height: 4px;
                                background: #000000;
                                border-radius: 50%;
                            "></span>
                            ${achievement}
                        </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
            `).join('')}
        </div>
    </section>
    ` : ''}

    <!-- Certifications Section -->
    ${data.certifications && data.certifications.length > 0 ? `
    <section style="
        padding: 120px 0;
        background-color: #fafafa;
    ">
        <div style="
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            text-align: center;
        ">
            <h2 style="
                font-size: 2.5rem;
                font-weight: 400;
                color: #000000;
                margin-bottom: 2rem;
                letter-spacing: -1px;
            ">Certifications</h2>
            <div style="
                width: 60px;
                height: 1px;
                background: #000000;
                margin: 2rem auto 4rem auto;
            "></div>
            
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                gap: 2rem;
                text-align: left;
            ">
                ${data.certifications.map(cert => `
                <div style="
                    background: white;
                    padding: 2.5rem;
                    border: 1px solid #f0f0f0;
                    transition: all 0.3s ease;
                    text-align: center;
                ">
                    <div style="
                        width: 60px;
                        height: 60px;
                        background: #f8f8f8;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 1.5rem auto;
                        font-size: 1.5rem;
                    ">🏆</div>
                    
                    <h4 style="
                        font-size: 1.2rem;
                        font-weight: 600;
                        color: #000000;
                        margin-bottom: 0.5rem;
                    ">${cert.name || cert.title || 'Certification'}</h4>
                    
                    <p style="
                        font-size: 1rem;
                        font-weight: 300;
                        color: #666666;
                        margin-bottom: 1rem;
                    ">${cert.issuer || cert.organization || 'Issuer'}</p>
                    
                    ${cert.dateObtained || cert.date ? `
                    <p style="
                        font-size: 0.9rem;
                        color: #888888;
                        margin-bottom: 1.5rem;
                        font-weight: 300;
                    ">Obtained: ${cert.dateObtained || cert.date}</p>
                    ` : ''}
                    
                    ${cert.verificationUrl || cert.verifyLink ? `
                    <a href="${cert.verificationUrl || cert.verifyLink}" target="_blank" style="
                        color: #000000;
                        text-decoration: none;
                        font-size: 0.8rem;
                        font-weight: 400;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        border-bottom: 1px solid #000000;
                        padding-bottom: 2px;
                        transition: all 0.3s ease;
                    ">Verify Certificate</a>
                    ` : ''}
                </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- Contact Section -->
    <section id="contact" style="
        padding: 120px 0;
        background-color: #000000;
        color: white;
        text-align: center;
    ">
        <div style="max-width: 800px; margin: 0 auto; padding: 0 20px;">
            <h2 style="
                font-size: 2.5rem;
                font-weight: 100;
                margin-bottom: 2rem;
                letter-spacing: -1px;
            ">
                Let's Work Together
            </h2>
            <div style="
                width: 40px;
                height: 1px;
                background: white;
                margin: 2rem auto 4rem auto;
            "></div>
            <div style="
                display: flex;
                justify-content: center;
                gap: 3rem;
                flex-wrap: wrap;
                margin-bottom: 3rem;
            ">
                ${data.email ? `
                <div>
                    <div style="
                        font-size: 0.8rem;
                        color: #999999;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 0.5rem;
                    ">Email</div>
                    <a href="mailto:${data.email}" style="
                        color: white;
                        text-decoration: none;
                        font-weight: 300;
                    ">${data.email}</a>
                </div>
                ` : ''}
                ${data.phone ? `
                <div>
                    <div style="
                        font-size: 0.8rem;
                        color: #999999;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 0.5rem;
                    ">Phone</div>
                    <a href="tel:${data.phone}" style="
                        color: white;
                        text-decoration: none;
                        font-weight: 300;
                    ">${data.phone}</a>
                </div>
                ` : ''}
                ${data.location ? `
                <div>
                    <div style="
                        font-size: 0.8rem;
                        color: #999999;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 0.5rem;
                    ">Location</div>
                    <div style="color: white; font-weight: 300;">${data.location}</div>
                </div>
                ` : ''}
            </div>
            <div style="
                display: flex;
                justify-content: center;
                gap: 2rem;
                margin-top: 3rem;
            ">
                ${data.linkedin ? `
                <a href="${data.linkedin}" target="_blank" style="
                    color: #666666;
                    text-decoration: none;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    transition: color 0.3s ease;
                ">LinkedIn</a>
                ` : ''}
                ${data.behance ? `
                <a href="${data.behance}" target="_blank" style="
                    color: #666666;
                    text-decoration: none;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    transition: color 0.3s ease;
                ">Behance</a>
                ` : ''}
                ${data.website ? `
                <a href="${data.website}" target="_blank" style="
                    color: #666666;
                    text-decoration: none;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    transition: color 0.3s ease;
                ">Website</a>
                ` : ''}
            </div>
        </div>
    </section>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    </script>
    
    <!-- ENSURE SQUARE PROFILE IMAGE -->
    <style>
        .profile-img {
            border-radius: 0 !important;
        }
    </style>
</body>
</html>
    `;
}

function generateTemplate5HTML(data, meta) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${meta?.title || data.name + ' - Developer Portfolio'}</title>
    <meta name="description" content="${meta?.description || 'Developer Portfolio of ' + data.name}">
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600&display=swap" rel="stylesheet">
    
    <style>
        body { 
            font-family: 'Fira Code', Monaco, monospace; 
            background-color: #0d1117;
            color: #c9d1d9;
            min-height: 100vh;
            overflow-x: hidden;
        }
        
        /* TERMINAL ANIMATIONS */
        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }
        
        @keyframes slideInTerminal {
            0% { transform: translateY(20px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes glow {
            0%, 100% { box-shadow: 0 0 5px rgba(88, 166, 255, 0.3); }
            50% { box-shadow: 0 0 20px rgba(88, 166, 255, 0.6); }
        }
        
        .terminal-cursor::after {
            content: '|';
            animation: blink 1s infinite;
            color: #58a6ff;
        }
        
        .terminal-card {
            animation: slideInTerminal 0.8s ease-out;
        }
        
        /* NAVBAR */
        .navbar {
            background-color: #161b22 !important;
            border-bottom: 1px solid #30363d;
            padding: 1rem 0;
            position: fixed;
            top: 0;
            width: 100%;
            z-index: 1000;
        }
        
        .navbar-brand {
            color: #58a6ff !important;
            font-family: 'Fira Code', monospace;
            font-size: 1.2rem;
        }
        
        .nav-link {
            color: #7d8590 !important;
            font-family: 'Fira Code', monospace;
            font-size: 0.9rem;
            margin: 0 0.5rem;
            transition: color 0.3s ease;
        }
        
        .nav-link:hover {
            color: #58a6ff !important;
        }
        
        /* HERO SECTION */
        .hero-section {
            min-height: 100vh;
            background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
            position: relative;
            overflow: hidden;
            padding-top: 100px;
        }
        
        .hero-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(33, 38, 45, 0.3) 2px,
                rgba(33, 38, 45, 0.3) 4px
            );
            opacity: 0.5;
        }
        
        .terminal-window {
            background: #21262d;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 2rem;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            position: relative;
            z-index: 2;
        }
        
        .terminal-header {
            display: flex;
            align-items: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #30363d;
        }
        
        .terminal-dots {
            display: flex;
            gap: 8px;
            margin-right: 1rem;
        }
        
        .terminal-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        
        .terminal-dot:nth-child(1) { background: #ff5f56; }
        .terminal-dot:nth-child(2) { background: #ffbd2e; }
        .terminal-dot:nth-child(3) { background: #27ca3f; }
        
        .terminal-title {
            color: #7d8590;
            font-size: 0.9rem;
        }
        
        .code-syntax {
            font-family: 'Fira Code', monospace;
        }
        
        .syntax-keyword { color: #f85149; }
        .syntax-variable { color: #79c0ff; }
        .syntax-operator { color: #ff7b72; }
        .syntax-string { color: #a5d6ff; }
        .syntax-comment { color: #7d8590; }
        .syntax-bracket { color: #a5d6ff; }
        
        .profile-img { 
            width: 200px; 
            height: 200px; 
            border-radius: 50%; 
            border: 3px solid #58a6ff;
            object-fit: cover;
            transition: all 0.3s ease;
        }
        
        .profile-img:hover {
            border-color: #79c0ff;
            transform: scale(1.05);
        }
        
        .hero-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            margin-top: 2rem;
        }
        
        .btn-terminal {
            background: #238636;
            border: 1px solid #2ea043;
            color: white;
            padding: 10px 20px;
            font-size: 0.9rem;
            font-family: 'Fira Code', monospace;
            transition: all 0.3s ease;
            text-decoration: none;
        }
        
        .btn-terminal:hover {
            background: #2ea043;
            color: white;
            text-decoration: none;
        }
        
        .btn-terminal.secondary {
            background: #1f6feb;
            border: 1px solid #1f6feb;
        }
        
        .btn-terminal.secondary:hover {
            background: #388bfd;
        }
        
        .btn-terminal.outline {
            background: transparent;
            border: 1px solid #30363d;
            color: #c9d1d9;
        }
        
        .btn-terminal.outline:hover {
            background: #30363d;
            color: #c9d1d9;
        }
        
        /* SECTIONS */
        .section {
            padding: 80px 0;
        }
        
        .section-title {
            font-size: 2rem;
            color: #f0f6fc;
            margin-bottom: 1rem;
            font-family: 'Fira Code', monospace;
            text-align: center;
        }
        
        .section-subtitle {
            color: #7d8590;
            font-family: 'Fira Code', monospace;
            text-align: center;
            margin-bottom: 3rem;
        }
        
        .card-terminal {
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
            color: #c9d1d9;
            transition: all 0.3s ease;
            height: 100%;
        }
        
        .card-terminal:hover {
            border-color: #58a6ff;
            transform: translateY(-5px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        
        .card-body {
            padding: 2rem;
        }
        
        .badge-terminal {
            background: #1f6feb;
            color: white;
            font-family: 'Fira Code', monospace;
            font-size: 0.7rem;
            padding: 6px 10px;
            margin: 0.25rem;
            border-radius: 4px;
            display: inline-block;
        }
        
        .badge-terminal.success {
            background: #238636;
        }
        
        .badge-terminal.purple {
            background: #7c3aed;
        }
        
        .progress-terminal {
            background: #21262d;
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            margin: 0.5rem 0;
        }
        
        .progress-bar-terminal {
            background: linear-gradient(90deg, #58a6ff, #79c0ff);
            height: 100%;
            border-radius: 4px;
            transition: width 2s ease-in-out;
        }
        
        .text-terminal-primary {
            color: #58a6ff;
        }
        
        .text-terminal-secondary {
            color: #7d8590;
        }
        
        .social-links {
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin: 2rem 0;
        }
        
        .social-link {
            color: #7d8590;
            font-size: 1.5rem;
            transition: color 0.3s ease;
            text-decoration: none;
        }
        
        .social-link:hover {
            color: #58a6ff;
            text-decoration: none;
        }
        
        .contact-info {
            display: flex;
            justify-content: center;
            gap: 2rem;
            margin: 2rem 0;
            flex-wrap: wrap;
        }
        
        .contact-item {
            text-align: center;
        }
        
        .contact-icon {
            color: #58a6ff;
            font-size: 2rem;
            margin-bottom: 0.5rem;
            display: block;
        }
        
        /* RESPONSIVE */
        @media (max-width: 768px) {
            .hero-buttons {
                flex-direction: column;
            }
            
            .btn-terminal {
                width: 100%;
                text-align: center;
            }
            
            .contact-info {
                flex-direction: column;
                gap: 1rem;
            }
            
            .profile-img {
                width: 150px;
                height: 150px;
            }
            
            .section-title {
                font-size: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg">
        <div class="container">
            <a class="navbar-brand" href="#about">
                ${data.name ? data.name.split(' ')[0].toLowerCase() : 'developer'}@portfolio:~$
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" style="border: 1px solid #30363d;">
                <span style="color: #58a6ff;">☰</span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item"><a class="nav-link" href="#about">./about</a></li>
                    <li class="nav-item"><a class="nav-link" href="#experience">./experience</a></li>
                    <li class="nav-item"><a class="nav-link" href="#education">./education</a></li>
                    <li class="nav-item"><a class="nav-link" href="#skills">./skills</a></li>
                    <li class="nav-item"><a class="nav-link" href="#projects">./projects</a></li>
                    <li class="nav-item"><a class="nav-link" href="#contact">./contact</a></li>
                </ul>
            </div>
        </div>
    </nav>

    <!-- Contact Section -->
    <section id="contact" class="gradient-bg text-center" style="padding: 60px 0; color: white;">
        <div class="container">
            <h3 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem;">Ready to Drive Results Together?</h3>
            <p style="font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9;">Let's discuss how I can help grow your business.</p>
            ${data.email ? `<a href="mailto:${data.email}" class="btn-marketing primary" style="font-size: 1.1rem; padding: 15px 40px;">
                <i class="fas fa-envelope me-2"></i>Start the Conversation
            </a>` : ''}
            <div style="margin-top: 3rem;">
                <p style="opacity: 0.8; margin: 0;">&copy; ${new Date().getFullYear()} ${data.name} - Marketing Portfolio</p>
                <small style="opacity: 0.6;">Powered by <a href="${getFrontendUrl()}" target="_blank" style="color: rgba(255,255,255,0.8);">Portfolio Generator</a></small>
            </div>
        </div>
    </section>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
    \`;
}

      </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section id="about" class="hero-section">
        <div class="container h-100 d-flex align-items-center position-relative">
            <div class="row w-100 align-items-center">
                <div class="col-lg-8">
                    <div class="terminal-window">
                        <div class="terminal-header">
                            <div class="terminal-dots">
                                <div class="terminal-dot"></div>
                                <div class="terminal-dot"></div>
                                <div class="terminal-dot"></div>
                            </div>
                            <span class="terminal-title">~/portfolio/developer.js</span>
                        </div>
                        
                        <div class="code-syntax">
                            <div style="margin-bottom: 0.5rem;">
                                <span class="syntax-keyword">const</span>
                                <span class="syntax-variable"> developer</span>
                                <span class="syntax-operator"> =</span>
                                <span class="syntax-bracket"> {</span>
                            </div>
                            <div style="margin-left: 2rem; margin-bottom: 0.5rem;">
                                <span class="syntax-variable">name</span><span class="syntax-operator">:</span>
                                <span class="syntax-string"> "${data.name}"</span><span class="syntax-comment">,</span>
                            </div>
                            <div style="margin-left: 2rem; margin-bottom: 0.5rem;">
                                <span class="syntax-variable">role</span><span class="syntax-operator">:</span>
                                <span class="syntax-string"> "${data.title}"</span><span class="syntax-comment">,</span>
                            </div>
                            <div style="margin-left: 2rem; margin-bottom: 0.5rem;">
                                <span class="syntax-variable">location</span><span class="syntax-operator">:</span>
                                <span class="syntax-string"> "${data.location || 'Remote'}"</span><span class="syntax-comment">,</span>
                            </div>
                            <div style="margin-left: 2rem; margin-bottom: 0.5rem;">
                                <span class="syntax-variable">passion</span><span class="syntax-operator">:</span>
                                <span class="syntax-string"> "Building scalable software solutions"</span><span class="syntax-comment">,</span>
                            </div>
                            <div style="margin-left: 2rem; margin-bottom: 1rem;">
                                <span class="syntax-variable">contact</span><span class="syntax-operator">:</span>
                                <span class="syntax-string"> () => console.log("Let's connect!")</span>
                            </div>
                            <div><span class="syntax-bracket">}</span></div>
                            
                            <div style="margin-top: 2rem;">
                                <span class="terminal-cursor syntax-comment">console.log('Hello, World! I build amazing software.');</span>
                            </div>
                        </div>
                        
                        <div class="hero-buttons">
                            <a href="#projects" class="btn-terminal">
                                ./view-projects.sh
                            </a>
                            <button class="btn-terminal secondary" onclick="window.open('mailto:${data.email}')">
                                cat resume.pdf
                            </button>
                            <a href="#contact" class="btn-terminal outline">
                                git contact
                            </a>
                        </div>
                    </div>
                </div>
                <div class="col-lg-4 text-center">
                    ${data.profileImage ? `
                        <div style="background: #21262d; border: 1px solid #30363d; border-radius: 50%; padding: 2rem; display: inline-block; margin-bottom: 2rem;">
                            <img src="${data.profileImage}" alt="${data.name}" class="profile-img">
                        </div>
                    ` : ''}
                    
                    <div class="social-links">
                        ${data.github ? `<a href="${data.github}" target="_blank" class="social-link"><i class="fab fa-github"></i></a>` : ''}
                        ${data.linkedin ? `<a href="${data.linkedin}" target="_blank" class="social-link"><i class="fab fa-linkedin"></i></a>` : ''}
                        ${data.website ? `<a href="${data.website}" target="_blank" class="social-link"><i class="fas fa-globe"></i></a>` : ''}
                    </div>
                    
                    <p style="color: #7d8590; font-family: 'Fira Code', monospace; font-size: 0.9rem;">
                        ${data.about ? data.about.substring(0, 100) + '...' : 'Software Developer passionate about creating innovative solutions.'}
                    </p>
                </div>
            </div>
        </div>
    </section>

    <!-- Experience Section -->
    ${data.experience && data.experience.length > 0 ? `
    <section id="experience" class="section" style="background-color: #161b22; border-top: 1px solid #30363d;">
        <div class="container">
            <h2 class="section-title">
                <span class="syntax-comment">//</span> Work Experience
            </h2>
            <p class="section-subtitle">My professional journey in software development</p>
            
            <div class="row">
                ${data.experience.map((exp, index) => `
                    <div class="col-12 mb-4">
                        <div class="card-terminal">
                            <div class="card-body">
                                <div class="row align-items-start">
                                    <div class="col-md-8">
                                        <h4 class="text-terminal-primary mb-2">${exp.position}</h4>
                                        <h5 class="text-light mb-2">${exp.company}</h5>
                                        <p class="text-terminal-secondary mb-3" style="font-size: 0.9rem;">
                                            ${exp.duration} | ${exp.location || ''}
                                        </p>
                                        <p class="mb-3">${exp.description}</p>
                                        ${exp.achievements ? `
                                            <h6 class="text-light mb-2">Key Achievements:</h6>
                                            <ul class="text-terminal-secondary">
                                                ${exp.achievements.map(achievement => `<li>${achievement}</li>`).join('')}
                                            </ul>
            </div>
        </div>
    </nav>

    <!-- Contact Section -->
    <section id="contact" class="gradient-bg text-center" style="padding: 60px 0; color: white;">
        <div class="container">
            <h3 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem;">Ready to Drive Results Together?</h3>
            <p style="font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9;">Let's discuss how I can help grow your business.</p>
            ${data.email ? `<a href="mailto:${data.email}" class="btn-marketing primary" style="font-size: 1.1rem; padding: 15px 40px;">
                <i class="fas fa-envelope me-2"></i>Start the Conversation
            </a>` : ''}
            <div style="margin-top: 3rem;">
                <p style="opacity: 0.8; margin: 0;">&copy; ${new Date().getFullYear()} ${data.name} - Marketing Portfolio</p>
                <small style="opacity: 0.6;">Powered by <a href="${getFrontendUrl()}" target="_blank" style="color: rgba(255,255,255,0.8);">Portfolio Generator</a></small>
            </div>
        </div>
    </section>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
    \`;
}

                                  ` : ''}
                                    </div>
                                    <div class="col-md-4 text-end">
                                        <span class="badge-terminal ${index === 0 ? 'success' : 'badge-terminal'}">
                                            ${index === 0 ? 'Current' : 'Previous'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- Education Section -->
    ${data.education && data.education.length > 0 ? `
    <section id="education" class="section" style="background-color: #161b22;">
        <div class="container">
            <h2 class="section-title">cat education.json</h2>
            <div style="width: 80px; height: 2px; background: #58a6ff; margin: 0 auto 3rem auto; border-radius: 1px;"></div>
            
            <div class="row">
                ${data.education.map((edu) => `
                    <div class="col-md-6 mb-4">
                        <div class="card-terminal">
                            <div class="card-body">
                                <h4 class="text-terminal-primary mb-2">${edu.degree || edu.title}</h4>
                                <h5 class="text-light mb-2">${edu.institution || edu.school}</h5>
                                <div class="text-terminal-secondary mb-3" style="font-size: 0.9rem;">
                                    ${edu.location || ''} | ${edu.duration}
                                </div>
                                ${edu.gpa ? `
                                    <div class="mb-3" style="color: #57ab5a; font-size: 0.9rem;">
                                        GPA: ${edu.gpa}
                                    </div>
                                ` : ''}
                                <div class="text-end">
                                    <span class="badge-terminal success">Graduated</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- Skills Section -->
    ${data.skills && data.skills.length > 0 ? `
    <section id="skills" class="section" style="background-color: #0d1117;">
        <div class="container">
            <h2 class="section-title">
                <span class="syntax-comment">//</span> Technical Skills
            </h2>
            <p class="section-subtitle">Technologies and tools I work with</p>
            
            <div class="row">
                ${data.skills.map((skill) => {
                    const skillLevel = typeof skill === 'object' ? skill.level : 85;
                    const skillName = typeof skill === 'object' ? skill.name : skill;
                    const skillCategory = typeof skill === 'object' ? skill.category : 'Technology';
                    
                    return `
                    <div class="col-md-6 col-lg-4 mb-4">
                        <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1.5rem; transition: all 0.3s ease; cursor: pointer;" 
                             onmouseover="this.style.borderColor='#58a6ff'; this.style.transform='translateY(-5px)';"
                             onmouseout="this.style.borderColor='#30363d'; this.style.transform='translateY(0)';">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 style="color: #f0f6fc; font-family: 'Fira Code', monospace; margin: 0;">
                                    ${skillName}
                                </h5>
                                <span class="badge-terminal">${skillCategory}</span>
                            </div>
                            <div class="progress-terminal">
                                <div class="progress-bar-terminal" style="width: ${skillLevel}%;"></div>
                            </div>
                            <div class="text-end mt-2 text-terminal-secondary" style="font-size: 0.8rem;">
                                ${skillLevel}%
                            </div>
                        </div>
                    </div>
                `;
                }).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- Projects Section -->
    ${data.projects && data.projects.length > 0 ? `
    <section id="projects" class="section" style="background-color: #161b22; border-top: 1px solid #30363d;">
        <div class="container">
            <h2 class="section-title">
                <span class="syntax-comment">//</span> Featured Projects
            </h2>
            <p class="section-subtitle">Some of my recent work and contributions</p>
            
            <div class="row">
                ${data.projects.map((project) => `
                    <div class="col-lg-6 mb-4">
                        <div class="card-terminal">
                            ${project.image ? `
                                <div style="position: relative;">
                                    <img src="${project.image}" alt="${project.title}" 
                                         style="width: 100%; height: 200px; object-fit: cover; border-top-left-radius: 8px; border-top-right-radius: 8px;">
                                    <span class="badge-terminal success" style="position: absolute; top: 10px; right: 10px;">
                                        Live
                                    </span>
                                </div>
                            ` : ''}
                            
                            <div class="card-body">
                                <h4 class="text-terminal-primary mb-3">${project.title}</h4>
                                <p class="mb-3">${project.description}</p>
                                
                                ${project.tech && project.tech.length > 0 ? `
                                    <div class="mb-3">
                                        ${(Array.isArray(project.tech) ? project.tech : project.tech.split(',').map(t => t.trim())).map(tech => 
                                            `<span class="badge-terminal">${tech}</span>`
                                        ).join('')}
                                    </div>
                                ` : ''}
                                
                                <div class="d-flex gap-2 flex-wrap">
                                    ${project.demo || project.liveLink ? `
                                        <a href="${project.demo || project.liveLink}" target="_blank" class="btn-terminal" style="flex: 1; text-align: center;">
                                            <i class="fas fa-external-link-alt me-2"></i>Live Demo
                                        </a>
                                    ` : ''}
                                    ${project.github || project.githubLink ? `
                                        <a href="${project.github || project.githubLink}" target="_blank" class="btn-terminal outline" style="flex: 1; text-align: center;">
                                            <i class="fab fa-github me-2"></i>Code
                                        </a>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- Contact Section -->
    <section id="contact" class="section" style="background-color: #161b22; border-top: 1px solid #30363d;">
        <div class="container">
            <div class="row justify-content-center">
                <div class="col-lg-8">
                    <div style="background: #21262d; border: 1px solid #30363d; border-radius: 8px; padding: 2rem;">
                        <div class="terminal-header">
                            <div class="terminal-dots">
                                <div class="terminal-dot"></div>
                                <div class="terminal-dot"></div>
                                <div class="terminal-dot"></div>
                            </div>
                            <span class="terminal-title">~/contact/connect.sh</span>
                        </div>
                        
                        <div class="text-center">
                            <h2 class="text-terminal-primary mb-3" style="font-size: 2rem;">Let's Connect!</h2>
                            <p class="mb-4" style="font-size: 1.1rem;">
                                Ready to collaborate on your next project? Let's build something amazing together.
                            </p>
                            
                            <div class="contact-info">
                                ${data.email ? `
                                    <div class="contact-item">
                                        <i class="fas fa-envelope contact-icon"></i>
                                        <a href="mailto:${data.email}" style="color: #c9d1d9; text-decoration: none; font-family: 'Fira Code', monospace;">
                                            ${data.email}
                                        </a>
                                    </div>
                                ` : ''}
                                ${data.phone ? `
                                    <div class="contact-item">
                                        <i class="fas fa-phone contact-icon"></i>
                                        <a href="tel:${data.phone}" style="color: #c9d1d9; text-decoration: none; font-family: 'Fira Code', monospace;">
                                            ${data.phone}
                                        </a>
                                    </div>
                                ` : ''}
                                <div class="contact-item">
                                    <i class="fas fa-map-marker-alt contact-icon"></i>
                                    <span style="color: #c9d1d9; font-family: 'Fira Code', monospace;">
                                        ${data.location || 'Remote'}
                                    </span>
                                </div>
                            </div>
                            
                            <div class="d-flex justify-content-center gap-3 flex-wrap">
                                ${data.email ? `
                                    <a href="mailto:${data.email}" class="btn-terminal">
                                        <i class="fas fa-envelope me-2"></i>Send Email
                                    </a>
                                ` : ''}
                                <button class="btn-terminal secondary" onclick="window.print()">
                                    <i class="fas fa-download me-2"></i>Download Resume
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
    `;
}

function generateTemplate6HTML(data, meta) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${meta?.title || data.name + ' - Marketing Portfolio'}</title>
    <meta name="description" content="${meta?.description || 'Marketing Portfolio of ' + data.name}">
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <style>
        body { 
            font-family: 'Poppins', sans-serif;
            background-color: #f8f9fa;
            color: #333;
            min-height: 100vh;
            overflow-x: hidden;
        }
        
        /* MARKETING ANIMATIONS */
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.1); opacity: 1; }
        }
        
        @keyframes slideInUp {
            0% { transform: translateY(50px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
        @keyframes countUp {
            0% { opacity: 0; transform: scale(0.5); }
            100% { opacity: 1; transform: scale(1); }
        }
        
        .float-animation {
            animation: float 6s ease-in-out infinite;
        }
        
        .pulse-animation {
            animation: pulse 4s ease-in-out infinite;
        }
        
        .slide-up {
            animation: slideInUp 0.8s ease-out;
        }
        
        .gradient-bg {
            background: linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #f5576c);
            background-size: 400% 400%;
            animation: gradient 15s ease infinite;
        }
        
        /* NAVBAR */
        .navbar {
            background-color: rgba(255,255,255,0.95) !important;
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(0,0,0,0.1);
            padding: 1rem 0;
            position: fixed;
            top: 0;
            width: 100%;
            z-index: 1000;
        }
        
        .navbar-brand {
            color: #667eea !important;
            font-weight: bold;
            font-size: 1.5rem;
        }
        
        .nav-link {
            color: #666 !important;
            font-weight: 500;
            margin: 0 0.5rem;
            text-transform: capitalize;
            transition: color 0.3s ease;
        }
        
        .nav-link:hover {
            color: #667eea !important;
        }
        
        /* HERO SECTION */
        .hero-section {
            min-height: 100vh;
            position: relative;
            overflow: hidden;
            padding-top: 100px;
        }
        
        .floating-element {
            position: absolute;
            border-radius: 50%;
            z-index: 1;
        }
        
        .floating-1 {
            top: 20%;
            left: 10%;
            width: 100px;
            height: 100px;
            background: rgba(255,255,255,0.2);
            animation: pulse 4s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.1); opacity: 1; }
        }
    </style>
</head>
<body>
    <h1>Template6 - Modern Portfolio</h1>
    <p>This template is under development.</p>
</body>
</html>
    `;
}