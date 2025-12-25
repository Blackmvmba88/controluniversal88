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

Generating a PGP key (example steps)

1. Generate a new key interactively (recommended):

   gpg --full-generate-key

   - Choose (1) RSA and RSA
   - Keysize: 4096
   - Expire: your choice (e.g., 1y) or 0 for no expiry
   - Provide your name and email (use an email you control)

2. Verify your key and fingerprint:

   gpg --list-keys --keyid-format long
   gpg --fingerprint you@example.com

   Note the key ID and fingerprint (use this to verify the public key later).

3. Export the public key (ASCII armored) to share/publish:

   gpg --armor --export security@controluniversal.dev > maintainer-public-key.asc

   # or export by key ID
   gpg --armor --export 0xYOURKEYID > maintainer-public-key.asc

4. To encrypt a report for the maintainer:

   gpg --encrypt --armor -r "security@controluniversal.dev" --output report.asc -- report.txt

5. To verify a signed file (when maintainers publish signatures):

   gpg --verify file.sig file

6. (Optional) If you want to publish your own public key for maintainers to use, export and send the `.asc` file to `security@controluniversal.dev` via a secure channel.

---

Note: Do NOT paste any sensitive secret material in this file or in public issues; always encrypt sensitive payloads before uploading or emailing them.
