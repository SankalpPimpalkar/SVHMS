import { ApiError } from './ApiError.js';

export class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized') {
        super(401, 'UNAUTHORIZED', message);
    }
}

export class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden') {
        super(403, 'FORBIDDEN', message);
    }
}

export class NotFoundError extends ApiError {
    constructor(message = 'Resource not found') {
        super(404, 'NOT_FOUND', message);
    }
}

export class BadRequestError extends ApiError {
    constructor(message = 'Bad request', details) {
        super(400, 'BAD_REQUEST', message, details);
    }
}
