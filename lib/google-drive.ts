import { google } from 'googleapis';
import { Readable } from 'stream';

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // ms

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return client;
}

function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function uploadToGoogleDrive(
  filename: string,
  buffer: Buffer,
  mimeType: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
): Promise<{ fileId: string; webViewLink: string } | null> {
  // Skip if Google Drive credentials are not configured
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REFRESH_TOKEN
  ) {
    console.log('Google Drive credentials not configured, skipping upload');
    return null;
  }

  const auth = getOAuth2Client();
  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Check if file already exists in the folder
      const existingFiles = await drive.files.list({
        q: `name = '${filename}' and '${folderId}' in parents and trashed = false`,
        fields: 'files(id, name)',
      });

      let fileId: string;

      if (existingFiles.data.files && existingFiles.data.files.length > 0) {
        // Update existing file
        fileId = existingFiles.data.files[0].id!;
        await drive.files.update({
          fileId,
          media: {
            mimeType,
            body: bufferToStream(buffer),
          },
        });
        console.log(`Updated existing file: ${filename} (ID: ${fileId})`);
      } else {
        // Create new file
        const response = await drive.files.create({
          requestBody: {
            name: filename,
            parents: folderId ? [folderId] : [],
          },
          media: {
            mimeType,
            body: bufferToStream(buffer),
          },
          fields: 'id, webViewLink',
        });
        fileId = response.data.id!;
        console.log(`Created new file: ${filename} (ID: ${fileId})`);
      }

      // Get file link
      const file = await drive.files.get({
        fileId,
        fields: 'webViewLink',
      });

      return {
        fileId,
        webViewLink: file.data.webViewLink || '',
      };
    } catch (error) {
      console.error(`Google Drive upload attempt ${attempt}/${MAX_RETRIES} failed:`, error);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY * attempt);
      } else {
        throw new Error(`Failed to upload to Google Drive after ${MAX_RETRIES} attempts`);
      }
    }
  }

  return null;
}

export async function listDriveFiles(): Promise<
  Array<{ id: string; name: string; modifiedTime: string }>
> {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REFRESH_TOKEN
  ) {
    return [];
  }

  const auth = getOAuth2Client();
  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'`,
    fields: 'files(id, name, modifiedTime)',
    orderBy: 'name desc',
  });

  return (
    response.data.files?.map((f) => ({
      id: f.id!,
      name: f.name!,
      modifiedTime: f.modifiedTime!,
    })) || []
  );
}
