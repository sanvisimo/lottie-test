import {APIGatewayProxyEventV2, APIGatewayProxyResult, Context} from "aws-lambda";

export const handler = async (event: APIGatewayProxyEventV2, context: Context) => {
    const response: APIGatewayProxyResult = {
        statusCode: 200,
        body: JSON.stringify(`Hello from lambda`),
    };

    return response
}
