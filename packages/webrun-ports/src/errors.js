/**
 * Serializes an error object.
 *
 * @param {Error} error - The error object to serialize.
 * @returns {Object} - The serialized error object.
 */
export function serializeError(error) {
  return Object.assign(
    {
      message: error,
      stack: error.stack,
    },
    error,
  );
}

/**
 * Deserializes an error object.
 *
 * @param {Object|string} error - The error object or error message to deserialize.
 * @returns {Error} - The deserialized error object.
 */
export function deserializeError(error) {
  if (typeof error === 'string') {
    error = { message: error };
  }
  return Object.assign(new Error(error.message), error);
}
