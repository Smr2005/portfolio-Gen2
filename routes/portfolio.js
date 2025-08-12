const router = require("express").Router();
const mongoose = require("mongoose");
const Portfolio = require("../model/Portfolio");
const User = require("../model/User");
const { verifyAccessToken } = require("../webToken/jwt");
const nodemailer = require("nodemailer");

// Helper function to generate correct base URL
function getBaseUrl(req) {
  return process.env.BACKEND_URL || 
         (process.env.NODE_ENV === 'production' || process.env.PORT 
           ? 'https://portfolio-gen2.onrender.com' 
           : `${req.protocol}://${req.get('host')}`);
}

// Helper function to ensure data URLs are properly formatted (files are now stored as base64 data URLs)
function ensureDataUrls(data) {
  // Files are now stored as data URLs (data:image/jpeg;base64,xxx), no conversion needed
  // This function is kept for backward compatibility with any existing URL-based data
  const productionUrl = process.env.BACKEND_URL || 'https://portfolio-gen2.onrender.com';
  const localhostPattern = /http:\/\/localhost:\d+/g;
  
  let dataString = JSON.stringify(data);
  dataString = dataString.replace(localhostPattern, productionUrl);
  
  return JSON.parse(dataString);
}

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Send publication success email
async function sendPublicationEmail(user, portfolio, publishedUrl) {
  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Portfolio Published Successfully!</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background: white;
                border-radius: 10px;
                padding: 30px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .success-icon {
                font-size: 48px;
                color: #28a745;
                margin-bottom: 20px;
            }
            .title {
                color: #2c3e50;
                font-size: 28px;
                margin-bottom: 10px;
                font-weight: bold;
            }
            .subtitle {
                color: #6c757d;
                font-size: 16px;
                margin-bottom: 30px;
            }
            .portfolio-info {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                border-left: 4px solid #007bff;
            }
            .portfolio-name {
                font-size: 20px;
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 5px;
            }
            .portfolio-title {
                color: #6c757d;
                font-size: 16px;
                margin-bottom: 15px;
            }
            .url-section {
                background: #e3f2fd;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
            }
            .url-label {
                font-size: 14px;
                color: #666;
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .published-url {
                font-size: 18px;
                font-weight: bold;
                color: #007bff;
                text-decoration: none;
                word-break: break-all;
                display: inline-block;
                margin-bottom: 15px;
            }
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #007bff, #0056b3);
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 25px;
                font-weight: bold;
                margin: 10px;
                transition: transform 0.2s;
            }
            .cta-button:hover {
                transform: translateY(-2px);
                color: white;
                text-decoration: none;
            }
            .share-section {
                margin: 30px 0;
                text-align: center;
            }
            .share-title {
                font-size: 18px;
                color: #2c3e50;
                margin-bottom: 15px;
            }
            .share-buttons {
                display: flex;
                justify-content: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .share-btn {
                display: inline-block;
                padding: 8px 16px;
                border-radius: 20px;
                text-decoration: none;
                color: white;
                font-size: 14px;
                font-weight: bold;
            }
            .linkedin { background: #0077b5; }
            .twitter { background: #1da1f2; }
            .facebook { background: #4267b2; }
            .whatsapp { background: #25d366; }
            .features {
                margin: 30px 0;
            }
            .feature-list {
                list-style: none;
                padding: 0;
            }
            .feature-item {
                padding: 8px 0;
                border-bottom: 1px solid #eee;
            }
            .feature-item:last-child {
                border-bottom: none;
            }
            .feature-icon {
                color: #28a745;
                margin-right: 10px;
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                text-align: center;
                color: #6c757d;
                font-size: 14px;
            }
            .stats {
                display: flex;
                justify-content: space-around;
                margin: 20px 0;
                text-align: center;
            }
            .stat-item {
                flex: 1;
            }
            .stat-number {
                font-size: 24px;
                font-weight: bold;
                color: #007bff;
            }
            .stat-label {
                font-size: 12px;
                color: #6c757d;
                text-transform: uppercase;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="success-icon">🎉</div>
                <h1 class="title">Portfolio Published Successfully!</h1>
                <p class="subtitle">Congratulations! Your professional portfolio is now live and ready to impress.</p>
            </div>

            <div class="portfolio-info">
                <div class="portfolio-name">${portfolio.data.name}</div>
                <div class="portfolio-title">${portfolio.data.title}</div>
                <div class="stats">
                    <div class="stat-item">
                        <div class="stat-number">${portfolio.data.skills?.length || 0}</div>
                        <div class="stat-label">Skills</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${portfolio.data.projects?.length || 0}</div>
                        <div class="stat-label">Projects</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${portfolio.data.experience?.length || 0}</div>
                        <div class="stat-label">Experience</div>
                    </div>
                </div>
            </div>

            <div class="url-section">
                <div class="url-label">Your Portfolio is Live At:</div>
                <a href="${publishedUrl}" class="published-url" target="_blank">${publishedUrl}</a>
                <br>
                <a href="${publishedUrl}" class="cta-button" target="_blank">🚀 View Your Portfolio</a>
            </div>

            <div class="share-section">
                <h3 class="share-title">Share Your Portfolio</h3>
                <div class="share-buttons">
                    <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publishedUrl)}" 
                       class="share-btn linkedin" target="_blank">LinkedIn</a>
                    <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(publishedUrl)}&text=Check out my professional portfolio!" 
                       class="share-btn twitter" target="_blank">Twitter</a>
                    <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publishedUrl)}" 
                       class="share-btn facebook" target="_blank">Facebook</a>
                    <a href="https://wa.me/?text=Check out my professional portfolio: ${encodeURIComponent(publishedUrl)}" 
                       class="share-btn whatsapp" target="_blank">WhatsApp</a>
                </div>
            </div>

            <div class="features">
                <h3 style="color: #2c3e50; margin-bottom: 15px;">What's Included in Your Portfolio:</h3>
                <ul class="feature-list">
                    <li class="feature-item">
                        <span class="feature-icon">✅</span>
                        <strong>Professional Profile</strong> - Complete with your photo and contact information
                    </li>
                    <li class="feature-item">
                        <span class="feature-icon">✅</span>
                        <strong>Skills Showcase</strong> - ${portfolio.data.skills?.length || 0} skills with proficiency levels
                    </li>
                    <li class="feature-item">
                        <span class="feature-icon">✅</span>
                        <strong>Project Portfolio</strong> - ${portfolio.data.projects?.length || 0} projects with live demos and GitHub links
                    </li>
                    <li class="feature-item">
                        <span class="feature-icon">✅</span>
                        <strong>Work Experience</strong> - Detailed professional background
                    </li>
                    <li class="feature-item">
                        <span class="feature-icon">✅</span>
                        <strong>Education & Certifications</strong> - Academic and professional credentials
                    </li>
                    <li class="feature-item">
                        <span class="feature-icon">✅</span>
                        <strong>Downloadable Resume</strong> - PDF resume for easy sharing
                    </li>
                    <li class="feature-item">
                        <span class="feature-icon">✅</span>
                        <strong>Mobile Responsive</strong> - Looks great on all devices
                    </li>
                    <li class="feature-item">
                        <span class="feature-icon">✅</span>
                        <strong>SEO Optimized</strong> - Discoverable by search engines
                    </li>
                </ul>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h4 style="color: #856404; margin-bottom: 10px;">💡 Pro Tips for Maximum Impact:</h4>
                <ul style="color: #856404; margin: 0; padding-left: 20px;">
                    <li>Share your portfolio URL on LinkedIn, Twitter, and other professional networks</li>
                    <li>Include the link in your email signature and business cards</li>
                    <li>Add it to your resume and job applications</li>
                    <li>Update your portfolio regularly with new projects and achievements</li>
                    <li>Monitor your portfolio analytics to see who's viewing your work</li>
                </ul>
            </div>

            <div class="footer">
                <p><strong>Need to make changes?</strong> Log back into your account to edit and republish your portfolio anytime.</p>
                <p>Published on ${new Date(portfolio.publishedAt).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</p>
                <p style="margin-top: 20px; font-size: 12px;">
                    This email was sent because you published your portfolio on Portfolio Generator.<br>
                    Keep building amazing things! 🚀
                </p>
            </div>
        </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@portfoliogenerator.com',
    to: user.email,
    subject: `🎉 Your Portfolio is Live! - ${portfolio.data.name}`,
    html: emailHtml
  };

  await transporter.sendMail(mailOptions);
}

// Save/Update portfolio (requires authentication)
router.post("/save", verifyAccessToken, async (req, res) => {
  try {
    console.log("=== SAVE PORTFOLIO REQUEST ===");
    console.log("User ID:", req.payload.aud);
    console.log("Template ID:", req.body.templateId);
    
    const { templateId, data, slug } = req.body;
    
    if (!templateId || !data) {
      return res.status(422).json({ error: "Template ID and data are required" });
    }
    
    // Validate required fields
    if (!data.name || !data.title || !data.email) {
      return res.status(422).json({ error: "Name, title, and email are required" });
    }
    
    // Check if user already has a portfolio
    let portfolio = await Portfolio.findOne({ userId: req.payload.aud });
    
    if (portfolio) {
      // Update existing portfolio
      portfolio.templateId = templateId;
      portfolio.data = data;
      if (slug && slug !== portfolio.slug) {
        // Check if new slug is available
        const existingSlug = await Portfolio.findOne({ slug: slug, _id: { $ne: portfolio._id } });
        if (existingSlug) {
          return res.status(422).json({ error: "This URL is already taken. Please choose a different one." });
        }
        portfolio.slug = slug;
      }
      
      // Generate meta data
      portfolio.meta = {
        title: `${data.name} - ${data.title}`,
        description: data.about || `Portfolio of ${data.name}, ${data.title}`,
        keywords: [data.name, data.title, ...(data.skills?.map(s => s.name) || [])]
      };
      
      await portfolio.save();
      console.log("Portfolio updated for user:", req.payload.aud);
    } else {
      // Create new portfolio
      portfolio = new Portfolio({
        userId: req.payload.aud,
        templateId,
        data,
        slug: slug || undefined, // Let pre-save hook generate if not provided
        meta: {
          title: `${data.name} - ${data.title}`,
          description: data.about || `Portfolio of ${data.name}, ${data.title}`,
          keywords: [data.name, data.title, ...(data.skills?.map(s => s.name) || [])]
        }
      });
      
      await portfolio.save();
      console.log("New portfolio created for user:", req.payload.aud);
    }
    
    const baseUrl = getBaseUrl(req);
    
    res.json({
      message: "Portfolio saved successfully",
      portfolio: {
        id: portfolio._id,
        slug: portfolio.slug,
        templateId: portfolio.templateId,
        isPublished: portfolio.isPublished,
        publishedUrl: portfolio.isPublished ? `${baseUrl}/portfolio/${portfolio.slug}` : null
      }
    });
    
  } catch (error) {
    console.error("Save portfolio error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Publish portfolio (requires authentication)
router.post("/publish", verifyAccessToken, async (req, res) => {
  try {
    console.log("=== PUBLISH PORTFOLIO REQUEST ===");
    console.log("User ID:", req.payload.aud);
    
    const portfolio = await Portfolio.findOne({ userId: req.payload.aud });
    
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found. Please save your portfolio first." });
    }
    
    // Get user details for email
    const user = await User.findById(req.payload.aud);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Ensure data URLs are properly formatted before publishing
    if (process.env.NODE_ENV === 'production' || process.env.PORT) {
      portfolio.data = ensureDataUrls(portfolio.data);
    }
    
    portfolio.isPublished = true;
    portfolio.publishedAt = new Date();
    await portfolio.save();
    
    const baseUrl = getBaseUrl(req);
    const publishedUrl = `${baseUrl}/portfolio/${portfolio.slug}`;
    
    // Send publication success email
    try {
      await sendPublicationEmail(user, portfolio, publishedUrl);
      console.log("Publication email sent to:", user.email);
    } catch (emailError) {
      console.error("Failed to send publication email:", emailError);
      // Don't fail the request if email fails
    }
    
    console.log("Portfolio published:", publishedUrl);
    
    res.json({
      message: "Portfolio published successfully! Check your email for the published link.",
      publishedUrl,
      slug: portfolio.slug
    });
    
  } catch (error) {
    console.error("Publish portfolio error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Unpublish portfolio (requires authentication)
router.post("/unpublish", verifyAccessToken, async (req, res) => {
  try {
    console.log("=== UNPUBLISH PORTFOLIO REQUEST ===");
    console.log("User ID:", req.payload.aud);
    
    const portfolio = await Portfolio.findOne({ userId: req.payload.aud });
    
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    
    portfolio.isPublished = false;
    await portfolio.save();
    
    console.log("Portfolio unpublished for user:", req.payload.aud);
    
    res.json({
      message: "Portfolio unpublished successfully"
    });
    
  } catch (error) {
    console.error("Unpublish portfolio error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user's portfolio (requires authentication)
router.get("/my-portfolio", verifyAccessToken, async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ userId: req.payload.aud });
    
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    
    const baseUrl = getBaseUrl(req);
    
    res.json({
      portfolio: {
        id: portfolio._id,
        slug: portfolio.slug,
        templateId: portfolio.templateId,
        data: portfolio.data,
        isPublished: portfolio.isPublished,
        publishedUrl: portfolio.isPublished ? `${baseUrl}/portfolio/${portfolio.slug}` : null,
        publishedAt: portfolio.publishedAt,
        views: portfolio.views,
        createdAt: portfolio.createdAt,
        updatedAt: portfolio.updatedAt
      }
    });
    
  } catch (error) {
    console.error("Get portfolio error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// View published portfolio by slug (public route)
router.get("/view/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    console.log("=== VIEW PORTFOLIO REQUEST ===");
    console.log("Slug:", slug);
    
    const portfolio = await Portfolio.findOne({ slug, isPublished: true })
      .populate('userId', 'name email');
    
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found or not published" });
    }
    
    // Increment view count
    portfolio.views += 1;
    portfolio.lastViewed = new Date();
    await portfolio.save();
    
    console.log("Portfolio viewed:", slug, "Views:", portfolio.views);
    
    res.json({
      portfolio: {
        slug: portfolio.slug,
        templateId: portfolio.templateId,
        data: portfolio.data,
        meta: portfolio.meta,
        publishedAt: portfolio.publishedAt,
        views: portfolio.views
      }
    });
    
  } catch (error) {
    console.error("View portfolio error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Check slug availability (requires authentication)
router.get("/check-slug/:slug", verifyAccessToken, async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Check if slug is valid (alphanumeric and hyphens only)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.json({ available: false, message: "Slug can only contain lowercase letters, numbers, and hyphens" });
    }
    
    if (slug.length < 3 || slug.length > 50) {
      return res.json({ available: false, message: "Slug must be between 3 and 50 characters" });
    }
    
    const existing = await Portfolio.findOne({ slug });
    const available = !existing;
    
    res.json({ 
      available,
      message: available ? "Slug is available" : "Slug is already taken"
    });
    
  } catch (error) {
    console.error("Check slug error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get portfolio analytics (requires authentication)
router.get("/analytics", verifyAccessToken, async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ userId: req.payload.aud });
    
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    
    res.json({
      analytics: {
        views: portfolio.views,
        lastViewed: portfolio.lastViewed,
        publishedAt: portfolio.publishedAt,
        isPublished: portfolio.isPublished,
        slug: portfolio.slug
      }
    });
    
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Migration endpoint to fix localhost URLs in existing portfolios (admin only)
router.post("/migrate-urls", async (req, res) => {
  try {
    // Only allow in production and with a secret key for security
    if (req.body.secret !== process.env.MIGRATION_SECRET && req.body.secret !== 'migrate-urls-2024') {
      return res.status(403).json({ error: "Unauthorized" });
    }
    
    console.log("Starting URL migration...");
    
    // Find all portfolios with localhost URLs
    const portfolios = await Portfolio.find({
      $or: [
        { "data": { $regex: "localhost" } },
        { "data.profileImage": { $regex: "localhost" } },
        { "data.resume": { $regex: "localhost" } }
      ]
    });
    
    console.log(`Found ${portfolios.length} portfolios with localhost URLs`);
    
    let updatedCount = 0;
    
    for (const portfolio of portfolios) {
      const originalData = JSON.stringify(portfolio.data);
      portfolio.data = ensureDataUrls(portfolio.data);
      const newData = JSON.stringify(portfolio.data);
      
      if (originalData !== newData) {
        await portfolio.save();
        updatedCount++;
        console.log(`Updated portfolio ${portfolio._id} for user ${portfolio.userId}`);
      }
    }
    
    res.json({
      message: "URL migration completed",
      totalPortfolios: portfolios.length,
      updatedPortfolios: updatedCount
    });
    
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({ error: "Migration failed" });
  }
});

module.exports = router;