import React, { useState, useEffect } from "react";
import { customModuleResolver } from "./module-resolver";

export interface ReactComponentProps {
  code: string;
}

export default function ReactComponent({ code }: ReactComponentProps) {
  const [CompiledComponent, setCompiledComponent] =
    useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  code = "import React from 'react';" + code;

  useEffect(() => {
    const compileAndRender = async () => {
      const typescript = await import("typescript");
      const Babel = await import("@babel/standalone");

      try {
        // Step 1: Compile TypeScript to JavaScript
        const jsCode = typescript.transpile(code, {
          jsx: typescript.JsxEmit.React,
          module: typescript.ModuleKind.ESNext,
          target: typescript.ScriptTarget.ES2020,
          declaration: true,
        });

        // Step 2: Transform JSX with Babel
        const transformedCode = Babel.transform(jsCode, {
          presets: ["react"],
          plugins: [customModuleResolver],
        }).code;

        console.log(transformedCode);
        const blob = new Blob([transformedCode ?? ""], {
          type: "application/javascript",
        });
        const blobUrl = URL.createObjectURL(blob);
        const module = await import(/* @vite-ignore */ blobUrl);
        //module.setGlobals({ React, react: React });
        setCompiledComponent(() => module.default);
        setError(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(`Compilation error: ${err.message}`);
        setCompiledComponent(null);
      }
    };

    compileAndRender();
  }, [code]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        {error}
      </div>
    );
  }

  return CompiledComponent ? (
    <CompiledComponent />
  ) : (
    <div className="flex items-center justify-center h-screen">
      Compiling...
    </div>
  );
}
