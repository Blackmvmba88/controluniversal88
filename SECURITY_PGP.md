Maintainers' PGP public key (placeholder)

If you'd prefer to send sensitive details encrypted, we can publish an ASCII-armored PGP public key here for maintainers.

How to use (examples):

1) Import the maintainer public key (once published):

   gpg --import maintainer-public-key.asc

2) Encrypt a report file for the maintainer:

   gpg --encrypt --armor -r "security@controluniversal.dev" --output report.asc -- report.txt

3) Send `report.asc` by email to `security@controluniversal.dev` (or attach it to the GitHub security issue after contacting maintainers).

PGP key placeholder

If maintainers publish their public key, it will appear below in ASCII-armored form. For now, there is no published maintainer key here. If you have a secure means to share your key or want us to publish ours, contact the `security@controluniversal.dev` address and include your PGP public key or request ours.

---

Note: Do NOT paste any sensitive secret material in this file or in public issues; always encrypt sensitive payloads before uploading or emailing them.
