import { Navigate, useParams } from "react-router-dom";
import { Utils } from "../../common/utils";
import Playground from "./playground";

export default function PlaygroundPage() {
  const { sessionId } = useParams();

  if (!sessionId) {
    return <Navigate to={`/chat/${Utils.generateUUID()}`} />;
  }

  return <Playground />;
}
