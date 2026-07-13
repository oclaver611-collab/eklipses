// One-time script: apply CORS config to the eklipses-videos R2 bucket.
// Run: node set_r2_cors.js
require('dotenv').config({ path: '.env.local' });
const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

async function main() {
  const corsConfig = {
    CORSRules: [
      {
        AllowedOrigins: ['https://eklipses.vercel.app', 'http://localhost:3000'],
        AllowedMethods: ['GET', 'HEAD'],
        AllowedHeaders: ['*'],
        MaxAgeSeconds: 86400,
      },
    ],
  };

  console.log('Applying CORS config to bucket:', BUCKET);
  await client.send(new PutBucketCorsCommand({ Bucket: BUCKET, CORSConfiguration: corsConfig }));
  console.log('CORS applied. Verifying...');

  const result = await client.send(new GetBucketCorsCommand({ Bucket: BUCKET }));
  const rule = result.CORSRules[0];
  console.log('Origins:', rule.AllowedOrigins);
  console.log('Methods:', rule.AllowedMethods);
  console.log('MaxAge:', rule.MaxAgeSeconds);
  console.log('Done.');
}

main().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
