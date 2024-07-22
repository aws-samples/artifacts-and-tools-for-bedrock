import json
import boto3

lambda_client = boto3.client("lambda")


class ToolProvider:
    def __init__(self, tools: dict = {}):
        self.tools = tools

    def get_tool_arn(self, tool_name):
        if tool_name in self.tools:
            return self.tools[tool_name]
        else:
            return None

    def execute(self, payload):
        print(json.dumps(payload, indent=2))

        tool_name = payload["name"]
        tool_arn = self.get_tool_arn(tool_name)
        if tool_arn is None:
            return {
                "status": "error",
                "content": [{"text": f"Tool {tool_name} not found."}],
            }

        response = lambda_client.invoke(
            FunctionName=tool_arn,
            InvocationType="RequestResponse",
            Payload=json.dumps(payload),
        )

        response_payload = json.load(response["Payload"])

        print(json.dumps(response_payload, indent=2))

        status = response_payload["status"]
        content = response_payload.get("content", {})
        extra = response_payload.get("extra", {})

        return {"status": status, "content": content, "extra": extra}
