# Add or delete redirects in the bucket
from string import ascii_letters, digits
from random import SystemRandom
from boto3 import client
from botocore.exceptions import ClientError
from os import environ
from json import loads

def create(code, URL):
    """Upload a redirect object to the S3 bucket

    :param code: object to upload
    :param URL: URL to redirect to
    :return: upload details if file was uploaded, else False
    """

    # Upload the file
    s3_client = client('s3')
    try:
        return s3_client.put_object(Key=code, Bucket=environ['BUCKET'], object_name=code, WebsiteRedirectLocation=URL, ACL='public-read')
    except ClientError as e:
        print(e)
        return False


def delete(code):
    """Delete a redirect object from the S3 bucket

    :param code: object to delete
    :return: deletee details if file was deleted, else False
    """

    # Delete the file
    s3_client = client('s3')
    try:
        return s3_client.delete_object(Key=code, Bucket=environ['BUCKET'])
    except ClientError as e:
        print(e)
        return False


def handler(event, context):
    """takes an event.body like {"redirectTo": URL, "key":key} or {"redirectFrom": code, "key":key} based on request method (put or delete)"""
    event['body'] = loads(event['body'])
    if (event['body']['key'] == environ["KEY"]):
        if (event['requestContext']['http']['method'] == "PUT"):
            if (event['body']['redirectTo'] == "" or type(event['body']['redirectTo']) != type("")):
                return {"statusCode": 502, "body": "supply a URL", "headers": {"Content-Type": "application/json", "upload_authorized": True}}

            # generate 6 character redirect code and create the object https://stackoverflow.com/questions/2257441
            code = ''.join(SystemRandom().choice(ascii_letters + digits) for _ in range(6))
            create(code, event['body']['redirectTo'])
            return {
                "statusCode": 201, "body": code,
                "headers": {"Content-Type": "application/json", "upload_authorized": True}
            }
        if (event['requestContext']['http']['method'] == "DELETE"):
            if (event['body']['redirectFrom'] == "" or type(event['body']['redirectFrom']) != type("")):
                return {"statusCode": 502, "body": "supply a code", "headers": {"Content-Type": "application/json", "delete_authorized": True}}

            # delete object
            delete(event['body']['redirectFrom'])
            return {
                "statusCode": 201, "body": event['body']['redirectFrom'],
                "headers": {"Content-Type": "application/json", "delete_authorized": True}
            }

        # method guard clause not passed
        return {"statusCode": 405, "headers": {"Content-Type": "application/json"}, "body": "Method Not Allowed"}

    # KEY guard clause not passed
    return {"statusCode": 403, "headers": {"Content-Type": "application/json"}, "body": "Forbidden"}
