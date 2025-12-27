"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOTPEmail = exports.generateOTP = void 0;
const nodemailer = __importStar(require("nodemailer"));
const secrets_1 = require("./secrets");
// Create transporter
const createTransporter = async () => {
    // For development, you can use ethereal.email or mailtrap.io
    // For production, use your actual email service (Gmail, SendGrid, etc.)
    if (process.env.EMAIL_STATUS === "active") {
        // Production email configuration
        const emailHost = process.env.EMAIL_HOST;
        const emailPort = process.env.EMAIL_PORT;
        const emailUser = process.env.EMAIL_USER;
        const emailFrom = process.env.EMAIL_FROM;
        // Get EMAIL_PASSWORD from secrets manager
        const emailPassword = await secrets_1.secretsManager.getRequiredSecret("EMAIL_PASSWORD");
        if (!emailHost ||
            !emailPort ||
            !emailUser ||
            !emailPassword ||
            !emailFrom) {
            throw new Error("Email configuration is incomplete for production");
        }
        return nodemailer.createTransport({
            host: emailHost,
            port: parseInt(emailPort),
            secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
            auth: {
                user: emailUser,
                pass: emailPassword,
            },
        });
    }
    else {
        // Development: Create a test account with ethereal.email
        console.log("⚠️  Development mode: Using console logging for OTP codes. Set up EMAIL_* env vars for actual email sending.");
        // Return a mock transporter for development
        return {
            sendMail: async (mailOptions) => {
                console.log("\n📧 Email would be sent:");
                console.log("To:", mailOptions.to);
                console.log("Subject:", mailOptions.subject);
                console.log("Text:", mailOptions.text);
                console.log("HTML:", mailOptions.html);
                console.log("\n");
                return { messageId: "dev-message-id" };
            },
        };
    }
};
const crypto = __importStar(require("crypto"));
/**
 * Generate a cryptographically secure 6-digit OTP code
 */
const generateOTP = () => {
    // Use crypto.randomBytes for cryptographically secure random number
    const buffer = crypto.randomBytes(4);
    const num = (buffer.readUInt32BE(0) % 900000) + 100000;
    return num.toString();
};
exports.generateOTP = generateOTP;
/**
 * Send OTP email to user
 */
const sendOTPEmail = async (email, otp) => {
    const transporter = await createTransporter();
    const mailOptions = {
        from: process.env.EMAIL_FROM || '"MoodRing" <noreply@moodring.app>',
        to: email,
        subject: "Your MoodRing Authentication Code",
        text: `Your authentication code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this code, please ignore this email or contact support if you have concerns.`,
        html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              background-color: #f5f5f5;
              margin: 0;
              padding: 0;
            }
            .email-wrapper {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
            }
            .email-container {
              padding: 40px 32px;
            }
            .header {
              border-bottom: 1px solid #e5e5e5;
              padding-bottom: 24px;
              margin-bottom: 32px;
            }
            .logo {
              font-size: 24px;
              font-weight: 600;
              color: #1a1a1a;
              letter-spacing: -0.5px;
            }
            .content {
              margin-bottom: 32px;
            }
            .content p {
              margin: 0 0 16px 0;
              color: #4a4a4a;
              font-size: 15px;
            }
            .otp-container {
              background-color: #f8f9fa;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 24px;
              margin: 32px 0;
              text-align: center;
            }
            .otp-code {
              font-size: 36px;
              font-weight: 600;
              letter-spacing: 12px;
              color: #1a1a1a;
              font-family: 'Courier New', monospace;
              margin: 0;
            }
            .expiry-notice {
              text-align: center;
              color: #6b7280;
              font-size: 14px;
              margin-top: 16px;
            }
            .security-notice {
              background-color: #fef3c7;
              border-left: 3px solid #f59e0b;
              padding: 16px;
              margin-top: 24px;
              border-radius: 4px;
            }
            .security-notice p {
              margin: 0;
              font-size: 14px;
              color: #92400e;
              line-height: 1.5;
            }
            .footer {
              margin-top: 40px;
              padding-top: 24px;
              border-top: 1px solid #e5e5e5;
              text-align: center;
            }
            .footer p {
              margin: 0 0 8px 0;
              font-size: 13px;
              color: #9ca3af;
            }
            .footer-text {
              font-size: 12px;
              color: #9ca3af;
              margin-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="email-container">
              <div class="header">
                <div class="logo">MoodRing</div>
              </div>
              
              <div class="content">
                <p>You have requested to sign in to your MoodRing account. Use the authentication code below to complete your login:</p>
                
                <div class="otp-container">
                  <div class="otp-code">${otp}</div>
                </div>
                
                <p class="expiry-notice">This code will expire in 10 minutes.</p>
                
                <div class="security-notice">
                  <p><strong>Security Notice:</strong> If you did not request this code, please ignore this email. Never share this code with anyone. MoodRing staff will never ask for your authentication code.</p>
                </div>
              </div>
              
              <div class="footer">
                <p>MoodRing</p>
                <p class="footer-text">This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ OTP email sent to ${email}`);
    }
    catch (error) {
        console.error("Error sending OTP email:", error);
        throw new Error("Failed to send OTP email");
    }
};
exports.sendOTPEmail = sendOTPEmail;
//# sourceMappingURL=email.js.map