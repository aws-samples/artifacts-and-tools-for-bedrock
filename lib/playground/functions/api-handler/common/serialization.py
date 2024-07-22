import orjson
import base64
import zlib


def custom_serializer(obj):
    if isinstance(obj, bytes):
        return {"__bytes__": True, "data": base64.b64encode(obj).decode("utf-8")}

    return orjson.OPT_PASSTHROUGH


def custom_deserializer(obj):
    if isinstance(obj, dict):
        if "__bytes__" in obj:
            return base64.b64decode(obj["data"])
        for key, value in obj.items():
            obj[key] = custom_deserializer(value)
    elif isinstance(obj, list):
        obj = [custom_deserializer(item) for item in obj]

    return obj


def serialize(data: dict, compressed=True):
    json_bytes = orjson.dumps(data, default=custom_serializer)

    if compressed:
        json_bytes = zlib.compress(json_bytes)

    return json_bytes


def deserialize(serialized_data, compressed=True):
    if compressed:
        serialized_data = zlib.decompress(serialized_data)

    data = orjson.loads(serialized_data)

    return custom_deserializer(data)
