export abstract class Utils {
  static promiseSetTimeout(duration: number) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve("Done");
      }, duration);
    });
  }

  static urlSearchParamsToRecord(
    params: URLSearchParams,
  ): Record<string, string> {
    const record: Record<string, string> = {};

    for (const [key, value] of params.entries()) {
      record[key] = value;
    }

    return record;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  static isFunction(value: unknown): value is Function {
    return typeof value === "function";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static getErrorMessage(error: any) {
    if (error.errors) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return error.errors.map((e: any) => e.message).join(", ");
    }

    return "Unknown error";
  }

  static generateUUID() {
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    if (crypto && crypto.getRandomValues) {
      console.log(
        "crypto.randomUUID is not available using crypto.getRandomValues",
      );

      return ("" + [1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(
        /[018]/g,
        (ch) => {
          const c = Number(ch);
          return (
            c ^
            (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
          ).toString(16);
        },
      );
    }

    console.log("crypto is not available");
    let date1 = new Date().getTime();
    let date2 =
      (typeof performance !== "undefined" &&
        performance.now &&
        performance.now() * 1000) ||
      0;

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        let r = Math.random() * 16;
        if (date1 > 0) {
          r = (date1 + r) % 16 | 0;
          date1 = Math.floor(date1 / 16);
        } else {
          r = (date2 + r) % 16 | 0;
          date2 = Math.floor(date2 / 16);
        }

        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      },
    );
  }

  static async calculateChecksum(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);

    return this.bufferToHex(hashBuffer);
  }

  static bufferToHex(buffer: ArrayBuffer) {
    const hexCodes = [];
    const view = new DataView(buffer);

    for (let i = 0; i < view.byteLength; i += 4) {
      const value = view.getUint32(i);
      const stringValue = value.toString(16);
      const padding = "00000000";
      const paddedValue = (padding + stringValue).slice(-padding.length);
      hexCodes.push(paddedValue);
    }

    return hexCodes.join("");
  }
}
