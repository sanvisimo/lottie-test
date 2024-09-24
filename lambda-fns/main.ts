// Import the required modules
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { APIGatewayProxyEventV2, Context, APIGatewayProxyResult } from "aws-lambda";

// Initialize the AWS S3 SDK
const client = new S3Client({});

// AWS Lambda function
export const handler = async (event: APIGatewayProxyEventV2, context: Context) => {
    // Placeholder for S3 bucket name (to be filled)
    const bucketName = 'lottie-staging'; // S3 bucket name

    // Extract the URL from the event or default to 'https://www.example.com'
    const url = event?.pathParameters?.url || 'https://www.google.com';

    // Parse the URL to extract the hostname
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;

    // Construct the S3 key using the hostname
    const s3Key = `screenshots/${hostname}.png`;

    try {
        // Launch a headless Chrome browser using puppeteer
        const browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            // executablePath: await chromium.executablePath(
            //     'https://github.com/Sparticuz/chromium/releases/download/v119.0.2/chromium-v119.0.2-pack.tar',
            // ),
            headless: chromium.headless,
        });

        // Open a new page in the browser
        const page = await browser.newPage();

        // Navigate to the specified URL
        await page.goto(url);

        // Take a screenshot of the page
        const screenshotBuffer = await page.screenshot();

        // Close the browser
        await browser.close();

        // Define parameters for the S3 upload
        const params = {
            Bucket: bucketName,
            Key: s3Key,
            Body: screenshotBuffer
        };
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: screenshotBuffer
        });

        // Upload the screenshot to the S3 bucket
        await client.send(command);
        const response: APIGatewayProxyResult = {
            statusCode: 200,
            body: JSON.stringify(`File salvato su S3`),
        };

        return response
    } catch (error) {
        // Handle and log errors
        console.error('Error:', error);
        throw error;
    }
};
