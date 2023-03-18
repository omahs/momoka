export type LogFunctionType = (message: string, ...optionalParams: unknown[]) => void;

/**
 * A function to log a message to the console with a green font color.
 * @param message - The message to be logged to the console.
 * @param optionalParams - An optional list of additional parameters to be logged to the console.
 */
export const consoleLog = (message: string, ...optionalParams: unknown[]): void => {
  console.log('\x1b[32m', `[${new Date().toUTCString()}] ${message}`, ...optionalParams);
};