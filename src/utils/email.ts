import * as nodemailer from "nodemailer";
import { secretsManager } from "./secrets";

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
    const emailPassword = await secretsManager.getRequiredSecret(
      "EMAIL_PASSWORD"
    );

    if (
      !emailHost ||
      !emailPort ||
      !emailUser ||
      !emailPassword ||
      !emailFrom
    ) {
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
  } else {
    // Development: Create a test account with ethereal.email
    console.log(
      "⚠️  Development mode: Using console logging for OTP codes. Set up EMAIL_* env vars for actual email sending."
    );

    // Return a mock transporter for development
    return {
      sendMail: async (mailOptions: any) => {
        console.log("\n📧 Email would be sent:");
        console.log("To:", mailOptions.to);
        console.log("Subject:", mailOptions.subject);
        console.log("Text:", mailOptions.text);
        console.log("HTML:", mailOptions.html);
        console.log("\n");
        return { messageId: "dev-message-id" };
      },
    } as any;
  }
};

import * as crypto from "crypto";

/**
 * Generate a cryptographically secure 6-digit OTP code
 */
export const generateOTP = (): string => {
  // Use crypto.randomBytes for cryptographically secure random number
  const buffer = crypto.randomBytes(4);
  const num = (buffer.readUInt32BE(0) % 900000) + 100000;
  return num.toString();
};

/**
 * Send OTP email to user
 */
export const sendOTPEmail = async (
  email: string,
  otp: string
): Promise<void> => {
  const transporter = await createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"MoodRing" <noreply@moodring.app>',
    to: email,
    subject: "Your MoodRing Login Code",
    text: `Your one-time password (OTP) is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 10px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .otp-code {
              background-color: #fff;
              border: 2px solid #007bff;
              border-radius: 8px;
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              text-align: center;
              padding: 20px;
              margin: 20px 0;
              color: #007bff;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 14px;
              color: #666;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 12px;
              margin-top: 20px;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎭 MoodRing Login</h1>
            </div>
            
            <p>Hello,</p>
            <p>You've requested to log in to your MoodRing account. Use the code below to complete your login:</p>
            
            <div class="otp-code">
              ${otp}
            </div>
            
            <p style="text-align: center; color: #666;">
              This code will expire in <strong>10 minutes</strong>
            </p>
            
            <div class="warning">
              <strong>⚠️ Security Note:</strong> If you didn't request this code, please ignore this email. Never share this code with anyone.
            </div>
            
            <div class="footer">
              <p>Thank you for using MoodRing!</p>
              <p style="font-size: 12px; color: #999;">
                This is an automated message, please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${email}`);
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
};

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (email: string): Promise<void> => {
  const transporter = await createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"MoodRing" <noreply@moodring.app>',
    to: email,
    subject: "Welcome to MoodRing! 🎭",
    text: `Welcome to MoodRing!\n\nThank you for joining us. We're excited to have you on board!\n\nBest regards,\nThe MoodRing Team`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 10px;
              padding: 40px;
              color: white;
              text-align: center;
            }
            h1 {
              font-size: 36px;
              margin-bottom: 20px;
            }
            .content {
              background-color: rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎭 Welcome to MoodRing!</h1>
            
            <div class="content">
              <p>Thank you for joining us. We're excited to have you on board!</p>
              <p>Get started by exploring your dashboard and connecting your wallet.</p>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px;">
              Best regards,<br/>
              The MoodRing Team
            </p>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${email}`);
  } catch (error) {
    console.error("Error sending welcome email:", error);
    // Don't throw error for welcome email, it's not critical
  }
};
