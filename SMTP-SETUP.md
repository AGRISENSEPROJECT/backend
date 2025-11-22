# SMTP Email Setup Guide

## Quick Setup Options

### Option 1: Gmail SMTP (Recommended for Development)

**Step 1: Enable 2-Factor Authentication**
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Click "Security" → "2-Step Verification" → Turn on

**Step 2: Generate App Password**
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and your device
3. Copy the 16-character password (format: xxxx xxxx xxxx xxxx)

**Step 3: Update .env file**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
```

### Option 2: Mailtrap (Best for Development Testing)

**Step 1: Sign up**
1. Go to [Mailtrap.io](https://mailtrap.io/)
2. Create free account

**Step 2: Create Inbox**
1. Create new inbox
2. Go to "SMTP Settings"
3. Copy credentials

**Step 3: Update .env file**
```env
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
```

### Option 3: SendGrid (Production Ready)

**Step 1: Sign up**
1. Go to [SendGrid](https://sendgrid.com/)
2. Create account (free tier: 100 emails/day)

**Step 2: Create API Key**
1. Go to Settings → API Keys
2. Create new API key
3. Copy the key

**Step 3: Update .env file**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

## Development Mode

The application works in development mode without SMTP configuration:
- OTPs are logged to console
- Any 6-digit number works for verification
- No actual emails are sent

## Testing Your SMTP Setup

1. **Configure SMTP in .env**
2. **Restart your application**
3. **Register a new user**
4. **Check for email delivery**

### Gmail Troubleshooting

If you get "Username and Password not accepted":
1. Make sure 2FA is enabled
2. Use App Password, not your regular password
3. App Password should be 16 characters without spaces
4. Try generating a new App Password

### Mailtrap Benefits

- Catches all emails in development
- No risk of sending test emails to real users
- Email preview and testing tools
- Free tier is generous for development

### Production Considerations

For production, consider:
- **SendGrid**: Reliable, good free tier
- **AWS SES**: Cost-effective for high volume
- **Mailgun**: Developer-friendly
- **Postmark**: High deliverability

## Environment Variables

```env
# Required for email sending
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password

# Optional: Override sender email
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Agrisense Team
```

## Security Notes

- Never commit real SMTP credentials to git
- Use environment variables or secrets management
- Rotate credentials regularly
- Use App Passwords instead of main passwords
- Consider OAuth2 for Gmail in production