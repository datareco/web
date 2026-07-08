# VoltaEdge Algo Website

Static marketing site for Datareco's VoltaEdge Algo product.

## Pages

- `index.html` - primary landing page
- `signal-engine.html` - signal engine deep dive
- `architecture.html` - architecture deep dive

## Local preview

Run a static server from the repository root:

```bash
python3 -m http.server 4173
```

Then open:

- `http://127.0.0.1:4173/index.html`
- `http://127.0.0.1:4173/signal-engine.html`
- `http://127.0.0.1:4173/architecture.html`

## Deployment

This site can be deployed as a static frontend. The smallest AWS setup is:

1. S3 bucket for static files
2. CloudFront distribution in front of S3
3. ACM certificate for HTTPS
4. Route 53 hosted zone and DNS records if AWS will also manage the domain

If you want the contact form to send emails from AWS instead of staying as a client-side mock, add:

5. API Gateway HTTP API
6. Lambda function for form handling
7. SES for email delivery

## Notes

- The current contact form is still a client-side success mock.
- All interactive behavior is handled in `assets/site.js`.
- The original handoff package is intentionally ignored in Git; the live site files are the copies at the repository root.