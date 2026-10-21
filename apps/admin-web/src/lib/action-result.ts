/**
 * Server action results that carry their error message to the browser (U4).
 * Next.js hides the message of an error thrown by a server action in
 * production ("An error occurred in the Server Components render"), so
 * actions return `{ error }` instead, and callers that prefer try/catch use
 * `unwrapAction` to turn it back into an Error on the client.
 */
export type ActionResult<T> =
  | { data: T; error?: undefined }
  | { error: string; data?: undefined };

export function unwrapAction<T>(result: ActionResult<T>): T {
  if (result.error !== undefined) throw new Error(result.error);
  return result.data as T;
}
