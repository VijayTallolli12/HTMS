export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

export const Result = {
  ok<T>(data: T): Result<T, never> {
    return { success: true, data };
  },
  err<E = Error>(error: E): Result<never, E> {
    return { success: false, error };
  },
};
