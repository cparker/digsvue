const AWS = require('aws-sdk');
let docClient = new AWS.DynamoDB.DocumentClient();

/**
 * for handling the state of the digsvue camera linux motion ras pi
 * the api gateway will send query string params like this
 *  "queryStringParameters": {
    "foo": "bar"
  }
 *
 */
exports.handler = (event, context, callback) => {
    console.log('incoming event', event);

    const genericResponse = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        isBase64Encoded: false
    }

    if (event.httpMethod === 'GET') {

        const dbParams = {
            TableName: 'digsvueState',
            Key: { id: `${event.queryStringParameters.id}` }
        }

        docClient.get(dbParams, (err, data) => {
            if (err) {
                genericResponse.body = JSON.stringify(err)
                callback(null, genericResponse)
            } else {
                genericResponse.body = JSON.stringify(data.Item)
                callback(null, genericResponse)
            }
        })
    } else if (event.httpMethod === 'POST') {
        const toInsert = {}
        const parsedBody = JSON.parse(event.body)
        Object.assign(toInsert, parsedBody)
        toInsert.id = `${event.queryStringParameters.id}`

        const dbParams = {
            TableName: 'digsvueState',
            Item: toInsert
        }
        console.log('inserting', dbParams)

        docClient.put(dbParams, (err, data) => {
            if (err) {
                genericResponse.body = JSON.stringify(err)
                callback(null, genericResponse)
            } else {
                genericResponse.body = JSON.stringify(data)
                callback(null, genericResponse)
            }
        })
    } else {
        genericResponse.body = JSON.stringify({ message: `no handler for ${event.httpMethod}` })
        callback(null, genericResponse)
    }
};
