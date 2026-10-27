// A stand-in mail server for the end-to-end tests. The app sends its email
// here instead of to real inboxes, and tests read it back over HTTP:
// GET /messages?to=<address> lists what that address was sent, oldest first.
import http from "node:http";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";

const messages = [];

const smtp = new SMTPServer({
  // The app always logs in; any login is accepted.
  authOptional: true,
  allowInsecureAuth: true,
  disabledCommands: ["STARTTLS"],
  logger: false,
  onAuth(auth, _session, callback) {
    callback(null, { user: auth.username });
  },
  onData(stream, session, callback) {
    simpleParser(stream).then((mail) => {
      messages.push({
        to: session.envelope.rcptTo.map((r) => r.address.toLowerCase()),
        subject: mail.subject ?? "",
        html: mail.html || "",
        text: mail.text ?? "",
      });
      callback();
    }, callback);
  },
});
smtp.listen(Number(process.env.SMTP_PORT), "127.0.0.1");

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const to = url.searchParams.get("to")?.toLowerCase();
    const found =
      url.pathname === "/messages"
        ? messages.filter((m) => !to || m.to.includes(to))
        : [];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(found));
  })
  .listen(Number(process.env.MAILBOX_PORT), "127.0.0.1");
