import json
from handler import handle_message
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger(log_uncaught_exceptions=True)


@logger.inject_lambda_context(log_event=True)
def handler(event, _: LambdaContext):
    event_type = event["requestContext"]["eventType"]
    connection_id = event["requestContext"]["connectionId"]
    user_id = event["requestContext"]["authorizer"]["username"]

    logger.set_correlation_id(connection_id)

    if event_type == "MESSAGE":
        message = json.loads(event["body"])
        return handle_message(logger, connection_id, user_id, message)

    return {"ok": True}
