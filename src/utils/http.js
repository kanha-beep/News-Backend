export const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.publicMessage = message;
  return error;
};
