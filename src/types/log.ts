/**
 * Defines the standard log levels used within the library and expected by the logger callback.
 */
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'EROR',
  DEBUG = 'DEBG',
}

/**
 * Type definition for the optional logger callback function passed via ScannerOptions.
 */
export type LoggerCallback = (
    source: string,
    level: LogLevel,
    component: string,
    message: string,
    data?: unknown
) => void;