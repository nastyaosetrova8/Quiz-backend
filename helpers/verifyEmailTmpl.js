const verifyEmailTmpl = (to, token) => {
  return {
    to,
    subject: 'Verify email',
    html: `
    <h1>Email Confirmation</h1>
    <p>To complete the registration process, please click on the image or the link below to confirm your email:</p>
    <a target="_blank" href="${process.env.BASE_URL}/api/auth/verify/${token}">
        <img src="data:image/png;base64,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">
    </a>
    `,
  };
};

module.exports = verifyEmailTmpl;
