/** Validation for draft-only recipient entry. This never triggers a mail request. */
export function validDemoRecipient(address:string):boolean {
  const trimmed=address.trim()
  return trimmed.length<=254&&/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(trimmed)
}
/** Reply subjects are prefixed once, regardless of prior replies. */
export const replySubject=(subject:string):string=>
  'AW: '+subject.trim().replace(/^(?:(?:AW|RE|ANS):\s*)+/gi,'')
