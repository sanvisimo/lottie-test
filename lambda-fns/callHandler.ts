import {APIGatewayProxyEventV2, APIGatewayProxyResult, Context} from "aws-lambda";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

const client = new LambdaClient({});

export const handler = async (event: APIGatewayProxyEventV2, context: Context) => {
    console.log('event', JSON.parse(event?.body ?? ""))

    const command = new InvokeCommand({
        FunctionName: 'screenshotFn',
        InvocationType: 'Event',
        Payload: JSON.stringify(event.body),
    });

    const res = await client.send(command)
    console.log('invoka', res)

    const response: APIGatewayProxyResult = {
        statusCode: 200,
        body: JSON.stringify({
            status: 200,
            result: {
                message: `File salvato su S3`,
                file: `https://lottie-bucket.s3.eu-west-1.amazonaws.com/screenshots/example.mp4`
            }
        }),
    };

    return response
}
