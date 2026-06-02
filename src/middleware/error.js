export const errorHandler = (error, _req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  const status = error?.statusCode || 500;
  res.status(status).json({
    error: error?.publicMessage || "Internal server error",
    message: error?.message || "Unexpected server failure",
  });
};
