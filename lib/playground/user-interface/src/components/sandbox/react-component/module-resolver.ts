import React from "react";
import * as recharts from "recharts";

window.________intl_require________ = (module: string, name: string) => {
  console.log("________intl_require________", module, name);

  if (module === "react") {
    if (name === "default") {
      return React;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (React as any)[name];
    }
  } else if (module === "recharts") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (recharts as any)[name];
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function customModuleResolver({ types: t }: any) {
  return {
    visitor: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ImportDeclaration(path: any) {
        const source = path.node.source.value;
        const specifiers = path.node.specifiers;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const variableDeclarations = specifiers.map((specifier: any) => {
          let importName, importedName;

          if (t.isImportDefaultSpecifier(specifier)) {
            importName = specifier.local.name;
            importedName = "default";
          } else if (t.isImportSpecifier(specifier)) {
            importName = specifier.local.name;
            importedName = specifier.imported.name;
          }

          // Create a call expression to `internalGetObject(name)`
          const callExpression = t.callExpression(
            t.identifier("________intl_require________"),
            [t.stringLiteral(source), t.stringLiteral(importedName)],
          );

          // Create a variable declarator for the import
          return t.variableDeclarator(t.identifier(importName), callExpression);
        });

        // Replace the import declaration with variable declarations
        path.replaceWith(t.variableDeclaration("const", variableDeclarations));
      },
    },
  };
}
