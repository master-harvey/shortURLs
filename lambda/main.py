# Add or delete redirects in the bucket
import boto3
from botocore.exceptions import ClientError
from os import environ


def create(code, URL):
    """Upload a file to an S3 bucket

    :param file_name: File to upload
    :return: upload details if file was uploaded, else False
    """

    # Upload the file
    s3_client = boto3.client('s3')
    try:
        return s3_client.put_object(Key=code, Bucket=environ['BUCKET'], object_name=code, WebsiteRedirectLocation=URL)
    except ClientError as e:
        print(e)
        return False


def delete(code):
    """Delete a file from the S3 bucket

    :param file_name: File to delete
    :return: deletee details if file was deleted, else False
    """

    # Delete the file
    s3_client = boto3.client('s3')
    try:
        return s3_client.delete_object(Key=code, Bucket=environ['BUCKET'])
    except ClientError as e:
        print(e)
        return False


def handler(event, context):
    """takes an event.body like {"redirectTo": URL, "key":key} or {"redirectFrom": code, "key":key} based on request method (put or delete)"""
    if (event.body.key == environ["KEY"]):
        if (event.requestContext.http.method == "PUT"):
            if (event.body.redirectTo == "" or type(event.body.redirectTo) != type("")):
                return {"statusCode": 502, "headers": {"Content-Type": "application/json", "upload_authorized": True}, "body": "supply a URL"}

            # generate 5 character redirect code
            code = "12345"
            return {
                "statusCode": 201,
                "headers": {"Content-Type": "application/json", "upload_authorized": True},
                "body": create(code, event.body.redirectTo)
            }
        if (event.requestContext.http.method == "DELETE"):
            if (event.body.redirectFrom == "" or type(event.body.redirectFrom) != type("")):
                return {"statusCode": 502, "headers": {"Content-Type": "application/json", "upload_authorized": True}, "body": "supply a code"}

            return {
                "statusCode": 201,
                "headers": {"Content-Type": "application/json", "delete_authorized": True},
                "body": delete(event.body.redirectFrom)
            }

    return {"statusCode": 403, "headers": {"Content-Type": "application/json"}, "body": "Unauthorized"}
