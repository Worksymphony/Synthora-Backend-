import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendCandidateEmail(to, status, name) {
  let subject = "";
  let text = "";

  switch (status) {
    case "Interview":
      subject = "Interview Scheduled";
      text = `Hi ${name},\n\nWe are pleased to inform you that your interview has been scheduled. Our HR team will share details shortly.\n\nRegards,\nHR Team`;
      break;

    case "Rejected":
      subject = "Application Update";
      text = `Hi ${name},\n\nThank you for applying. Unfortunately, we are not moving forward at this time. We wish you the best in your career.\n\nRegards,\nHR Team`;
      break;

    case "Hired":
      subject = "Congratulations! You’re Hired";
      text = `Hi ${name},\n\nWe are excited to welcome you to our team! Our HR team will share onboarding details shortly.\n\nRegards,\nHR Team`;
      break;

    default:
      return; // no email for other statuses
  }

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  });

  console.log(`📧 Email sent to ${to} for status: ${status}`);
}
