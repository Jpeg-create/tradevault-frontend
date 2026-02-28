# Screenshot Upload — Cloudflare R2 Setup

## Why R2?
- Zero egress fees (unlike S3 which charges ~$0.09/GB outbound)
- S3-compatible API — backend code is identical to S3
- $0.015/GB/month storage
- Free tier: 10GB storage + 1M Class A ops/month

## Backend Route Needed

```
POST /uploads/screenshot
Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: file (image/*)
Response: { url: "https://pub.your-bucket.r2.dev/screenshots/..." }
```

## Setup (Node.js / Express)

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner multer
```

```js
// r2.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuid } = require('uuid');

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// multer middleware (memory storage, 5MB limit)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Route: POST /uploads/screenshot
router.post('/uploads/screenshot', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const ext  = req.file.mimetype.split('/')[1] || 'jpg';
  const key  = `screenshots/${req.user.id}/${uuid()}.${ext}`;

  await r2.send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME,
    Key:         key,
    Body:        req.file.buffer,
    ContentType: req.file.mimetype,
    // Optional: cache for 30 days
    CacheControl: 'public, max-age=2592000',
  }));

  const url = `${process.env.R2_PUBLIC_URL}/${key}`;
  // R2_PUBLIC_URL = https://pub.your-bucket.r2.dev or your custom domain

  // Optionally store url on the trade record in your DB here

  res.json({ url });
});
```

## Environment Variables
```
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_api_token_access_key
R2_SECRET_ACCESS_KEY=your_r2_api_token_secret
R2_BUCKET_NAME=quantario-screenshots
R2_PUBLIC_URL=https://pub.quantario-screenshots.r2.dev
```

## Cloudflare Dashboard Steps
1. R2 → Create Bucket → name it `quantario-screenshots`
2. Settings → Enable public access (or use a custom domain)
3. Manage R2 API Tokens → Create token with Object Read & Write on this bucket
4. Copy Account ID, Access Key ID, Secret Access Key

## Database Column
Add `screenshot_url TEXT` to your `trades` table:
```sql
ALTER TABLE trades ADD COLUMN screenshot_url TEXT;
```
