import { hasSecrets, KeysetWithSecrets, PublicKeyset, getScope } from '/keyset'

export const keysetSummary = (keyset: PublicKeyset | KeysetWithSecrets | undefined) => {
  if (keyset === undefined) return 'none'
  const scope = getScope(keyset)
  const encryptionPublicKey = hasSecrets(keyset) ? keyset.encryption.publicKey : keyset.encryption
  const signaturePublicKey = hasSecrets(keyset) ? keyset.signature.publicKey : keyset.signature
  return `${scope.name}(e)${encryptionPublicKey}(s)${signaturePublicKey}#${keyset.generation}`
}
