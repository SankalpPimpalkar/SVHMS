export class ApiError extends Error {
    statusCode;
    code;
    details;

    constructor(
        statusCode,
        code,
        message,
        details
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }
}
