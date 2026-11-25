import { context, fail, json, method } from "../../server/xinpay-api.js";

export default async function handler(req, res) {
  if (!method(req, res, "GET")) return;
  const auth = await context(req, { admin: true });
  if (auth.error) return fail(res, auth.error.status, auth.error.message);
  return json(res, 200, { authenticated: true, email: auth.user.email });
}
