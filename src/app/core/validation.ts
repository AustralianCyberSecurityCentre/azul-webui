/** Validates that the text element launching an event contains hex. */
export function hexValidator(event: Event, maxLength = 999) {
  const pattern = /^(0[xX])?[a-fA-F0-9]{1,8}$/;

  const target = event.target as HTMLInputElement;

  if (!pattern.test(target.value)) {
    // Trying to use capture groups to preserve 0x makes for
    // ugly regex. Just strip it and add it back on if the user
    // has specified it.
    let prefix = "";
    let userString = target.value.trim();
    if (userString.startsWith("0x") || userString.startsWith("0X")) {
      prefix = userString.substring(0, 2);
      userString = userString.substring(2);
    }

    // Trim the string to 8 characters if needed - again, regex
    // is ugly for negations
    if (userString.length > maxLength) {
      userString = userString.substring(0, maxLength);
    }

    // Finally, sanitise characters
    userString = userString.replace(/[^a-fA-F0-9]/g, "");

    target.value = prefix + userString;
  }
}
