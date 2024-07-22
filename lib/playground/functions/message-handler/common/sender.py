import os
import math
import json
import uuid
import boto3
from tools.executor import ConverseToolExecutor

MAX_PAYLOAD_SIZE = 24 * 1024  # 24 KB

api_gateway_management_api = boto3.client(
    "apigatewaymanagementapi",
    endpoint_url=os.environ["WEBSOCKET_API_ENDPOINT"],
)

sequence_idx = 0


class MessageSender:
    def __init__(self, connection_id):
        self.connection_id = connection_id

    def send_data(self, data):
        global sequence_idx

        sequence_idx += 1
        data["sequence_idx"] = sequence_idx

        frame_id = str(uuid.uuid4())
        message_json = json.dumps(data, indent=None, separators=(",", ":"))
        message_bytes = message_json.encode("utf-8")
        total_length = len(message_bytes)
        num_frames = math.ceil(total_length / MAX_PAYLOAD_SIZE)

        for i in range(num_frames):
            start = i * MAX_PAYLOAD_SIZE
            end = start + MAX_PAYLOAD_SIZE
            frame_data = message_bytes[start:end]

            frame_message = {
                "frame_id": frame_id,
                "num_frames": num_frames,
                "frame_idx": i + 1,
                "last": i == num_frames - 1,
                "data": frame_data.decode("utf-8", "ignore"),
            }

            api_gateway_management_api.post_to_connection(
                ConnectionId=self.connection_id,
                Data=json.dumps(frame_message, indent=None, separators=(",", ":")),
            )

    def send_error(self, error):
        self.send_data(
            {"event_type": "ERROR", "error": error},
        )

    def send_heartbeat(self, payload=None):
        self.send_data(
            {"event_type": "HEARTBEAT", "payload": payload},
        )

    def send_loop(self, finish):
        self.send_data(
            {
                "event_type": "LOOP",
                "finish": finish,
            },
        )

    def send_text(self, text):
        self.send_data(
            {"event_type": "TEXT_CHUNK", "text": text},
        )

    def send_tool(
        self,
        tool_use_id,
        tool_name,
        status,
        extra=None,
    ):
        self.send_data(
            {
                "event_type": "TOOL_USE",
                "tool_use_id": tool_use_id,
                "tool_name": tool_name,
                "status": status,
                "extra": extra,
            },
        )

    def send_tool_running_messages(self, executor: ConverseToolExecutor):
        tool_use = executor.get_formatted_tool_use()
        tool_use_extra = {current["toolUseId"]: {} for current in tool_use}
        status = "running"

        for current in tool_use:
            tool_use_id = current["toolUseId"]
            tool_name = current["name"]
            input = current["input"]

            request_text = None
            if tool_name == "code_interpreter":
                request_text = f"```python\n{input['code']}\n```"
            elif tool_name == "web_search":
                request_text = ""
                search_query = input.get("query")
                additiona_urls = input.get("urls")
                if search_query:
                    request_text = f'Search query:\n"{search_query}"'
                if additiona_urls:
                    request_text += f"\n\nURLs:\n\n```json\n{json.dumps(additiona_urls, indent=2)}\n```"
            else:
                request_text = f"```json\n{json.dumps(input, indent=2)}\n```"

            extra = {"request_text": request_text}
            tool_use_extra[tool_use_id] = extra
            self.send_tool(tool_use_id, tool_name, status, extra=extra)

        return tool_use_extra

    def send_tool_finished_messages(self, executor: ConverseToolExecutor):
        tool_results = executor.get_tool_results()
        tool_results_extra = {current["toolUseId"]: {} for current in tool_results}

        for current in tool_results:
            tool_use_id = current["toolUseId"]
            status = current["status"]
            tool_name = current["name"]
            response_text = current.get("content", {}).get("text")

            extra = current.get("extra", {})
            response_html = extra.get("html")
            output_files = extra.get("output_files", [])

            extra = {
                "response_text": response_text,
                "response_html": response_html,
                "output_files": output_files,
            }

            tool_results_extra[tool_use_id] = extra

            self.send_tool(
                tool_use_id,
                tool_name,
                status,
                extra=extra,
            )

        return tool_results_extra
