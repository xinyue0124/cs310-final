//
// NON-TRIVIAL OPERATION #3 (basket checkout)
//
// API function: POST /checkout
//
// Processes an adoption basket checkout. The user has saved one or more
// animals from the catalog (The Cat API) into their basket and is now
// submitting an adoption inquiry for all of them at once.
//
// The server sends a personalized SES confirmation email that lists every
// animal the user expressed interest in.
//
// Request body (JSON):
//   {
//     applicant_name:  string   (required)
//     applicant_email: string   (required)
//     message:         string   (optional)
//     cats: [{ name, breed, life_span, temperament }]  (required, at least 1)
//   }
//
// Returns:
//   { message: "success", email_sent: true, cats_count: N }
//

const { SendEmailCommand } = require('@aws-sdk/client-ses');
const { get_ses, get_sender_email } = require('./helper.js');


exports.post_checkout = async (request, response) => {
  try {
    console.log("**Call to POST /checkout...");

    const { applicant_name, applicant_email, message, cats } = request.body;

    if (!applicant_name || !applicant_email) {
      return response.status(400).json({ message: "applicant_name and applicant_email are required" });
    }
    if (!cats || cats.length === 0) {
      return response.status(400).json({ message: "cats list is empty — add some animals to your basket first" });
    }

    const ses         = get_ses();
    const senderEmail = get_sender_email();

    const catLines = cats.map(c =>
      `  • ${c.name}${c.breed ? ' (' + c.breed + ')' : ''}${c.life_span ? ' — lifespan: ' + c.life_span + ' yrs' : ''}`
    ).join('\n');

    console.log(`sending checkout confirmation to ${applicant_email} for ${cats.length} animal(s)...`);

    const emailCmd = new SendEmailCommand({
      Source: senderEmail,
      Destination: { ToAddresses: [applicant_email] },
      Message: {
        Subject: {
          Data:    `Your adoption inquiry has been received — ${cats.length} animal${cats.length > 1 ? 's' : ''}`,
          Charset: 'UTF-8'
        },
        Body: {
          Text: {
            Data: [
              `Hi ${applicant_name},`,
              ``,
              `Thank you for your interest in adopting! We've received your inquiry`,
              `for the following animal${cats.length > 1 ? 's' : ''}:`,
              ``,
              catLines,
              ``,
              message ? `Your message:\n"${message}"\n` : '',
              `Our team will review your application and reach out within 3–5 business days`,
              `to discuss next steps and arrange a meet-and-greet.`,
              ``,
              `With gratitude,`,
              `— Animal Rescue Hub`
            ].join('\n'),
            Charset: 'UTF-8'
          }
        }
      }
    });

    await ses.send(emailCmd);
    console.log("checkout confirmation email sent");

    response.json({
      message:    "success",
      email_sent: true,
      cats_count: cats.length
    });

  } catch (err) {
    console.log("ERROR:", err.message);
    response.status(500).json({ message: err.message });
  }
};
