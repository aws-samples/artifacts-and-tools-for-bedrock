import os
import json
from pydantic import ValidationError
from botocore.exceptions import ClientError
from aws_lambda_powertools.utilities import parameters
from aws_lambda_powertools import Logger
from aws_lambda_powertools.logging import correlation_paths
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.event_handler.api_gateway import Response
from aws_lambda_powertools.event_handler import (
    APIGatewayRestResolver,
    CORSConfig,
    content_types,
)
from utils import CustomEncoder
from routes.health import router as health_router
from routes.files import router as files_router
from routes.sessions import router as sessions_router

logger = Logger()

X_ORIGIN_VERIFY_SECRET_ARN = os.environ.get("X_ORIGIN_VERIFY_SECRET_ARN")

cors_config = CORSConfig(allow_origin="*", max_age=300)
app = APIGatewayRestResolver(
    cors=cors_config,
    strip_prefixes=["/v1"],
    serializer=lambda obj: json.dumps(obj, cls=CustomEncoder),
)

app.include_router(health_router)
app.include_router(files_router)
app.include_router(sessions_router)


@app.exception_handler(ClientError)
def handle_value_error(e: ClientError):
    logger.exception(e)

    return Response(
        status_code=200,
        content_type=content_types.APPLICATION_JSON,
        body=json.dumps(
            {"error": True, "message": str(e)},
            cls=CustomEncoder,
        ),
    )


@app.exception_handler(ValidationError)
def handle_value_error(e: ValidationError):
    logger.exception(e)

    return Response(
        status_code=200,
        content_type=content_types.APPLICATION_JSON,
        body=json.dumps(
            {"error": True, "message": [str(error) for error in e.errors()]},
            cls=CustomEncoder,
        ),
    )


def get_origin_verify_header_value():
    origin_verify_header_value = parameters.get_secret(
        X_ORIGIN_VERIFY_SECRET_ARN, transform="json", max_age=60
    )["headerValue"]

    return origin_verify_header_value


@logger.inject_lambda_context(
    log_event=True, correlation_id_path=correlation_paths.API_GATEWAY_REST
)
def handler(event: dict, context: LambdaContext) -> dict:
    origin_verify_header_value = get_origin_verify_header_value()
    if event["headers"]["X-Origin-Verify"] == origin_verify_header_value:
        return app.resolve(event, context)

    return {"statusCode": 403, "body": "Forbidden"}
