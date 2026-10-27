// The log-in page, wherever the app asks a visitor to sign in.
//
// Email and password first, as on any website, with "Create an account" and
// "Forgot your password?" beside them. The two older ways in are kept under
// "Other ways to sign in": the six-digit email code (for people who never set
// a password) and the personal access code on a card (site has no work email,
// and often no signal worth waiting on). The page itself lives with the other
// account screens in src/html/auth.js.

export { loginPage as loginHTML } from './auth.js';
