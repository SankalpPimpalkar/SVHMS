import { ApiError } from './ApiError.js';

export function errorHandler(
    err,
    _req,
    res,
    _next
) {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            error: err.code,
            message: err.message,
            details: err.details ?? null,
        });
    }

    console.error('Unhandled error:', err);

    return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
    });
}
