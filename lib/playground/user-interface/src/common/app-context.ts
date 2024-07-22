import { createContext } from "react";
import { AppConfig } from "../types/app";
import { ResourcesConfig } from "aws-amplify";

export const AppContext = createContext<(ResourcesConfig & AppConfig) | null>(
  null,
);
